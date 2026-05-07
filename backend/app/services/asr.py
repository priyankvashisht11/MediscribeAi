# backend/app/services/asr.py

import asyncio
import logging
import os
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from faster_whisper import WhisperModel

from app.config import settings

logger = logging.getLogger(__name__)

# ── Module-level singletons ───────────────────────────────────────────────────────
# Loaded once at startup via load_model(). Shared across all sessions.
# WhisperModel is NOT thread-safe for concurrent .transcribe() calls,
# so we use a single-worker ThreadPoolExecutor to serialise CPU work.
# For production (5+ concurrent sessions with GPU), replace with a model-per-worker pool.

_whisper_model: WhisperModel | None = None
_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="whisper-worker")


def load_model() -> None:
    """
    Load the Whisper model into memory.
    Called once from FastAPI lifespan on startup — blocks in a thread so startup
    remains non-blocking for the rest of the app.
    Model is downloaded on first run (~1.5GB for medium) and cached at
    ~/.cache/huggingface/hub/. Subsequent startups load from cache (~15s).
    """
    global _whisper_model
    logger.info(
        f"Loading Whisper model: size={settings.whisper_model_size} "
        f"device={settings.whisper_device} compute_type={settings.whisper_compute_type}"
    )
    _whisper_model = WhisperModel(
        settings.whisper_model_size,
        device=settings.whisper_device,
        compute_type=settings.whisper_compute_type,
    )
    logger.info("Whisper model loaded and ready.")

    # Ensure temp audio directory exists
    Path(settings.audio_temp_dir).mkdir(parents=True, exist_ok=True)
    logger.info(f"Audio temp dir ready: {settings.audio_temp_dir}")


def _transcribe_sync(audio_path: str) -> list[dict]:
    """
    Synchronous transcription. Runs inside ThreadPoolExecutor.
    Returns list of segment dicts: [{text, start, end, avg_logprob}, ...]

    VAD filter skips silent segments — important for clinic audio where
    pauses between sentences are common and should not produce transcription noise.
    """
    if _whisper_model is None:
        raise RuntimeError("Whisper model not loaded. Was load_model() called on startup?")

    segments, info = _whisper_model.transcribe(
        audio_path,
        language=settings.whisper_language,
        beam_size=5,
        best_of=5,
        temperature=0.0,               # Greedy decoding — deterministic output
        condition_on_previous_text=True, # Use prior context for better consistency
        vad_filter=True,               # Skip silent audio segments
        vad_parameters={
            "min_silence_duration_ms": 500,
            "speech_pad_ms": 200,
        },
        word_timestamps=False,         # Sprint 1: disabled. Sprint 2 enables for diarization.
    )

    results = []
    for segment in segments:
        # Filter hallucinations — Whisper sometimes generates text for silence.
        # avg_logprob < -1.5 indicates the model was not confident: skip.
        if segment.avg_logprob < -1.5:
            logger.debug(
                f"Skipping low-confidence segment (logprob={segment.avg_logprob:.2f}): '{segment.text}'"
            )
            continue
        results.append({
            "text": segment.text.strip(),
            "start": segment.start,
            "end": segment.end,
            "avg_logprob": segment.avg_logprob,
        })

    logger.info(f"Transcribed {len(results)} segment(s) from {audio_path}")
    return results


async def transcribe_audio_chunk(audio_path: str) -> list[dict]:
    """
    Async wrapper. Offloads CPU-bound transcription to ThreadPoolExecutor
    so it does NOT block the FastAPI async event loop.
    Called from the WebSocket handler.
    """
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(_executor, _transcribe_sync, audio_path)


def delete_audio_file(audio_path: str) -> None:
    """
    Delete audio file immediately after transcription.
    DPDP Act requirement: audio must not be retained after processing.
    """
    try:
        os.remove(audio_path)
        logger.debug(f"Deleted audio chunk: {audio_path}")
    except FileNotFoundError:
        logger.warning(f"Audio file already gone: {audio_path}")
    except Exception as e:
        logger.error(f"Failed to delete audio file {audio_path}: {e}")


def generate_temp_path(session_id: str) -> str:
    """
    Generate a unique temp file path for one audio chunk.
    Pattern: /tmp/mediscribe_audio/{session_id}_{8char_uuid}.webm
    """
    chunk_id = uuid.uuid4().hex[:8]
    return os.path.join(settings.audio_temp_dir, f"{session_id}_{chunk_id}.webm")
