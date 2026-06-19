# backend/app/routers/webhooks.py
# Razorpay webhook handler — Task 3

import hashlib
import hmac
import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import AsyncSessionLocal
from app.models.billing import Subscription

router = APIRouter()
logger = logging.getLogger(__name__)


def _verify_signature(body: bytes, signature: str) -> bool:
    """Verify Razorpay webhook signature using HMAC-SHA256."""
    if not settings.razorpay_webhook_secret:
        return True  # dev mode — skip verification
    expected = hmac.new(
        key=settings.razorpay_webhook_secret.encode("utf-8"),
        msg=body,
        digestmod=hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


async def _get_sub_by_rzp_id(rzp_sub_id: str, db: AsyncSession) -> Subscription | None:
    result = await db.execute(
        select(Subscription).where(Subscription.razorpay_subscription_id == rzp_sub_id)
    )
    return result.scalar_one_or_none()


@router.post("/razorpay")
async def razorpay_webhook(request: Request):
    """
    Handle Razorpay webhook events.

    Events handled:
    - subscription.activated   → set status=active
    - subscription.charged     → update current_period_end
    - subscription.completed   → set status=cancelled (all cycles done)
    - subscription.cancelled   → set status=cancelled
    - subscription.paused      → set status=past_due
    - payment.captured         → log for audit
    - payment.failed           → set status=past_due
    """
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")

    if not _verify_signature(body, signature):
        logger.warning("[Webhook] Invalid Razorpay signature — rejected")
        raise HTTPException(status_code=400, detail="Invalid signature")

    try:
        event = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    event_type = event.get("event")
    payload = event.get("payload", {})

    logger.info(f"[Webhook] Received: {event_type}")

    async with AsyncSessionLocal() as db:
        try:
            await _handle_event(event_type, payload, db)
            await db.commit()
        except Exception as e:
            logger.error(f"[Webhook] Error handling {event_type}: {e}")
            # Return 200 to Razorpay anyway — retries would replay the same error
            return JSONResponse(status_code=200, content={"ok": False, "error": str(e)})

    return JSONResponse(status_code=200, content={"ok": True, "event": event_type})


async def _handle_event(event_type: str, payload: dict, db: AsyncSession):
    subscription_data = payload.get("subscription", {}).get("entity", {})
    payment_data = payload.get("payment", {}).get("entity", {})

    rzp_sub_id = (
        subscription_data.get("id")
        or payment_data.get("subscription_id")
    )
    if not rzp_sub_id:
        logger.warning(f"[Webhook] No subscription ID in payload for {event_type}")
        return

    sub = await _get_sub_by_rzp_id(rzp_sub_id, db)
    if not sub:
        logger.warning(f"[Webhook] Unknown subscription {rzp_sub_id} for event {event_type}")
        return

    now = datetime.now(timezone.utc)

    if event_type == "subscription.activated":
        sub.status = "active"
        _set_period_end(sub, subscription_data)
        logger.info(f"[Webhook] Subscription {rzp_sub_id} activated for clinic {sub.clinic_id}")

    elif event_type == "subscription.charged":
        sub.status = "active"
        _set_period_end(sub, subscription_data)
        logger.info(f"[Webhook] Subscription {rzp_sub_id} charged — period renewed")

    elif event_type in ("subscription.completed", "subscription.cancelled"):
        sub.status = "cancelled"
        logger.info(f"[Webhook] Subscription {rzp_sub_id} → cancelled")

    elif event_type == "subscription.paused":
        sub.status = "past_due"
        logger.info(f"[Webhook] Subscription {rzp_sub_id} paused")

    elif event_type == "payment.failed":
        sub.status = "past_due"
        logger.warning(f"[Webhook] Payment failed for subscription {rzp_sub_id}")

    elif event_type == "payment.captured":
        # Payment captured is handled via subscription.charged — just log
        logger.info(f"[Webhook] Payment captured for subscription {rzp_sub_id}")

    else:
        logger.info(f"[Webhook] Unhandled event type: {event_type}")


def _set_period_end(sub: Subscription, rzp_data: dict):
    """Parse Razorpay's current_end timestamp and set current_period_end."""
    current_end = rzp_data.get("current_end")
    if current_end:
        try:
            sub.current_period_end = datetime.fromtimestamp(current_end, tz=timezone.utc)
        except Exception:
            pass
