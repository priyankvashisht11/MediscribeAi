# backend/app/routers/ws.py

import asyncio
import logging
import time

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status

from app.config import settings
from app.services.asr import delete_audio_file, generate_temp_path, transcribe_audio_chunk

logger = logging.getLogger(__name__)

router = APIRouter()

# ── Active session tracker ────────────────────────────────────────────────────────
# Maps session_id (str) → WebSocket.
# Used to enforce the MAX_CONCURRENT_SESSIONS POC limit.
_active_sessions: dict[str, WebSocket] = {}


@router.websocket("/session/{session_id}")
async def audio_stream(websocket: WebSocket, session_id: str):
    """
    WebSocket endpoint: real-time audio streaming and transcription.

    CLIENT → SERVER: binary frames (audio/webm chunks, ~1s each from MediaRecorder)
    SERVER → CLIENT: JSON frames (one of the message types below)

    Server message types:
      {"type": "connected",        "session_id": "..."}
      {"type": "transcript_chunk", "session_id": "...", "text": "...", "speaker": "unknown",
       "start": 0.0, "end": 2.3,  "confidence": 0.85, "chunk_index": 1}
      {"type": "error",            "message": "..."}
      {"type": "session_ended",    "session_id": "..."}
    """

    # ── Enforce concurrent session limit ──────────────────────────────────────────
    if (
        len(_active_sessions) >= settings.max_concurrent_sessions
        and session_id not in _active_sessions
    ):
        await websocket.close(
            code=status.WS_1008_POLICY_VIOLATION,
            reason=f"POC limit: max {settings.max_concurrent_sessions} concurrent sessions.",
        )
        logger.warning(
            f"Rejected {session_id}: concurrent limit ({settings.max_concurrent_sessions}) reached."
        )
        return

    await websocket.accept()
    _active_sessions[session_id] = websocket
    logger.info(f"Session {session_id} connected. Active: {len(_active_sessions)}")
    await websocket.send_json({"type": "connected", "session_id": session_id})

    # ── Per-session state ─────────────────────────────────────────────────────────
    audio_buffer = bytearray()        # Accumulates raw WebM bytes from client
    buffer_start_time = time.time()   # Timestamp when current buffer window started
    chunk_index = 0                   # Sequential counter sent with each transcript chunk
    pending_temp_files: list[str] = [] # Cleanup tracker for crash safety

    try:
        while True:
            # Receive next binary frame from client (1s audio chunk from MediaRecorder)
            try:
                raw = await asyncio.wait_for(
                    websocket.receive_bytes(),
                    timeout=30.0,  # 30s idle timeout — client must send audio or we close
                )
            except asyncio.TimeoutError:
                logger.warning(f"Session {session_id}: 30s idle timeout. Closing.")
                break

            audio_buffer.extend(raw)
            elapsed = time.time() - buffer_start_time

            # Flush buffer to Whisper once enough audio has accumulated
            if elapsed >= settings.audio_chunk_buffer_seconds and len(audio_buffer) > 0:
                temp_path = generate_temp_path(session_id)
                pending_temp_files.append(temp_path)

                # Write buffer to disk
                with open(temp_path, "wb") as f:
                    f.write(audio_buffer)

                # Reset buffer immediately — new audio accumulates during transcription
                audio_buffer = bytearray()
                buffer_start_time = time.time()

                # Transcribe (runs in thread pool — non-blocking)
                try:
                    segments = await transcribe_audio_chunk(temp_path)
                except Exception as e:
                    logger.error(f"Session {session_id}: transcription error: {e}")
                    await websocket.send_json({
                        "type": "error",
                        "message": "Transcription failed for this chunk. Continuing...",
                    })
                    continue
                finally:
                    # DPDP Act compliance: always delete audio after processing
                    delete_audio_file(temp_path)
                    if temp_path in pending_temp_files:
                        pending_temp_files.remove(temp_path)

                # Stream each accepted segment back to client
                for seg in segments:
                    if not seg["text"]:
                        continue
                    chunk_index += 1
                    # Normalise avg_logprob (-2.0..0.0) to confidence score (0.0..1.0)
                    confidence = round(min(max(seg["avg_logprob"] + 2.0, 0.0), 1.0), 2)
                    await websocket.send_json({
                        "type": "transcript_chunk",
                        "session_id": session_id,
                        "text": seg["text"],
                        "speaker": "unknown",  # Sprint 2 adds pyannote diarization
                        "start": round(seg["start"], 2),
                        "end": round(seg["end"], 2),
                        "confidence": confidence,
                        "chunk_index": chunk_index,
                    })

    except WebSocketDisconnect:
        logger.info(f"Session {session_id}: client disconnected normally.")

    except Exception as e:
        logger.error(f"Session {session_id}: unexpected error: {e}", exc_info=True)
        try:
            await websocket.send_json({"type": "error", "message": "Internal server error."})
        except Exception:
            pass

    finally:
        _active_sessions.pop(session_id, None)
        logger.info(f"Session {session_id} closed. Active: {len(_active_sessions)}")

        # Crash safety: delete any temp files that weren't cleaned up during the session
        for path in pending_temp_files:
            delete_audio_file(path)

        # Best-effort session_ended notification
        try:
            await websocket.send_json({"type": "session_ended", "session_id": session_id})
        except Exception:
            pass
