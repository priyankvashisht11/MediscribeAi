# backend/app/routers/ws.py — Deepgram streaming integration
#
# Architecture:
#   browser → our WS → audio_queue → Deepgram WS (send_audio)
#                                  ← Deepgram WS (receive_transcripts) → browser
#
# No local ML inference. Deepgram handles ASR + diarization in the cloud.
# Latency: ~200ms end-to-end vs 8-15s with local Whisper+pyannote.

import asyncio
import json
import logging
import uuid

import websockets
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect, status

from app.config import settings
from app.routers.auth import decode_token, verify_token
from app.database import AsyncSessionLocal
from app.models.transcript import Transcript
from app.services.diarization import build_speaker_map, resolve_doctor_patient
from app.services.session_state import (
    append_session_segments,
    clear_session_state,
    get_speaker_map,
    set_speaker_map,
)

logger = logging.getLogger(__name__)
router = APIRouter()

_active_sessions: dict[str, WebSocket] = {}

DEEPGRAM_URL = (
    "wss://api.deepgram.com/v1/listen"
    "?model=nova-3"
    "&language=en-IN"
    "&diarize=true"
    "&punctuate=true"
    "&smart_format=true"
    "&interim_results=false"
    "&endpointing=300"
    "&filler_words=false"
)

# Sarvam Saaras v3 — Hindi/Hinglish specialist, <150ms TTFT
# language_code=unknown = auto-detect (handles Hinglish code-switching)
SARVAM_URL = (
    "wss://api.sarvam.ai/speech-to-text-streaming"
    "?language_code=unknown"
    "&model=saaras:v3"
    "&enable_formatting=true"
)


