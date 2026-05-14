import logging
import traceback
from contextlib import asynccontextmanager

import redis.asyncio as aioredis
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import text

from app.config import settings
from app.database import AsyncSessionLocal, get_db, init_db
from app.routers import analytics, auth, doctors, notes, patients, sessions, ws
from app.routers.auth import verify_token
from app.services import redis_client as redis_module

_bearer = HTTPBearer(auto_error=False)


async def require_auth(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
):
    # Gate disabled when access_pin is empty
    if not settings.access_pin:
        return
    if not credentials or not verify_token(credentials.credentials):
        raise HTTPException(status_code=401, detail="Invalid or missing token")

logger = logging.getLogger(__name__)


async def _migrate_patient_columns() -> None:
    """Add Sprint-9 columns to patients table if they don't exist yet."""
    new_cols = [
        ("blood_group",         "VARCHAR(5)"),
        ("known_allergies",     "TEXT"),
        ("chronic_conditions",  "TEXT"),
        ("address",             "TEXT"),
        ("emergency_contact",   "VARCHAR(100)"),
        ("notes",               "TEXT"),
    ]
    async with AsyncSessionLocal() as db:
        for col, col_type in new_cols:
            try:
                await db.execute(text(
                    f"ALTER TABLE patients ADD COLUMN IF NOT EXISTS {col} {col_type}"
                ))
            except Exception as e:
                logger.warning(f"[Migration] Could not add column {col}: {e}")
        await db.commit()
    print("[Startup] Patient column migration complete.", flush=True)


async def _seed_mock_doctors() -> None:
    """Upsert the 5 mock doctors so they always exist in DB for session/note lookups."""
    from uuid import UUID
    from sqlalchemy import select
    from app.models import Doctor

    mock_doctors = [
        {"id": UUID("00000000-0000-0000-0000-000000000001"), "name": "Dr. Ananya Sharma",  "specialty": "General Physician", "email": "ananya@mediscribe.dev"},
        {"id": UUID("00000000-0000-0000-0000-000000000002"), "name": "Dr. Rajesh Kumar",   "specialty": "Pediatrics",        "email": "rajesh@mediscribe.dev"},
        {"id": UUID("00000000-0000-0000-0000-000000000003"), "name": "Dr. Priya Singh",    "specialty": "Dermatology",       "email": "priya@mediscribe.dev"},
        {"id": UUID("00000000-0000-0000-0000-000000000004"), "name": "Dr. Amit Verma",     "specialty": "Cardiology",        "email": "amit@mediscribe.dev"},
        {"id": UUID("00000000-0000-0000-0000-000000000005"), "name": "Dr. Sunita Rao",     "specialty": "Gynecology",        "email": "sunita@mediscribe.dev"},
    ]
    async with AsyncSessionLocal() as db:
        for d in mock_doctors:
            existing = await db.execute(select(Doctor).where(Doctor.id == d["id"]))
            if not existing.scalar_one_or_none():
                db.add(Doctor(id=d["id"], name=d["name"], specialty=d["specialty"], email=d["email"]))
        await db.commit()
    print("[Startup] Mock doctors seeded.", flush=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Init database tables
    await init_db()

    # 1b. Migrate new patient columns (Sprint 9 — ALTER TABLE IF NOT EXISTS)
    await _migrate_patient_columns()

    # 2. Seed mock doctors
    await _seed_mock_doctors()

    # 3. Init Redis client singleton used by session_state.py
    client = aioredis.from_url(settings.redis_url, decode_responses=True)
    redis_module.set_client(client)

    # Rebuild ICD-10 DB if missing or empty (happens when ./backend is volume-mounted
    # and the host copy is empty, shadowing the one built during Docker image creation)
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
    title="MediScribe API",
    version="0.2.0",
    description="Ambient AI Medical Scribe — POC",
    lifespan=lifespan,
)

_origins = [o.strip() for o in settings.allowed_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"], dependencies=[Depends(require_auth)])
app.include_router(sessions.router, prefix="/api/sessions", tags=["Sessions"], dependencies=[Depends(require_auth)])
app.include_router(notes.router, prefix="/api/notes", tags=["Notes"], dependencies=[Depends(require_auth)])
app.include_router(doctors.router, prefix="/api/doctors", tags=["Doctors"], dependencies=[Depends(require_auth)])
app.include_router(patients.router, prefix="/api/patients", tags=["Patients"], dependencies=[Depends(require_auth)])
app.include_router(ws.router, prefix="/ws", tags=["WebSocket"])  # WS auth via ?token= query param


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Unhandled exception on {request.method} {request.url}: {exc}")
    logger.error(traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal error occurred. Please try again."},
    )


@app.get("/health")
async def health_check():
    from sqlalchemy.ext.asyncio import AsyncSession
    from app.database import AsyncSessionLocal
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
