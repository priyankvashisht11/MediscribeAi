# backend/app/services/asr.py

import asyncio
import logging
import os
import subprocess
import tempfile
from concurrent.futures import ThreadPoolExecutor

from faster_whisper import WhisperModel

from app.config import settings

logger = logging.getLogger(__name__)

# ── Module-level singletons ───────────────────────────────────────────────────
# Single-worker executor serialises CPU-bound Whisper calls.
# For production with GPU, replace with a model-per-worker pool.

_whisper_model: WhisperModel | None = None
_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="whisper-worker")


def load_model() -> None:
    """
    Load the Whisper model into memory.
    Called once from FastAPI lifespan on startup in a thread executor.
    Model is downloaded on first run and cached at ~/.cache/huggingface/hub/.
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
    print(f"[ASR] Whisper model '{settings.whisper_model_size}' loaded successfully.", flush=True)


def _transcribe_sync(audio_bytes: bytes) -> list[dict]:
    """
    Transcribe raw audio bytes (any format ffmpeg understands — fragmented WebM,
    fMP4, Opus, etc.) by piping through ffmpeg → 16kHz mono WAV → Whisper.

    Why this approach:
    - Browser MediaRecorder with timeslice=1000 produces fragmented WebM/MP4.
      Each blob after the first is a raw Cluster/fragment with no container header.
    - Writing these fragments directly to disk and passing to Whisper fails with
      "Invalid data found when processing input" (Errno 1094995529).
    - ffmpeg reads from stdin, detects the container format from the bytestream
      (not the file extension), correctly demuxes both fragmented WebM and fMP4,
      and outputs clean 16kHz mono PCM WAV to stdout.
    - We write only the WAV output to a temp file for Whisper — never the original
      audio bytes. The WAV is deleted immediately after transcription (DPDP compliance).
    """
    if _whisper_model is None:
        raise RuntimeError("Whisper model not loaded. Was load_model() called on startup?")

    if not audio_bytes:
        return []

    # ── Step 1: ffmpeg stdin → stdout, remux to 16kHz mono PCM WAV ──────────
    # NO -f input flag — let ffmpeg auto-detect from magic bytes.
    # This correctly handles both WebM (magic: 1a 45 df a3) and fMP4 (ftyp box)
    # from any browser without forcing the wrong demuxer.
    # -analyzeduration 0 + -probesize 32: only need 32 bytes to ID container
    # from magic bytes — avoids ffmpeg spending time probing the stream.
    ffmpeg_cmd = [
        "ffmpeg",
        "-hide_banner", "-loglevel", "error",
        "-analyzeduration", "0",  # Don't analyse duration
        "-probesize", "32",       # 32 bytes is enough to ID from magic bytes
        "-i", "pipe:0",           # read from stdin — auto-detect format
        "-vn",                    # ignore video streams if any
        "-f", "wav",              # output format: WAV
        "-ac", "1",               # mono
        "-ar", "16000",           # 16kHz — Whisper native sample rate
        "-acodec", "pcm_s16le",   # 16-bit PCM little-endian
        "pipe:1",                 # write to stdout
    ]

    try:
        result = subprocess.run(
            ffmpeg_cmd,
            input=audio_bytes,
            capture_output=True,
            timeout=15,
        )
    except subprocess.TimeoutExpired:
        logger.error("ffmpeg timed out processing audio chunk")
        return []

    if result.returncode != 0:
        logger.warning(
            f"ffmpeg error (returncode={result.returncode}): "
            f"{result.stderr.decode(errors='replace')[:300]}"
        )
        return []

    # WAV header alone is 44 bytes — anything less means empty/silent audio
    if len(result.stdout) < 44:
        logger.debug("ffmpeg produced no audio output — likely silence or empty chunk")
        return []

    # ── Step 2: Write WAV to temp file, transcribe, delete immediately ───────
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp.write(result.stdout)
            tmp_path = tmp.name

        segments, info = _whisper_model.transcribe(
            tmp_path,
            language=settings.whisper_language,
            beam_size=5,
            best_of=5,
            temperature=0.0,
            condition_on_previous_text=True,
            vad_filter=True,
            vad_parameters={
                "min_silence_duration_ms": 500,
                "speech_pad_ms": 200,
            },
            word_timestamps=False,
        )

        results = []
        for segment in segments:
            # Skip hallucinations — low avg_logprob = model was not confident
            if segment.avg_logprob < -1.5:
                logger.debug(
                    f"Skipping low-confidence segment "
                    f"(logprob={segment.avg_logprob:.2f}): '{segment.text}'"
                )
                continue
            results.append({
                "text": segment.text.strip(),
                "start": segment.start,
                "end": segment.end,
                "avg_logprob": segment.avg_logprob,
            })

        logger.info(f"Transcribed {len(results)} segment(s)")
        return results

    finally:
        # DPDP Act compliance: always delete WAV file after transcription
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
                logger.debug(f"Deleted WAV temp file: {tmp_path}")
            except Exception as e:
                logger.warning(f"Failed to delete temp WAV: {e}")


async def transcribe_audio_chunk(audio_bytes: bytes) -> list[dict]:
    """
    Async wrapper. Offloads CPU-bound transcription to ThreadPoolExecutor
    so it does NOT block the FastAPI async event loop.
    """
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(_executor, _transcribe_sync, audio_bytes)
