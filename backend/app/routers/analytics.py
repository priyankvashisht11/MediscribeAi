from datetime import date, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import ClinicalNote, Session as SessionModel

router = APIRouter()


def _get_clinic_id(request: Request):
    return getattr(request.state, "clinic_id", None)


@router.get("/overview")
async def analytics_overview(
    request: Request,
    doctor_id: UUID | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(request)
    base = select(SessionModel)
    if clinic_id:
        base = base.where(SessionModel.clinic_id == clinic_id)
    if doctor_id:
        base = base.where(SessionModel.doctor_id == doctor_id)

    completed = base.where(SessionModel.status == "completed")

    total = await db.scalar(select(func.count()).select_from(completed.subquery()))

    today_start = date.today()
    sessions_today = await db.scalar(
        select(func.count()).select_from(
            completed.where(func.date(SessionModel.created_at) == today_start).subquery()
        )
    )

    # ISO week starts Monday (PostgreSQL date_trunc('week') returns Monday 00:00 UTC)
    week_start = func.date_trunc("week", func.now())
    sessions_this_week = await db.scalar(
        select(func.count()).select_from(
            completed.where(SessionModel.created_at >= week_start).subquery()
        )
    )

    # Average session duration in minutes
    duration_result = await db.scalar(
        select(
            func.avg(
                func.extract("epoch", SessionModel.ended_at - SessionModel.started_at) / 60
            )
        ).select_from(
            completed.where(
                SessionModel.started_at.isnot(None),
                SessionModel.ended_at.isnot(None),
            ).subquery()
        )
    )
    avg_duration = round(float(duration_result), 1) if duration_result else 0.0

    # Notes finalized this week
    note_where = [
        ClinicalNote.is_finalized.is_(True),
        SessionModel.created_at >= week_start,
    ]
    if clinic_id:
        note_where.append(SessionModel.clinic_id == clinic_id)
    if doctor_id:
        note_where.append(SessionModel.doctor_id == doctor_id)
    note_subq = (
        select(ClinicalNote.session_id)
        .join(SessionModel, ClinicalNote.session_id == SessionModel.id)
        .where(*note_where)
        .subquery()
    )
    notes_finalized_this_week = await db.scalar(
        select(func.count()).select_from(note_subq)
    )

    # Total distinct patients seen
    total_patients = await db.scalar(
        select(func.count(func.distinct(SessionModel.patient_name))).select_from(
            completed.subquery()
        )
    ) if hasattr(SessionModel, "patient_name") else 0

    # Busiest hour (0-23)
    busiest_row = await db.execute(
        select(
            func.extract("hour", SessionModel.created_at).label("hr"),
            func.count().label("cnt"),
        )
        .select_from(completed.subquery())
        .group_by("hr")
        .order_by(func.count().desc())
        .limit(1)
    )
    busiest = busiest_row.first()
    busiest_hour = int(busiest.hr) if busiest else None

    # Finalized notes percentage
    total_notes_where = []
    if clinic_id:
        total_notes_where.append(SessionModel.clinic_id == clinic_id)
    if doctor_id:
        total_notes_where.append(SessionModel.doctor_id == doctor_id)

    total_notes = await db.scalar(
        select(func.count()).select_from(
            select(ClinicalNote)
            .join(SessionModel, ClinicalNote.session_id == SessionModel.id)
            .where(*total_notes_where)
            .subquery()
        )
    )
    finalized_total = await db.scalar(
        select(func.count()).select_from(
            select(ClinicalNote)
            .join(SessionModel, ClinicalNote.session_id == SessionModel.id)
            .where(ClinicalNote.is_finalized.is_(True), *total_notes_where)
            .subquery()
        )
    )
    finalized_pct = round((finalized_total / total_notes) * 100, 1) if total_notes else 0.0

    return {
        "total_sessions": total or 0,
        "sessions_today": sessions_today or 0,
        "sessions_this_week": sessions_this_week or 0,
        "avg_session_duration_minutes": avg_duration,
        "notes_finalized_this_week": notes_finalized_this_week or 0,
        "total_patients_seen": total_patients or 0,
        "busiest_hour": busiest_hour,
        "finalized_notes_pct": finalized_pct,
    }


@router.get("/icd-breakdown")
async def icd_breakdown(
    request: Request,
    doctor_id: UUID | None = Query(default=None),
    limit: int = Query(default=10, le=20),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(request)
    # jsonb_array_elements requires raw SQL — ORM cannot express it cleanly
    sql = text("""
        SELECT
            elem->>'code'        AS code,
            elem->>'description' AS description,
            COUNT(*)             AS count
        FROM clinical_notes cn
        JOIN sessions s ON s.id = cn.session_id,
             jsonb_array_elements(cn.icd_codes) AS elem
        WHERE (:doctor_id IS NULL OR s.doctor_id = CAST(:doctor_id AS uuid))
          AND (:clinic_id IS NULL OR s.clinic_id = CAST(:clinic_id AS uuid))
          AND cn.icd_codes IS NOT NULL
          AND jsonb_array_length(cn.icd_codes) > 0
        GROUP BY code, description
        ORDER BY count DESC
        LIMIT :limit
    """)
    result = await db.execute(sql, {
        "doctor_id": str(doctor_id) if doctor_id else None,
        "clinic_id": str(clinic_id) if clinic_id else None,
        "limit": limit,
    })
    rows = result.fetchall()
    return [{"code": r.code, "description": r.description, "count": r.count} for r in rows]


@router.get("/sessions-by-day")
async def sessions_by_day(
    request: Request,
    doctor_id: UUID | None = Query(default=None),
    days: int = Query(default=30, le=90),
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(request)
    today = date.today()
    date_range = [today - timedelta(days=i) for i in range(days - 1, -1, -1)]

    sql = text("""
        SELECT DATE(created_at) AS day, COUNT(*) AS cnt
        FROM sessions
        WHERE status = 'completed'
          AND created_at >= :start
          AND (:doctor_id IS NULL OR doctor_id = CAST(:doctor_id AS uuid))
          AND (:clinic_id IS NULL OR clinic_id = CAST(:clinic_id AS uuid))
        GROUP BY day
    """)
    result = await db.execute(sql, {
        "start": date_range[0],
        "doctor_id": str(doctor_id) if doctor_id else None,
        "clinic_id": str(clinic_id) if clinic_id else None,
    })
    counts = {str(r.day): r.cnt for r in result.fetchall()}

    return [{"date": str(d), "count": counts.get(str(d), 0)} for d in date_range]