@router.websocket("/session/{session_id}")
async def audio_stream(
    websocket: WebSocket,
    session_id: str,
    token: str | None = Query(default=None),
    provider: str = Query(default="deepgram"),  # "deepgram" | "sarvam"
):
    # Auth gate: verify token from ?token= query param
    # (browsers cannot send custom headers on WebSocket upgrades)
    token_clinic_id = None
    if settings.secret_key:
        claims = decode_token(token or "")
        if claims is None:
            await websocket.close(code=4001, reason="Unauthorized")
            return
        token_clinic_id = claims.get("clinic_id")
    elif settings.access_pin:
        if not verify_token(token or ""):
            await websocket.close(code=4001, reason="Unauthorized")
            return

    # Verify session exists and belongs to the caller's clinic
    try:
        _session_uuid = uuid.UUID(session_id)
    except ValueError:
        await websocket.close(code=4004, reason="Session not found")
        return
    async with AsyncSessionLocal() as _db:
        from app.models import Session as SessionModel
        _session_obj = await _db.get(SessionModel, _session_uuid)
        if not _session_obj:
            await websocket.close(code=4004, reason="Session not found")
            return
        if token_clinic_id and str(_session_obj.clinic_id) != token_clinic_id:
            await websocket.close(code=4003, reason="Forbidden")
            return

    if (
        len(_active_sessions) >= settings.max_concurrent_sessions
        and session_id not in _active_sessions
    ):
        await websocket.close(
            code=status.WS_1008_POLICY_VIOLATION,
            reason=f"POC limit: max {settings.max_concurrent_sessions} concurrent sessions.",
        )
        logger.warning(f"Rejected {session_id}: concurrent limit reached.")
        return

    await websocket.accept()
    _active_sessions[session_id] = websocket
    logger.info(f"Session {session_id} connected. Active: {len(_active_sessions)}")

    # Shared state
    chunk_index = 0
    speaker_order: dict[int, str] = {}  # deepgram speaker int → SPEAKER_XX label

    # Queue carries raw WebM bytes from browser. None = sentinel (session ended).
    audio_queue: asyncio.Queue[bytes | None] = asyncio.Queue(maxsize=500)

    async def receive_loop() -> None:
        """Read binary audio frames from browser WebSocket → audio_queue."""
        try:
            await websocket.send_json({"type": "connected", "session_id": session_id})
            while True:
                try:
                    raw = await asyncio.wait_for(websocket.receive_bytes(), timeout=30.0)
                    try:
                        audio_queue.put_nowait(raw)
                    except asyncio.QueueFull:
                        logger.warning(f"Session {session_id}: audio queue full, dropping chunk.")
                except asyncio.TimeoutError:
                    logger.warning(f"Session {session_id}: 30s idle timeout, closing.")
                    break
        except WebSocketDisconnect:
            logger.info(f"Session {session_id}: client disconnected.")
        except Exception as e:
            logger.error(f"Session {session_id}: receive_loop error: {e}")
        finally:
            await audio_queue.put(None)

    async def deepgram_loop() -> None:
        """Open Deepgram streaming connection and bridge audio ↔ transcripts."""
        nonlocal chunk_index

        if not settings.deepgram_api_key:
            logger.error("DEEPGRAM_API_KEY not set — cannot start transcription.")
            await websocket.send_json({
                "type": "error",
                "message": "Transcription service not configured. Set DEEPGRAM_API_KEY.",
            })
            await audio_queue.put(None)
            return

        headers = {"Authorization": f"Token {settings.deepgram_api_key}"}

        try:
            async with websockets.connect(
                DEEPGRAM_URL,
                extra_headers=headers,
                ping_interval=20,
                ping_timeout=10,
            ) as dg_ws:
                logger.info(f"Session {session_id}: Deepgram connected.")

                async def send_audio() -> None:
                    """Drain audio_queue → Deepgram WebSocket."""
                    while True:
                        item = await audio_queue.get()
                        if item is None:
                            try:
                                await dg_ws.send(json.dumps({"type": "CloseStream"}))
                            except Exception:
                                pass
                            break
                        try:
                            await dg_ws.send(item)
                        except Exception as e:
                            logger.error(f"Session {session_id}: send to Deepgram failed: {e}")
                            break

                async def receive_transcripts() -> None:
                    """Receive Deepgram transcript events → forward to browser."""
                    nonlocal chunk_index
                    async for raw_msg in dg_ws:
                        try:
                            msg = json.loads(raw_msg)
                        except Exception:
                            continue

                        msg_type = msg.get("type", "")

                        if msg_type == "Results":
                            alt = msg.get("channel", {}).get("alternatives", [{}])[0]
                            transcript = alt.get("transcript", "").strip()
                            is_final = msg.get("is_final", False)

                            if not transcript or not is_final:
                                continue

                            # Map Deepgram speaker int → SPEAKER_XX
                            words = alt.get("words", [])
                            raw_speaker = "SPEAKER_00"
                            if words and words[0].get("speaker") is not None:
                                dg_speaker_int = words[0]["speaker"]
                                if dg_speaker_int not in speaker_order:
                                    idx = len(speaker_order)
                                    speaker_order[dg_speaker_int] = f"SPEAKER_{idx:02d}"
                                raw_speaker = speaker_order[dg_speaker_int]

                            start_time = words[0].get("start", 0.0) if words else 0.0
                            end_time = words[-1].get("end", 0.0) if words else 0.0

                            # Store segment in Redis so end-session note generation can read it
                            segment = {
                                "text": transcript,
                                "raw_speaker": raw_speaker,
                                "start": round(start_time, 2),
                                "end": round(end_time, 2),
                                "avg_logprob": -0.1,
                            }
                            all_segments = await append_session_segments(session_id, [segment])
                            current_map = await get_speaker_map(session_id)
                            new_map = build_speaker_map(
                                all_segments, current_map,
                                settings.speaker_assignment_window_seconds,
                            )
                            if new_map != current_map:
                                await set_speaker_map(session_id, new_map)

                            resolved_speaker = resolve_doctor_patient(raw_speaker, new_map)

                            # Persist to transcripts table so transcript viewer works post-session
                            try:
                                async with AsyncSessionLocal() as db:
                                    db.add(Transcript(
                                        id=uuid.uuid4(),
                                        session_id=uuid.UUID(session_id),
                                        speaker=resolved_speaker,
                                        text=transcript,
                                        start_time_ms=int(start_time * 1000),
                                        end_time_ms=int(end_time * 1000),
                                        confidence=0.95,
                                    ))
                                    await db.commit()
                            except Exception as db_err:
                                logger.warning(f"Session {session_id}: transcript DB write failed: {db_err}")

                            chunk_index += 1
                            try:
                                await websocket.send_json({
                                    "type": "transcript_chunk",
                                    "session_id": session_id,
                                    "text": transcript,
                                    "speaker": resolved_speaker,
                                    "start": round(start_time, 2),
                                    "end": round(end_time, 2),
                                    "confidence": 0.95,
                                    "chunk_index": chunk_index,
                                })
                            except Exception:
                                break

                        elif msg_type == "Error":
                            err_msg = msg.get("description", str(msg))
                            logger.error(f"Session {session_id}: Deepgram error: {err_msg}")
                            try:
                                await websocket.send_json({
                                    "type": "error",
                                    "message": f"Transcription error: {err_msg}",
                                })
                            except Exception:
                                pass

                        elif msg_type == "Metadata":
                            logger.info(f"Session {session_id}: Deepgram metadata: {msg}")

                await asyncio.gather(send_audio(), receive_transcripts())

        except websockets.exceptions.InvalidStatus as e:
            logger.error(f"Session {session_id}: Deepgram auth failed: {e}")
            try:
                await websocket.send_json({
                    "type": "error",
                    "message": "Transcription service auth failed. Check DEEPGRAM_API_KEY.",
                })
            except Exception:
                pass
        except Exception as e:
            logger.error(f"Session {session_id}: Deepgram connection error: {e}", exc_info=True)
            try:
                await websocket.send_json({
                    "type": "error",
                    "message": "Transcription service unavailable. Please end and restart the session.",
                })
            except Exception:
                pass

    async def sarvam_loop() -> None:
        """Open Sarvam Saaras v3 streaming connection and bridge PCM audio ↔ transcripts."""
        nonlocal chunk_index

        if not settings.sarvam_api_key:
            logger.error("SARVAM_API_KEY not set — cannot start Sarvam transcription.")
            await websocket.send_json({
                "type": "error",
                "message": "Sarvam not configured. Set SARVAM_API_KEY via flyctl secrets.",
            })
            await audio_queue.put(None)
            return

        headers = {"api-subscription-key": settings.sarvam_api_key}

        try:
            async with websockets.connect(
                SARVAM_URL,
                extra_headers=headers,
                ping_interval=20,
                ping_timeout=10,
            ) as sv_ws:
                logger.info(f"Session {session_id}: Sarvam connected.")

                async def send_audio_sarvam() -> None:
                    """Drain audio_queue → Sarvam WebSocket (expects raw PCM bytes)."""
                    while True:
                        item = await audio_queue.get()
                        if item is None:
                            break
                        try:
                            await sv_ws.send(item)
                        except Exception as e:
                            logger.error(f"Session {session_id}: send to Sarvam failed: {e}")
                            break

                async def receive_transcripts_sarvam() -> None:
                    """Receive Sarvam transcript events → normalize → forward to browser."""
                    nonlocal chunk_index
                    async for raw_msg in sv_ws:
                        try:
                            # Sarvam sends binary keepalives — skip non-string frames
                            if isinstance(raw_msg, bytes):
                                continue
                            msg = json.loads(raw_msg)
                        except Exception:
                            continue

                        # Sarvam response shape: {"transcript": "...", "is_final": true, "language_code": "hi-IN"}
                        transcript = (msg.get("transcript") or "").strip()
                        is_final = msg.get("is_final", False)

                        if not transcript or not is_final:
                            continue

                        # Sarvam streaming does not include speaker diarization —
                        # all chunks arrive as SPEAKER_00; build_speaker_map handles assignment
                        raw_speaker = "SPEAKER_00"

                        segment = {
                            "text": transcript,
                            "raw_speaker": raw_speaker,
                            "start": 0.0,
                            "end": 0.0,
                            "avg_logprob": -0.1,
                        }
                        all_segments = await append_session_segments(session_id, [segment])
                        current_map = await get_speaker_map(session_id)
                        new_map = build_speaker_map(
                            all_segments, current_map,
                            settings.speaker_assignment_window_seconds,
                        )
                        if new_map != current_map:
                            await set_speaker_map(session_id, new_map)

                        resolved_speaker = resolve_doctor_patient(raw_speaker, new_map)

                        try:
                            async with AsyncSessionLocal() as db:
                                db.add(Transcript(
                                    id=uuid.uuid4(),
                                    session_id=uuid.UUID(session_id),
                                    speaker=resolved_speaker,
                                    text=transcript,
                                    start_time_ms=0,
                                    end_time_ms=0,
                                    confidence=0.90,
                                ))
                                await db.commit()
                        except Exception as db_err:
                            logger.warning(f"Session {session_id}: Sarvam transcript DB write failed: {db_err}")

                        chunk_index += 1
                        try:
                            await websocket.send_json({
                                "type": "transcript_chunk",
                                "session_id": session_id,
                                "text": transcript,
                                "speaker": resolved_speaker,
                                "start": 0.0,
                                "end": 0.0,
                                "confidence": 0.90,
                                "chunk_index": chunk_index,
                                "provider": "sarvam",
                            })
                        except Exception:
                            break

                await asyncio.gather(send_audio_sarvam(), receive_transcripts_sarvam())

        except websockets.exceptions.InvalidStatus as e:
            logger.error(f"Session {session_id}: Sarvam auth failed: {e}")
            try:
                await websocket.send_json({
                    "type": "error",
                    "message": "Sarvam auth failed. Check SARVAM_API_KEY.",
                })
            except Exception:
                pass
        except Exception as e:
            logger.error(f"Session {session_id}: Sarvam connection error: {e}", exc_info=True)
            try:
                await websocket.send_json({
                    "type": "error",
                    "message": "Sarvam unavailable. Please end and restart the session.",
                })
            except Exception:
                pass

    # Route to the selected provider
    asr_loop = sarvam_loop if provider == "sarvam" else deepgram_loop

    try:
        await asyncio.gather(receive_loop(), asr_loop())
    except Exception as e:
        logger.error(f"Session {session_id}: unexpected error: {e}", exc_info=True)
    finally:
        _active_sessions.pop(session_id, None)
        logger.info(f"Session {session_id} closed. Active: {len(_active_sessions)}")
        try:
            await clear_session_state(session_id)
        except Exception:
            pass
        try:
            await websocket.send_json({"type": "session_ended", "session_id": session_id})
        except Exception:
            pass
