import logging
import traceback
from contextlib import asynccontextmanager
from uuid import UUID

import redis.asyncio as aioredis
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import text
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from app.config import settings
from app.database import AsyncSessionLocal, get_db, init_db
from app.routers import analytics, auth, billing, clinics, demo, doctors, notes, patients, sessions, webhooks, ws
from app.routers.auth import decode_token
from app.services import redis_client as redis_module

_bearer = HTTPBearer(auto_error=False)

logger = logging.getLogger(__name__)


# ── Security headers ───────────────────────────────────────────────────────────

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Inject hardening headers on every API response."""
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault(
            "Permissions-Policy",
            "camera=(), microphone=(), geolocation=(), payment=(self)",
        )
        # Prevent API responses from being cached by CDN / browser
        if request.url.path.startswith("/api/"):
            response.headers.setdefault("Cache-Control", "no-store")
        return response


# ── Rate limiter ───────────────────────────────────────────────────────────────

# (path, max_requests, window_seconds)
_RATE_RULES: list[tuple[str, int, int]] = [
    ("/api/auth/login",          10,  900),   # 10 req / 15 min per IP
    ("/api/auth/register",        5, 3600),   # 5 req / hr per IP
    ("/api/auth/refresh",        30,  900),   # 30 req / 15 min per IP
    ("/api/auth/setup-password",  5, 3600),   # 5 req / hr per IP
    ("/api/auth/reset-password",  5, 3600),   # 5 req / hr per IP
]
_GLOBAL_LIMIT = (300, 60)  # 300 req/min per IP — basic DDoS guard


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Redis-backed per-IP rate limiter. Fails open when Redis is unavailable."""

    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for health checks and webhooks (Razorpay needs no IP limit)
        path = request.url.path
        if path in ("/health", "/api/webhooks/razorpay"):
            return await call_next(request)

        ip = request.headers.get("fly-client-ip") or request.headers.get("x-forwarded-for", "").split(",")[0].strip() or (request.client.host if request.client else "unknown")

        try:
            redis = redis_module.get_client()

            # Endpoint-specific limits
            for rule_path, max_req, window in _RATE_RULES:
                if path == rule_path:
                    key = f"rl:{rule_path}:{ip}"
                    count = await redis.incr(key)
                    if count == 1:
                        await redis.expire(key, window)
                    if count > max_req:
                        retry_after = await redis.ttl(key)
                        return JSONResponse(
                            status_code=429,
                            content={"detail": "Too many requests. Please slow down."},
                            headers={"Retry-After": str(max(retry_after, 1))},
                        )
                    break

            # Global per-IP limit (all paths)
            g_max, g_window = _GLOBAL_LIMIT
            gkey = f"rl:global:{ip}"
            gcount = await redis.incr(gkey)
            if gcount == 1:
                await redis.expire(gkey, g_window)
            if gcount > g_max:
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Too many requests. Please slow down."},
                    headers={"Retry-After": "60"},
                )
        except Exception:
            pass  # Redis unavailable — fail open, never block legitimate traffic

        return await call_next(request)


async def require_auth(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
):
    """
    Validates JWT and attaches identity claims to request.state.
    Supports two modes:
      - Legacy PIN mode: token has doctor_id=null — no scoping enforced
      - Doctor mode: token has real doctor_id + clinic_id + role
    """
    token_str = credentials.credentials if credentials else None

    # Gate disabled in dev (no access_pin and no secret_key)
    if not settings.access_pin and not settings.secret_key:
        request.state.doctor_id = None
        request.state.clinic_id = None
        request.state.role = None
        return

    if not token_str:
        raise HTTPException(status_code=401, detail="Invalid or missing token")

    claims = decode_token(token_str)
    if claims is None:
        raise HTTPException(status_code=401, detail="Invalid or missing token")

    # Attach to request.state for use in route handlers
    raw_doctor_id = claims.get("doctor_id")
    raw_clinic_id = claims.get("clinic_id")
    request.state.doctor_id = UUID(raw_doctor_id) if raw_doctor_id else None
    request.state.clinic_id = UUID(raw_clinic_id) if raw_clinic_id else None
    request.state.role = claims.get("role")


