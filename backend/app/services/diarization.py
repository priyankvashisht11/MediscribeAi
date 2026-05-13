# backend/app/services/diarization.py
#
# Speaker mapping utilities used by the Deepgram WebSocket handler.
# All pyannote / local diarization code was removed when Deepgram took over
# ASR + diarization. Deepgram returns word-level speaker integers (0, 1, ...)
# which are mapped to SPEAKER_00 / SPEAKER_01 labels in ws.py, then resolved
# to "doctor" / "patient" here.

import logging

logger = logging.getLogger(__name__)


def resolve_doctor_patient(raw_speaker: str | None, speaker_map: dict) -> str:
    """Convert "SPEAKER_00"/"SPEAKER_01" to "doctor"/"patient" using the session's speaker_map."""
    if raw_speaker is None or not speaker_map:
        return "unknown"
    return speaker_map.get(raw_speaker, "unknown")


def build_speaker_map(
    all_segments_so_far: list[dict],
    existing_map: dict | None,
    window_seconds: int,
) -> dict:
    """
    Determine which raw speaker ID is the doctor and which is the patient.

    Heuristic: Within the first `window_seconds` of the session, the speaker
    with more total speaking time is the doctor. Clinically reliable — doctors
    dominate the opening of OPD visits (greetings, chief complaint query).

    Once a map is established (both speakers seen), it does not change.
    """
    if existing_map and len(existing_map) >= 2:
        return existing_map

    window_segs = [
        s for s in all_segments_so_far
        if s.get("raw_speaker") and s.get("start", 0) <= window_seconds
    ]

    if not window_segs:
        return existing_map or {}

    speaker_time: dict[str, float] = {}
    for seg in window_segs:
        spk = seg["raw_speaker"]
        duration = seg.get("end", seg.get("start", 0)) - seg.get("start", 0)
        speaker_time[spk] = speaker_time.get(spk, 0.0) + max(duration, 0.0)

    if len(speaker_time) < 2:
        # Only one speaker heard so far. If they've spoken for at least 15s assume
        # they're the doctor (doctors dominate OPD consultation openings).
        if window_segs:
            max_end = max(s.get("end", s.get("start", 0)) for s in window_segs)
            if max_end >= 15 and speaker_time:
                doctor_id = list(speaker_time.keys())[0]
                new_map = {doctor_id: "doctor"}
                logger.info(f"Single-speaker map (doctor assumed): {new_map}")
                return new_map
        return existing_map or {}

    # First speaker heard = doctor (OPD clinics: doctor always initiates)
    first_speaker = min(
        (s for s in window_segs if s.get("raw_speaker")),
        key=lambda s: s.get("start", float("inf")),
    )["raw_speaker"]
    other_speakers = [spk for spk in speaker_time if spk != first_speaker]
    doctor_id = first_speaker
    patient_id = other_speakers[0]

    new_map = {doctor_id: "doctor", patient_id: "patient"}
    logger.info(f"Speaker map built: {new_map} (time: {speaker_time})")
    return new_map
