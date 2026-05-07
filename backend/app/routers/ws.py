# backend/app/routers/ws.py

import asyncio
import logging
import time

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status

from app.config import settings
from app.services.asr import transcribe_audio_chunk

logger = logging.getLogger(__name__)

router = APIRouter()

# Maps session_id → WebSocket for concurrent session limit enforcement
_active_sessions: dict[str, WebSocket] = {}


@router.websocket("/session/{session_id}")
async def audio_stream(websocket: WebSocket, session_id: str):
    """
    WebSocket endpoint: real-time audio streaming and transcription.

    CLIENT → SERVER: binary frames (audio/webm chunks, ~1s each from MediaRecorder)
    SERVER → CLIENT: JSON frames

    WebM fragmentation strategy:
    - MediaRecorder(timeslice=1000) produces fragmented WebM.
    - Chunk 0: EBML header + Segment + Tracks + Cluster #1  (initialization + first audio)
    - Chunk N: Cluster #N only  (raw audio, no header)
    - To decode any window of audio, we must prepend the initialization header.
    - We store chunk 0 as `webm_init` and prepend it to every flush buffer.
    - This gives ffmpeg a complete, decodable WebM stream every time.
    """

    # ── Enforce concurrent session limit ──────────────────────────────────────
    if (
        len(_active_sessions) >= settings.max_concurrent_sessions
        and session_id not in _active_sessions
    ):
        await websocket.close(
            code=status.WS_1008_POLICY_VIOLATION,
            reason=f"POC limit: max {settings.max_concurrent_sessions} concurrent sessions.",
        )
        logger.warning(
            f"Rejected {session_id}: concurrent limit "
            f"({settings.max_concurrent_sessions}) reached."
        )
        return

    await websocket.accept()
    _active_sessions[session_id] = websocket
    logger.info(f"Session {session_id} connected. Active: {len(_active_sessions)}")
    await websocket.send_json({"type": "connected", "session_id": session_id})

    # ── Per-session state ─────────────────────────────────────────────────────
    audio_buffer = bytearray()       # Accumulates cluster chunks (no header)
    buffer_start_time = time.time()
    chunk_index = 0
    webm_init: bytes | None = None   # First chunk = WebM init segment (header)

    try:
        while True:
            try:
                raw = await asyncio.wait_for(
                    websocket.receive_bytes(),
                    timeout=30.0,
                )
            except asyncio.TimeoutError:
                logger.warning(f"Session {session_id}: 30s idle timeout. Closing.")
                break

            # First chunk contains the WebM initialization segment.
            # Store it separately — prepend to every flush so ffmpeg always
            # receives a complete, decodable WebM stream.
            if webm_init is None:
                webm_init = bytes(raw)
                logger.info(
                    f"Session {session_id}: captured WebM init segment "
                    f"({len(webm_init)} bytes)"
                )
                # Don't add init to audio_buffer — it will be prepended on flush
                buffer_start_time = time.time()
                continue

            audio_buffer.extend(raw)
            elapsed = time.time() - buffer_start_time

            # Flush to Whisper once enough audio has accumulated
            if elapsed >= settings.audio_chunk_buffer_seconds and len(audio_buffer) > 0:
                # Build a complete WebM: init segment + accumulated clusters
                chunk_bytes = webm_init + bytes(audio_buffer)
                audio_buffer = bytearray()
                buffer_start_time = time.time()

                logger.debug(
                    f"Session {session_id}: flushing {len(chunk_bytes)} bytes to Whisper"
                )

                try:
                    segments = await transcribe_audio_chunk(chunk_bytes)
                except Exception as e:
                    logger.error(f"Session {session_id}: transcription error: {e}")
                    await websocket.send_json({
                        "type": "error",
                        "message": "Transcription failed for this chunk. Continuing...",
                    })
                    continue

                for seg in segments:
                    if not seg["text"]:
                        continue
                    chunk_index += 1
                    confidence = round(min(max(seg["avg_logprob"] + 2.0, 0.0), 1.0), 2)
                    await websocket.send_json({
                        "type": "transcript_chunk",
                        "session_id": session_id,
                        "text": seg["text"],
                        "speaker": "unknown",
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
        try:
            await websocket.send_json({"type": "session_ended", "session_id": session_id})
        except Exception:
            pass