# ── Startup migrations ─────────────────────────────────────────────────────────

async def _migrate_sprint9_columns() -> None:
    """Sprint 9 — patient table new columns."""
    cols = [
        ("blood_group",         "VARCHAR(5)"),
        ("known_allergies",     "TEXT"),
        ("chronic_conditions",  "TEXT"),
        ("address",             "TEXT"),
        ("emergency_contact",   "VARCHAR(100)"),
        ("notes",               "TEXT"),
    ]
    async with AsyncSessionLocal() as db:
        for col, col_type in cols:
            try:
                await db.execute(text(f"ALTER TABLE patients ADD COLUMN IF NOT EXISTS {col} {col_type}"))
            except Exception as e:
                logger.warning(f"[Migration] patients.{col}: {e}")
        await db.commit()


async def _migrate_sprint10_schema() -> None:
    """Sprint 10 — clinics table, clinic_invites table, auth columns on doctors/patients/sessions."""
    async with AsyncSessionLocal() as db:
        # clinics table
        await db.execute(text("""
            CREATE TABLE IF NOT EXISTS clinics (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(100) NOT NULL,
                plan_type VARCHAR(20) NOT NULL DEFAULT 'solo',
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        """))
        # clinic_invites table
        await db.execute(text("""
            CREATE TABLE IF NOT EXISTS clinic_invites (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                clinic_id UUID NOT NULL REFERENCES clinics(id),
                invite_code VARCHAR(8) UNIQUE NOT NULL,
                created_by UUID NOT NULL REFERENCES doctors(id),
                email_hint VARCHAR(255),
                used BOOLEAN NOT NULL DEFAULT false,
                used_by UUID REFERENCES doctors(id),
                expires_at TIMESTAMPTZ NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        """))
        # doctors — new auth columns
        for col, col_type in [
            ("clinic_id",        "UUID REFERENCES clinics(id)"),
            ("hashed_password",  "VARCHAR(255)"),
            ("role",             "VARCHAR(20) DEFAULT 'doctor'"),
            ("is_active",        "BOOLEAN DEFAULT true"),
        ]:
            try:
                await db.execute(text(f"ALTER TABLE doctors ADD COLUMN IF NOT EXISTS {col} {col_type}"))
            except Exception as e:
                logger.warning(f"[Migration] doctors.{col}: {e}")
        # patients — clinic scoping
        try:
            await db.execute(text("ALTER TABLE patients ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES clinics(id)"))
        except Exception as e:
            logger.warning(f"[Migration] patients.clinic_id: {e}")
        # sessions — clinic scoping
        try:
            await db.execute(text("ALTER TABLE sessions ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES clinics(id)"))
        except Exception as e:
            logger.warning(f"[Migration] sessions.clinic_id: {e}")
        await db.commit()
    print("[Startup] Sprint 10 schema migration complete.", flush=True)


