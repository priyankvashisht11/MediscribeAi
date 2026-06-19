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

    # Total distinct patients seen (by patient_id FK)
    total_patients = await db.scalar(
        select(func.count(func.distinct(SessionModel.patient_id))).select_from(
            completed.subquery()
        )
    )

    # Busiest hour in IST (UTC+5:30) using raw SQL for interval safety
    # Use NULLIF('', '') pattern to avoid asyncpg AmbiguousParameterError with NULL params
    bh_sql = text("""
        SELECT EXTRACT(HOUR FROM created_at + INTERVAL '330 minutes') AS hr, COUNT(*) AS cnt
        FROM sessions
        WHERE status = 'completed'
          AND (NULLIF(:doctor_id, '') IS NULL OR doctor_id::text = :doctor_id)
          AND (NULLIF(:clinic_id, '') IS NULL OR clinic_id::text = :clinic_id)
        GROUP BY 1 ORDER BY cnt DESC LIMIT 1
    """)
    bh_result = await db.execute(bh_sql, {
        "doctor_id": str(doctor_id) if doctor_id else '',
        "clinic_id": str(clinic_id) if clinic_id else '',
    })
    bh_row = bh_result.first()
    busiest_hour = int(float(bh_row.hr)) if bh_row else None

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

    # Sessions this month
    month_start = date.today().replace(day=1)
    sessions_this_month = await db.scalar(
        select(func.count()).select_from(
            completed.where(func.date(SessionModel.created_at) >= month_start).subquery()
        )
    )

    return {
        "total_sessions": total or 0,
        "sessions_today": sessions_today or 0,
        "sessions_this_week": sessions_this_week or 0,
        "sessions_this_month": sessions_this_month or 0,
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
        WHERE (NULLIF(:doctor_id, '') IS NULL OR s.doctor_id::text = :doctor_id)
          AND (NULLIF(:clinic_id, '') IS NULL OR s.clinic_id::text = :clinic_id)
          AND cn.icd_codes IS NOT NULL
          AND jsonb_array_length(cn.icd_codes) > 0
        GROUP BY code, description
        ORDER BY count DESC
        LIMIT :limit
    """)
    result = await db.execute(sql, {
        "doctor_id": str(doctor_id) if doctor_id else '',
        "clinic_id": str(clinic_id) if clinic_id else '',
        "limit": limit,
    })
    rows = result.fetchall()
    return [{"code": r.code, "description": r.description, "count": r.count} for r in rows]


@router.get("/doctor-breakdown")
async def doctor_breakdown(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Per-doctor stats for the current clinic — used in the Analytics doctor table."""
    from app.models import Doctor
    clinic_id = _get_clinic_id(request)
    if not clinic_id:
        return []

    sql = text("""
        SELECT
            d.id,
            d.name,
            d.specialty,
            COUNT(DISTINCT s.id)                                            AS total_sessions,
            COUNT(DISTINCT s.patient_id)                                    AS unique_patients,
            ROUND(AVG(EXTRACT(EPOCH FROM (s.ended_at - s.started_at))/60)::numeric, 1)
                                                                            AS avg_duration_min,
            COUNT(DISTINCT cn.id) FILTER (WHERE cn.is_finalized = TRUE)    AS notes_finalized,
            MAX(s.created_at)                                               AS last_session_at
        FROM doctors d
        LEFT JOIN sessions s   ON s.doctor_id  = d.id
                               AND s.clinic_id = :clinic_id
                               AND s.status    = 'completed'
        LEFT JOIN clinical_notes cn ON cn.session_id = s.id
        WHERE d.clinic_id = :clinic_id
          AND d.is_active  = TRUE
        GROUP BY d.id, d.name, d.specialty
        ORDER BY total_sessions DESC
    """)
    rows = (await db.execute(sql, {"clinic_id": str(clinic_id)})).fetchall()
    return [
        {
            "id":               str(r.id),
            "name":             r.name,
            "specialty":        r.specialty,
            "total_sessions":   r.total_sessions or 0,
            "unique_patients":  r.unique_patients or 0,
            "avg_duration_min": float(r.avg_duration_min) if r.avg_duration_min else 0.0,
            "notes_finalized":  r.notes_finalized or 0,
            "last_session_at":  r.last_session_at.isoformat() if r.last_session_at else None,
        }
        for r in rows
    ]


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
          AND (NULLIF(:doctor_id, '') IS NULL OR doctor_id::text = :doctor_id)
          AND (NULLIF(:clinic_id, '') IS NULL OR clinic_id::text = :clinic_id)
        GROUP BY day
    """)
    result = await db.execute(sql, {
        "start": date_range[0],
        "doctor_id": str(doctor_id) if doctor_id else '',
        "clinic_id": str(clinic_id) if clinic_id else '',
    })
    counts = {str(r.day): r.cnt for r in result.fetchall()}

    return [{"date": str(d), "count": counts.get(str(d), 0)} for d in date_range]


@router.get("/sessions-by-weekday")
async def sessions_by_weekday(
    request: Request,
    doctor_id: UUID | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Sessions count grouped by day of week (IST), returned Mon–Sun."""
    clinic_id = _get_clinic_id(request)
    # PostgreSQL DOW: 0=Sunday … 6=Saturday; we remap to Mon=0…Sun=6 for display
    sql = text("""
        SELECT
            EXTRACT(DOW FROM created_at + INTERVAL '330 minutes') AS dow,
            COUNT(*) AS cnt
        FROM sessions
        WHERE status = 'completed'
          AND (NULLIF(:doctor_id, '') IS NULL OR doctor_id::text = :doctor_id)
          AND (NULLIF(:clinic_id, '') IS NULL OR clinic_id::text = :clinic_id)
        GROUP BY 1
    """)
    result = await db.execute(sql, {
        "doctor_id": str(doctor_id) if doctor_id else '',
        "clinic_id": str(clinic_id) if clinic_id else '',
    })
    # EXTRACT returns float; convert to int for dict key
    counts = {int(float(row.dow)): int(row.cnt) for row in result.fetchall()}

    # PG DOW: 0=Sun,1=Mon,...,6=Sat → reorder Mon-Sun (1,2,3,4,5,6,0)
    days = [
        {"day": "Mon", "count": counts.get(1, 0)},
        {"day": "Tue", "count": counts.get(2, 0)},
        {"day": "Wed", "count": counts.get(3, 0)},
        {"day": "Thu", "count": counts.get(4, 0)},
        {"day": "Fri", "count": counts.get(5, 0)},
        {"day": "Sat", "count": counts.get(6, 0)},
        {"day": "Sun", "count": counts.get(0, 0)},
    ]
    return days
