# backend/app/routers/billing.py
# Uses httpx directly — avoids razorpay SDK's pkg_resources dependency

import logging
from datetime import datetime, timezone
from typing import Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import Doctor
from app.models.billing import Subscription
from app.models.session import Session

router = APIRouter()
logger = logging.getLogger(__name__)

_RZP_BASE = "https://api.razorpay.com/v1"


# ── Razorpay HTTP helpers ──────────────────────────────────────────────────────

def _rzp_auth():
    return (settings.razorpay_key_id, settings.razorpay_key_secret)


async def _rzp_post(path: str, payload: dict) -> dict:
    url = f"{_RZP_BASE}{path}"
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(url, json=payload, auth=_rzp_auth())
    if not resp.is_success:
        raise HTTPException(
            status_code=502,
            detail=f"Razorpay {resp.status_code}: {resp.text}",
        )
    return resp.json()


async def _rzp_cancel(subscription_id: str) -> dict:
    url = f"{_RZP_BASE}/subscriptions/{subscription_id}/cancel"
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            url,
            json={"cancel_at_cycle_end": 1},
            auth=_rzp_auth(),
        )
    if not resp.is_success:
        raise HTTPException(
            status_code=502,
            detail=f"Razorpay cancel {resp.status_code}: {resp.text}",
        )
    return resp.json()


# ── DB helpers ─────────────────────────────────────────────────────────────────

async def _get_or_create_subscription(clinic_id, db: AsyncSession) -> Subscription:
    result = await db.execute(
        select(Subscription).where(Subscription.clinic_id == clinic_id)
    )
    sub = result.scalar_one_or_none()
    if not sub:
        sub = Subscription(clinic_id=clinic_id, plan="free", status="free")
        db.add(sub)
        await db.flush()
    return sub


async def _sessions_this_month(clinic_id, db: AsyncSession) -> int:
    now = datetime.now(timezone.utc)
    count = (await db.execute(
        select(func.count()).select_from(Session).where(
            Session.clinic_id == clinic_id,
            extract("year",  Session.created_at) == now.year,
            extract("month", Session.created_at) == now.month,
        )
    )).scalar_one()
    return count


# ── Schemas ────────────────────────────────────────────────────────────────────

class SubscribeRequest(BaseModel):
    plan: Literal["solo", "clinic"]


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/status")
async def billing_status(request: Request, db: AsyncSession = Depends(get_db)):
    """Return current subscription status + usage for this clinic."""
    clinic_id = getattr(request.state, "clinic_id", None)
    if not clinic_id:
        raise HTTPException(status_code=400, detail="No clinic associated with this account")

    sub = await _get_or_create_subscription(clinic_id, db)
    sessions_used = await _sessions_this_month(clinic_id, db)
    await db.commit()

    now = datetime.now(timezone.utc)

    # Auto-expire trial
    effective_status = sub.status
    if sub.status == "trialing" and sub.trial_ends_at and sub.trial_ends_at < now:
        effective_status = "free"
        sub.status = "free"
        await db.commit()

    days_left = None
    if effective_status == "trialing" and sub.trial_ends_at:
        delta = sub.trial_ends_at - now
        days_left = max(0, delta.days)

    session_limit = 10 if effective_status == "free" else None

    return {
        "plan":                     sub.plan,
        "status":                   effective_status,
        "trial_ends_at":            sub.trial_ends_at.isoformat() if sub.trial_ends_at else None,
        "days_left_in_trial":       days_left,
        "current_period_end":       sub.current_period_end.isoformat() if sub.current_period_end else None,
        "razorpay_subscription_id": sub.razorpay_subscription_id,
        "sessions_this_month":      sessions_used,
        "session_limit":            session_limit,
        "can_start_session":        session_limit is None or sessions_used < session_limit,
    }


@router.post("/subscribe")
async def create_subscription(
    body: SubscribeRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Create a Razorpay subscription. Returns subscription_id + short_url for checkout.
    Works for all accounts — not limited to demo.
    """
    clinic_id = getattr(request.state, "clinic_id", None)
    doctor_id = getattr(request.state, "doctor_id", None)
    if not clinic_id:
        raise HTTPException(status_code=400, detail="No clinic associated with this account")

    if not settings.razorpay_key_id or not settings.razorpay_key_secret:
        raise HTTPException(status_code=503, detail="Billing is not configured on this server")

    plan_id = settings.razorpay_plan_solo if body.plan == "solo" else settings.razorpay_plan_clinic
    if not plan_id:
        raise HTTPException(status_code=503, detail=f"Razorpay plan ID for '{body.plan}' is not configured")

    doctor = await db.get(Doctor, doctor_id) if doctor_id else None
    sub = await _get_or_create_subscription(clinic_id, db)

    # Already has an active paid subscription — return it
    if sub.razorpay_subscription_id and sub.status == "active":
        return {
            "subscription_id": sub.razorpay_subscription_id,
            "short_url": None,
            "plan": sub.plan,
            "status": sub.status,
            "message": "Subscription already active",
        }

    payload = {
        "plan_id": plan_id,
        "total_count": 120,
        "quantity": 1,
        "customer_notify": 1,
    }
    if doctor:
        payload["notify_info"] = {"notify_email": doctor.email}

    rzp_sub = await _rzp_post("/subscriptions", payload)

    sub.plan = body.plan
    sub.razorpay_subscription_id = rzp_sub["id"]
    sub.status = "trialing"
    await db.commit()

    return {
        "subscription_id": rzp_sub["id"],
        "short_url": rzp_sub.get("short_url"),
        "plan": body.plan,
        "status": sub.status,
        "key_id": settings.razorpay_key_id,
    }


@router.post("/cancel")
async def cancel_subscription(request: Request, db: AsyncSession = Depends(get_db)):
    """Cancel the clinic's Razorpay subscription at end of current period."""
    clinic_id = getattr(request.state, "clinic_id", None)
    if not clinic_id:
        raise HTTPException(status_code=400, detail="No clinic associated with this account")

    result = await db.execute(
        select(Subscription).where(Subscription.clinic_id == clinic_id)
    )
    sub = result.scalar_one_or_none()

    if not sub or not sub.razorpay_subscription_id:
        raise HTTPException(status_code=404, detail="No active subscription found")
    if sub.status == "cancelled":
        raise HTTPException(status_code=400, detail="Subscription is already cancelled")
    if not settings.razorpay_key_id:
        raise HTTPException(status_code=503, detail="Billing is not configured")

    await _rzp_cancel(sub.razorpay_subscription_id)

    sub.status = "cancelled"
    await db.commit()

    return {
        "status": "cancelled",
        "message": "Your subscription will remain active until the end of the current billing period.",
    }
