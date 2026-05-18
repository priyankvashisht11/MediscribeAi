# backend/app/routers/patients.py

import base64
import json
import logging
import re
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import ClinicalNote, Session
from app.models.patient import Patient
from app.models.patient_document import PatientDocument

logger = logging.getLogger(__name__)

router = APIRouter()


def _get_clinic_id(request: Request):
    return getattr(request.state, "clinic_id", None)


# ── Schemas ────────────────────────────────────────────────────────────────────

class PatientUpdate(BaseModel):
    name: str | None = None
    age: int | None = None
    gender: str | None = None
    phone: str | None = None
    blood_group: str | None = None
    known_allergies: str | None = None
    chronic_conditions: str | None = None
    address: str | None = None
    emergency_contact: str | None = None
    notes: str | None = None


def _patient_dict(p: Patient, visit_count: int = 0) -> dict:
    return {
        "id": str(p.id),
        "name": p.name,
        "age": p.age,
        "gender": p.gender,
        "phone": p.phone,
        "blood_group": p.blood_group,
        "known_allergies": p.known_allergies,
        "chronic_conditions": p.chronic_conditions,
        "address": p.address,
        "emergency_contact": p.emergency_contact,
        "notes": p.notes,
        "abha_id": p.abha_id,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "visit_count": visit_count,
    }


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/")
async def list_patients(
    request: Request,
    search: str | None = None,
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(request)
    query = select(Patient).order_by(Patient.name.asc())
    if clinic_id:
        query = query.where(Patient.clinic_id == clinic_id)
    if search:
        query = query.where(Patient.name.ilike(f"%{search}%"))

    total = (await db.execute(
        select(func.count()).select_from(query.subquery())
    )).scalar_one()

    rows = (await db.execute(
        query.offset((page - 1) * page_size).limit(page_size)
    )).scalars().all()

    # Get visit counts in one query
    if rows:
        patient_ids = [p.id for p in rows]
        counts_result = await db.execute(
            select(Session.patient_id, func.count().label("cnt"))
            .where(Session.patient_id.in_(patient_ids))
            .group_by(Session.patient_id)
        )
        visit_counts = {row.patient_id: row.cnt for row in counts_result}
    else:
        visit_counts = {}

    return {
        "items": [_patient_dict(p, visit_counts.get(p.id, 0)) for p in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, (total + page_size - 1) // page_size),
    }


@router.get("/{patient_id}")
async def get_patient(patient_id: UUID, request: Request, db: AsyncSession = Depends(get_db)):
    clinic_id = _get_clinic_id(request)
    patient = await db.get(Patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if clinic_id and patient.clinic_id != clinic_id:
        raise HTTPException(status_code=404, detail="Patient not found")

    visit_count = (await db.execute(
        select(func.count()).select_from(Session).where(Session.patient_id == patient_id)
    )).scalar_one()

    return _patient_dict(patient, visit_count)


@router.patch("/{patient_id}")
async def update_patient(
    patient_id: UUID,
    body: PatientUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(request)
    patient = await db.get(Patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if clinic_id and patient.clinic_id != clinic_id:
        raise HTTPException(status_code=404, detail="Patient not found")

    update_data = body.model_dump(exclude_none=True)
    for field, value in update_data.items():
        setattr(patient, field, value)

    await db.commit()

    # Invalidate analysis cache on patient update
    try:
        from app.services.redis_client import get_client
        redis = get_client()
        await redis.delete(f"patient_analysis:{patient_id}")
    except Exception:
        pass

    visit_count = (await db.execute(
        select(func.count()).select_from(Session).where(Session.patient_id == patient_id)
    )).scalar_one()

    return _patient_dict(patient, visit_count)


@router.get("/{patient_id}/sessions")
async def get_patient_sessions(
    patient_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Return all sessions for a patient with their finalized notes."""
    clinic_id = _get_clinic_id(request)
    patient = await db.get(Patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if clinic_id and patient.clinic_id != clinic_id:
        raise HTTPException(status_code=404, detail="Patient not found")

    sessions_q = select(Session).where(Session.patient_id == patient_id)
    if clinic_id:
        sessions_q = sessions_q.where(Session.clinic_id == clinic_id)
    result = await db.execute(sessions_q.order_by(Session.created_at.desc()))
    sessions = result.scalars().all()

    items = []
    for s in sessions:
        note_result = await db.execute(
            select(ClinicalNote).where(ClinicalNote.session_id == s.id)
        )
        note = note_result.scalar_one_or_none()

        duration = None
        if s.started_at and s.ended_at:
            duration = int((s.ended_at - s.started_at).total_seconds())

        items.append({
            "id": str(s.id),
            "status": s.status,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "started_at": s.started_at.isoformat() if s.started_at else None,
            "ended_at": s.ended_at.isoformat() if s.ended_at else None,
            "duration_seconds": duration,
            "note": {
                "id": str(note.id),
                "status": note.status,
                "is_finalized": note.is_finalized,
                "chief_complaint": note.chief_complaint or "",
                "assessment": note.assessment or "",
                "icd_codes": note.icd_codes or [],
                "confidence_score": note.confidence_score or 0.0,
            } if note else None,
        })

    return {"items": items, "total": len(items)}


@router.post("/{patient_id}/documents")
async def upload_document(
    patient_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    file: UploadFile = File(...),
    doc_type: str = Form("other"),
    description: str = Form(""),
):
    clinic_id = _get_clinic_id(request)
    patient = await db.get(Patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if clinic_id and patient.clinic_id != clinic_id:
        raise HTTPException(status_code=404, detail="Patient not found")

    MAX_SIZE = 10 * 1024 * 1024  # 10MB
    file_data = await file.read()
    if len(file_data) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Maximum 10MB.")

    doctor_id = getattr(request.state, "doctor_id", None)

    doc = PatientDocument(
        patient_id=patient_id,
        clinic_id=clinic_id,
        uploaded_by=doctor_id,
        filename=file.filename,
        doc_type=doc_type,
        description=description.strip() or None,
        content_type=file.content_type,
        file_size=len(file_data),
        file_data=file_data,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    # Invalidate analysis cache so the "new documents" flag fires
    try:
        from app.services.redis_client import get_client
        redis = get_client()
        await redis.delete(f"patient_analysis:{patient_id}")
    except Exception:
        pass

    return _doc_meta(doc)


@router.get("/{patient_id}/documents")
async def list_documents(
    patient_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(request)
    patient = await db.get(Patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if clinic_id and patient.clinic_id != clinic_id:
        raise HTTPException(status_code=404, detail="Patient not found")

    result = await db.execute(
        select(PatientDocument)
        .where(PatientDocument.patient_id == patient_id)
        .order_by(PatientDocument.uploaded_at.desc())
    )
    docs = result.scalars().all()
    return {"items": [_doc_meta(d) for d in docs]}


@router.get("/{patient_id}/documents/{doc_id}/download")
async def download_document(
    patient_id: UUID,
    doc_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(request)
    doc = await db.get(PatientDocument, doc_id)
    if not doc or doc.patient_id != patient_id:
        raise HTTPException(status_code=404, detail="Document not found")
    if clinic_id and doc.clinic_id != clinic_id:
        raise HTTPException(status_code=404, detail="Document not found")

    return Response(
        content=doc.file_data,
        media_type=doc.content_type or "application/octet-stream",
        headers={"Content-Disposition": f'inline; filename="{doc.filename}"'},
    )


@router.delete("/{patient_id}/documents/{doc_id}")
async def delete_document(
    patient_id: UUID,
    doc_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    clinic_id = _get_clinic_id(request)
    doc = await db.get(PatientDocument, doc_id)
    if not doc or doc.patient_id != patient_id:
        raise HTTPException(status_code=404, detail="Document not found")
    if clinic_id and doc.clinic_id != clinic_id:
        raise HTTPException(status_code=404, detail="Document not found")

    await db.delete(doc)
    await db.commit()

    # Invalidate analysis cache
    try:
        from app.services.redis_client import get_client
        redis = get_client()
        await redis.delete(f"patient_analysis:{patient_id}")
    except Exception:
        pass

    return {"deleted": True, "doc_id": str(doc_id)}


def _doc_meta(d: PatientDocument) -> dict:
    return {
        "id": str(d.id),
        "filename": d.filename,
        "doc_type": d.doc_type,
        "description": d.description,
        "content_type": d.content_type,
        "file_size": d.file_size,
        "uploaded_at": d.uploaded_at.isoformat() if d.uploaded_at else None,
        "uploaded_by": str(d.uploaded_by) if d.uploaded_by else None,
    }


@router.get("/{patient_id}/analysis")
async def get_patient_analysis(
    patient_id: UUID,
    request: Request,
    force: bool = False,
    db: AsyncSession = Depends(get_db),
):
    """
    Longitudinal health analysis using finalized notes + uploaded documents.
    Cached in Redis for 1 hour. Pass ?force=true to bypass cache and re-run.
    """
    clinic_id = _get_clinic_id(request)
    patient = await db.get(Patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if clinic_id and patient.clinic_id != clinic_id:
        raise HTTPException(status_code=404, detail="Patient not found")

    cache_key = f"patient_analysis:{patient_id}"

    # Try cache first (skip if force=true)
    if not force:
        try:
            from app.services.redis_client import get_client
            redis = get_client()
            cached = await redis.get(cache_key)
            if cached:
                cached_data = json.loads(cached)
                # Check if new documents uploaded since analysis was generated
                generated_at_str = cached_data.get("generated_at")
                if generated_at_str:
                    generated_at = datetime.fromisoformat(generated_at_str)
                    latest_doc = (await db.execute(
                        select(PatientDocument.uploaded_at)
                        .where(PatientDocument.patient_id == patient_id)
                        .order_by(PatientDocument.uploaded_at.desc())
                        .limit(1)
                    )).scalar_one_or_none()
                    cached_data["new_documents_since_analysis"] = bool(
                        latest_doc and latest_doc > generated_at
                    )
                return cached_data
        except Exception:
            pass

    # Fetch finalized notes
    notes_q = (
        select(ClinicalNote, Session)
        .join(Session, ClinicalNote.session_id == Session.id)
        .where(Session.patient_id == patient_id, ClinicalNote.is_finalized == True)
    )
    if clinic_id:
        notes_q = notes_q.where(Session.clinic_id == clinic_id)
    rows = (await db.execute(notes_q.order_by(Session.created_at.asc()))).all()

    # Fetch uploaded documents
    doc_rows = (await db.execute(
        select(PatientDocument)
        .where(PatientDocument.patient_id == patient_id)
        .order_by(PatientDocument.uploaded_at.asc())
    )).scalars().all()

    if not rows and not doc_rows:
        return {
            "patient_id": str(patient_id),
            "status": "no_data",
            "message": "No finalized notes found for this patient.",
            "analysis": None,
            "new_documents_since_analysis": False,
        }

    # Build visit history
    visits = []
    last_vitals = None
    for note, session in rows:
        visits.append({
            "date": session.created_at.strftime("%d %b %Y") if session.created_at else "Unknown",
            "chief_complaint": note.chief_complaint or "",
            "assessment": note.assessment or "",
            "plan": note.plan or "",
            "icd_codes": [c.get("code", "") + " " + c.get("description", "") for c in (note.icd_codes or [])],
        })
        if note.objective:
            last_vitals = note.objective

    visit_summary = "\n\n".join([
        f"Visit {i+1} ({v['date']}):\n"
        f"Chief Complaint: {v['chief_complaint']}\n"
        f"Assessment: {v['assessment']}\n"
        f"Plan: {v['plan']}\n"
        f"ICD Codes: {', '.join(v['icd_codes']) or 'None'}"
        for i, v in enumerate(visits)
    ])

    # Build documents section for prompt
    doc_summary = ""
    if doc_rows:
        doc_lines = []
        for i, d in enumerate(doc_rows):
            uploaded = d.uploaded_at.strftime("%d %b %Y") if d.uploaded_at else "Unknown"
            desc = f" — {d.description}" if d.description else ""
            doc_lines.append(f"{i+1}. {d.doc_type.replace('_', ' ').title()} | {d.filename} ({uploaded}){desc}")
        doc_summary = f"\n\nUPLOADED DOCUMENTS ({len(doc_rows)} files):\n" + "\n".join(doc_lines)

    patient_context = f"""Patient: {patient.name}, Age: {patient.age or 'Unknown'}, Gender: {patient.gender or 'Unknown'}
Known Allergies: {patient.known_allergies or 'None documented'}
Chronic Conditions: {patient.chronic_conditions or 'None documented'}
Blood Group: {patient.blood_group or 'Unknown'}"""

    prompt = f"""You are Chartr Clinical AI performing a longitudinal health analysis.

{patient_context}

VISIT HISTORY ({len(visits)} visits):
{visit_summary}{doc_summary}

Generate a structured health analysis in JSON with these exact keys:
{{
  "summary": "2-3 sentence overall health narrative incorporating visits and any uploaded documents",
  "recurring_issues": ["list of conditions seen in multiple visits"],
  "trend": "improving | stable | worsening | mixed",
  "risk_flags": ["list of clinical concerns worth monitoring"],
  "recommended_screenings": ["list of age/history-appropriate screenings"],
  "medication_patterns": ["patterns in prescriptions across visits"],
  "document_insights": ["key observations from uploaded documents, empty list if none"],
  "data_confidence": "high | medium | low",
  "last_vitals_summary": "brief summary of last recorded vitals or null"
}}

Respond ONLY with valid JSON. No explanation, no markdown fences."""

    try:
        from app.config import settings
        import httpx

        async with httpx.AsyncClient(timeout=90.0) as client:
            resp = await client.post(
                "https://api.perplexity.ai/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.perplexity_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "r1-1776",
                    "messages": [
                        {"role": "system", "content": "You are a clinical AI assistant. Always respond with valid JSON only."},
                        {"role": "user", "content": prompt},
                    ],
                    "max_tokens": 1500,
                    "temperature": 0.1,
                },
            )
            resp.raise_for_status()
            raw = resp.json()["choices"][0]["message"]["content"]

        raw = re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL).strip()
        json_match = re.search(r"\{.*\}", raw, re.DOTALL)
        if json_match:
            raw = json_match.group(0)
        analysis_data = json.loads(raw)

    except Exception as e:
        logger.error(f"Health analysis LLM failed for patient {patient_id}: {e}")
        analysis_data = {
            "summary": "Analysis temporarily unavailable.",
            "recurring_issues": [],
            "trend": "unknown",
            "risk_flags": [],
            "recommended_screenings": [],
            "medication_patterns": [],
            "document_insights": [],
            "data_confidence": "low",
            "last_vitals_summary": last_vitals,
            "error": str(e),
        }

    response = {
        "patient_id": str(patient_id),
        "status": "ready",
        "visit_count": len(visits),
        "document_count": len(doc_rows),
        "analysis": analysis_data,
        "last_vitals": last_vitals,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "new_documents_since_analysis": False,
    }

    # Cache for 1 hour
    try:
        redis = get_client()
        await redis.setex(cache_key, 3600, json.dumps(response))
    except Exception:
        pass

    return response
