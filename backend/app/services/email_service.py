# backend/app/services/email_service.py

import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_RESEND_URL = "https://api.resend.com/emails"


async def send_password_reset_email(to_email: str, reset_url: str, doctor_name: str) -> bool:
    """
    Send a password reset email via Resend.
    Returns True on success, False if Resend is not configured or the send fails.
    The caller should not block on this — failure is non-fatal (log + silent).
    """
    if not settings.resend_api_key:
        logger.warning("RESEND_API_KEY not set — password reset email not sent to %s", to_email)
        return False

    subject = "Reset your Chartr password"
    html_body = f"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
             background: #f4f4f5; margin: 0; padding: 32px;">
  <div style="max-width: 480px; margin: 0 auto; background: #fff;
              border-radius: 12px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,.08);">
    <div style="font-size: 22px; font-weight: 700; color: #1a1a2e; margin-bottom: 8px;">
      Chartr
    </div>
    <p style="color: #6b7280; font-size: 14px; margin-top: 0;">Clinical AI for Doctors</p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
    <p style="font-size: 15px; color: #111827;">Hi {doctor_name},</p>
    <p style="font-size: 15px; color: #374151; line-height: 1.6;">
      We received a request to reset your Chartr password.
      Click the button below to set a new password. This link expires in <strong>1 hour</strong>.
    </p>
    <a href="{reset_url}"
       style="display: inline-block; margin: 24px 0; padding: 12px 28px;
              background: #2563eb; color: #fff; text-decoration: none;
              border-radius: 8px; font-size: 15px; font-weight: 600;">
      Reset Password
    </a>
    <p style="font-size: 13px; color: #9ca3af; line-height: 1.5;">
      If you didn't request this, you can safely ignore this email —
      your password won't change until you click the link above.
    </p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
    <p style="font-size: 12px; color: #d1d5db;">
      Chartr · Clinical AI for Indian Doctors
    </p>
  </div>
</body>
</html>
"""

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                _RESEND_URL,
                headers={
                    "Authorization": f"Bearer {settings.resend_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": f"Chartr <{settings.from_email}>",
                    "to": [to_email],
                    "subject": subject,
                    "html": html_body,
                },
            )
        if resp.status_code in (200, 201):
            logger.info("Password reset email sent to %s", to_email)
            return True
        else:
            logger.error("Resend returned %s for %s: %s", resp.status_code, to_email, resp.text)
            return False
    except Exception as e:
        logger.error("Failed to send password reset email to %s: %s", to_email, e)
        return False
