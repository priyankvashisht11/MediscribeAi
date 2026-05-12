# backend/app/services/session_state.py
#
# Per-session diarization state stored in Redis:
#   - Cumulative aligned segments (for building the speaker map)
#   - Speaker map (once established, immutable for the session)
#   - Session time offset (converts per-chunk relative timestamps to session-absolute)

import json
import logging

from app.services.redis_client import get_client

logger = logging.getLogger(__name__)

_SEGMENTS_KEY = "session:{sid}:diarize_segments"
_SPEAKER_MAP_KEY = "session:{sid}:speaker_map"
_OFFSET_KEY = "session:{sid}:time_offset"
_TTL = 4 * 3600  # 4-hour TTL — longer than any realistic OPD session


async def get_session_segments(session_id: str) -> list[dict]:
    r = get_client()
    raw = await r.get(_SEGMENTS_KEY.format(sid=session_id))
    return json.loads(raw) if raw else []


async def append_session_segments(session_id: str, new_segments: list[dict]) -> list[dict]:
    """Append new segments to the cumulative list. Returns the updated full list."""
    r = get_client()
    existing = await get_session_segments(session_id)
    updated = existing + new_segments
    await r.setex(_SEGMENTS_KEY.format(sid=session_id), _TTL, json.dumps(updated))
    return updated


async def get_speaker_map(session_id: str) -> dict:
    r = get_client()
    raw = await r.get(_SPEAKER_MAP_KEY.format(sid=session_id))
    return json.loads(raw) if raw else {}


async def set_speaker_map(session_id: str, speaker_map: dict) -> None:
    r = get_client()
    await r.setex(_SPEAKER_MAP_KEY.format(sid=session_id), _TTL, json.dumps(speaker_map))


async def get_time_offset(session_id: str) -> float:
    """
    Returns cumulative audio duration processed so far for this session.
    Used to convert per-chunk relative timestamps to session-absolute timestamps.
    e.g. chunk 3 starts at 0.0s relative but is 6.0s into the session.
    """
    r = get_client()
    raw = await r.get(_OFFSET_KEY.format(sid=session_id))
    return float(raw) if raw else 0.0


async def increment_time_offset(session_id: str, duration_seconds: float) -> float:
    """Add chunk duration to cumulative offset. Returns new offset."""
    r = get_client()
    current = await get_time_offset(session_id)
    new_offset = current + duration_seconds
    await r.setex(_OFFSET_KEY.format(sid=session_id), _TTL, str(new_offset))
    return new_offset


async def clear_session_state(session_id: str) -> None:
    """Delete all diarization state for a session. Call on session end."""
    r = get_client()
    await r.delete(
        _SEGMENTS_KEY.format(sid=session_id),
        _SPEAKER_MAP_KEY.format(sid=session_id),
        _OFFSET_KEY.format(sid=session_id),
    )