async def _seed_demo_clinic() -> None:
    """
    Upsert the demo clinic and 5 seeded doctors with email/password auth.
    Idempotent — safe to run on every startup.
    """
    from passlib.context import CryptContext
    from sqlalchemy import select
    from app.models import Doctor
    from app.models.clinic import Clinic

    DEMO_CLINIC_ID = UUID("00000000-0000-0000-0000-000000000099")
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    seed_password = settings.seed_doctor_password
    hashed = pwd_context.hash(seed_password)

    demo_doctors = [
        {"id": UUID("00000000-0000-0000-0000-000000000001"), "name": "Dr. Ananya Sharma", "specialty": "General Physician", "email": "ananya@demo.chartr.in", "role": "admin"},
        {"id": UUID("00000000-0000-0000-0000-000000000002"), "name": "Dr. Rajesh Kumar",  "specialty": "Pediatrics",        "email": "rajesh@demo.chartr.in", "role": "doctor"},
        {"id": UUID("00000000-0000-0000-0000-000000000003"), "name": "Dr. Priya Singh",   "specialty": "Dermatology",       "email": "priya@demo.chartr.in",  "role": "doctor"},
        {"id": UUID("00000000-0000-0000-0000-000000000004"), "name": "Dr. Amit Verma",    "specialty": "Cardiology",        "email": "amit@demo.chartr.in",   "role": "doctor"},
        {"id": UUID("00000000-0000-0000-0000-000000000005"), "name": "Dr. Sunita Rao",    "specialty": "Gynecology",        "email": "sunita@demo.chartr.in", "role": "doctor"},
    ]

    async with AsyncSessionLocal() as db:
        # Upsert demo clinic
        clinic = await db.get(Clinic, DEMO_CLINIC_ID)
        if not clinic:
            db.add(Clinic(id=DEMO_CLINIC_ID, name="Chartr Demo Clinic", plan_type="clinic"))
            await db.flush()

        for d in demo_doctors:
            existing = (await db.execute(select(Doctor).where(Doctor.id == d["id"]))).scalar_one_or_none()
            if existing:
                # Update auth fields if not yet set
                existing.clinic_id = DEMO_CLINIC_ID
                existing.role = d["role"]
                existing.is_active = True
                if not existing.hashed_password:
                    existing.hashed_password = hashed
                # Update email to new demo domain if still on old domain
                if existing.email and (
                    existing.email.endswith("@chartr.dev") or
                    existing.email.endswith("@demo.mediscribe.in") or
                    existing.email.endswith("@demo.chartr.dev")
                ):
                    existing.email = d["email"]
            else:
                db.add(Doctor(
                    id=d["id"], name=d["name"], specialty=d["specialty"],
                    email=d["email"], clinic_id=DEMO_CLINIC_ID,
                    hashed_password=hashed, role=d["role"], is_active=True,
                ))
        # Always reset demo clinic subscription to free — prevents test runs from leaving it in trialing/active
        from app.models.billing import Subscription
        demo_sub = (await db.execute(
            select(Subscription).where(Subscription.clinic_id == DEMO_CLINIC_ID)
        )).scalar_one_or_none()
        if demo_sub:
            demo_sub.plan = "free"
            demo_sub.status = "free"
            demo_sub.razorpay_subscription_id = None
            demo_sub.trial_ends_at = None
            demo_sub.current_period_end = None
        else:
            db.add(Subscription(clinic_id=DEMO_CLINIC_ID, plan="free", status="free"))

        await db.commit()
    print("[Startup] Demo clinic and doctors seeded.", flush=True)


async def _backfill_clinic_id() -> None:
    """Assign all NULL clinic_ids on patients/sessions to the demo clinic (Sprint 9 backfill)."""
    DEMO_CLINIC_ID = "00000000-0000-0000-0000-000000000099"
    async with AsyncSessionLocal() as db:
        await db.execute(text(
            f"UPDATE patients SET clinic_id = '{DEMO_CLINIC_ID}' WHERE clinic_id IS NULL"
        ))
        await db.execute(text(
            f"UPDATE sessions SET clinic_id = '{DEMO_CLINIC_ID}' WHERE clinic_id IS NULL"
        ))
        await db.commit()
    print("[Startup] clinic_id backfill complete.", flush=True)


