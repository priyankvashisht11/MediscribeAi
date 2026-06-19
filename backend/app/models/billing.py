import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    clinic_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("clinics.id"), nullable=False, unique=True)

    # Plan: free | solo | clinic
    plan: Mapped[str] = mapped_column(String(20), default="free", nullable=False)

    # Razorpay subscription ID (null for free/trial)
    razorpay_subscription_id: Mapped[str] = mapped_column(String(100), nullable=True)

    # Status: trialing | active | past_due | cancelled | free
    status: Mapped[str] = mapped_column(String(20), default="trialing", nullable=False)

    # Trial end date (30 days from signup)
    trial_ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)

    # Current paid period end (null if free/trialing)
    current_period_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class UsageLog(Base):
    __tablename__ = "usage_logs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    clinic_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("clinics.id"), nullable=False)

    # YYYY-MM format, e.g. "2026-06"
    month: Mapped[str] = mapped_column(String(7), nullable=False)

    session_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