async def _migrate_patient_documents() -> None:
    """Create patient_documents table and ai_analyzed column if they don't exist."""
    async with AsyncSessionLocal() as db:
        await db.execute(text("""
            CREATE TABLE IF NOT EXISTS patient_documents (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                patient_id UUID NOT NULL REFERENCES patients(id),
                clinic_id UUID REFERENCES clinics(id),
                uploaded_by UUID REFERENCES doctors(id),
                filename VARCHAR(255) NOT NULL,
                doc_type VARCHAR(50) NOT NULL DEFAULT 'other',
                description TEXT,
                ai_analyzed BOOLEAN NOT NULL DEFAULT FALSE,
                content_type VARCHAR(100),
                file_size INTEGER,
                file_data BYTEA NOT NULL,
                uploaded_at TIMESTAMPTZ DEFAULT NOW()
            )
        """))
        await db.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_patient_documents_patient_id ON patient_documents(patient_id)"
        ))
        # Add ai_analyzed if missing (for existing deployments)
        await db.execute(text("""
            ALTER TABLE patient_documents
            ADD COLUMN IF NOT EXISTS ai_analyzed BOOLEAN NOT NULL DEFAULT FALSE
        """))
        await db.commit()
    print("[Startup] patient_documents table ready.", flush=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await _migrate_sprint9_columns()
    await _migrate_sprint10_schema()
    await _migrate_patient_documents()
    await _seed_demo_clinic()
    await _backfill_clinic_id()

    client = aioredis.from_url(settings.redis_url, decode_responses=True)
    redis_module.set_client(client)

    import sqlite3 as _sqlite3, os as _os
    _icd_path = settings.icd_db_path
    _needs_build = not _os.path.exists(_icd_path) or _os.path.getsize(_icd_path) == 0
    if not _needs_build:
        try:
            _c = _sqlite3.connect(_icd_path).cursor()
            _needs_build = _c.execute("SELECT COUNT(*) FROM icd10").fetchone()[0] == 0
        except Exception:
            _needs_build = True
    if _needs_build:
        from scripts.build_icd_db import build as _build_icd
        _build_icd()
        print("[Startup] ICD-10 database rebuilt.", flush=True)

    yield
    await client.aclose()


app = FastAPI(
    title="Chartr API",
    version="0.3.0",
    description="Ambient AI Medical Scribe",
    lifespan=lifespan,
)

_origins = [o.strip() for o in settings.allowed_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    # No wildcard Vercel regex — only explicitly allowed origins
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With"],
    expose_headers=["X-Request-ID"],
)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware)

app.include_router(auth.router,              prefix="/api/auth",    tags=["Auth"])
app.include_router(clinics.public_router,    prefix="/api/clinics", tags=["Clinics"])
app.include_router(clinics.router,           prefix="/api/clinics", tags=["Clinics"],   dependencies=[Depends(require_auth)])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"], dependencies=[Depends(require_auth)])
app.include_router(sessions.router,  prefix="/api/sessions",  tags=["Sessions"],  dependencies=[Depends(require_auth)])
app.include_router(notes.router,     prefix="/api/notes",     tags=["Notes"],     dependencies=[Depends(require_auth)])
app.include_router(doctors.router,   prefix="/api/doctors",   tags=["Doctors"],   dependencies=[Depends(require_auth)])
app.include_router(patients.router,  prefix="/api/patients",  tags=["Patients"],  dependencies=[Depends(require_auth)])
app.include_router(ws.router,        prefix="/ws",            tags=["WebSocket"])
app.include_router(demo.router,      prefix="/api/demo",      tags=["Demo"],      dependencies=[Depends(require_auth)])
app.include_router(billing.router,   prefix="/api/billing",   tags=["Billing"],   dependencies=[Depends(require_auth)])
app.include_router(webhooks.router,  prefix="/api/webhooks",  tags=["Webhooks"])


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Unhandled exception on {request.method} {request.url}: {exc}")
    logger.error(traceback.format_exc())
    return JSONResponse(status_code=500, content={"detail": "An internal error occurred. Please try again."})


@app.get("/health")
async def health_check():
    result = {"status": "ok", "db": "error", "redis": "error", "deepgram": "configured" if settings.deepgram_api_key else "not_configured"}
    try:
        async with AsyncSessionLocal() as db:
            await db.execute(text("SELECT 1"))
        result["db"] = "ok"
    except Exception:
        pass
    try:
        redis = redis_module.get_client()
        await redis.ping()
        result["redis"] = "ok"
    except Exception:
        pass
    return result
