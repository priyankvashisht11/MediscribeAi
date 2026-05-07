from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    database_url: str = "postgresql+asyncpg://mediscribe:mediscribe_dev_secret@db:5432/mediscribe_db"

    # Redis
    redis_url: str = "redis://redis:6379/0"

    # App
    secret_key: str = "change_me_in_production"
    environment: str = "development"

    # LLM (stub)
    openai_api_key: str = "sk-placeholder"

    # ── ASR Configuration ──────────────────────────────────────────────────────
    whisper_model_size: str = "medium"
    # Options: tiny | base | small | medium | large-v3
    # POC default: "medium" — good Hinglish accuracy, runs on CPU in ~2-4s per chunk
    # Upgrade path: "large-v3" on GPU for production

    whisper_device: str = "cpu"
    # Options: "cpu" | "cuda" | "auto"
    # POC: always "cpu" — no GPU assumed in dev

    whisper_compute_type: str = "int8"
    # "int8"    = fastest on CPU, minimal quality loss  ← use this for POC
    # "float16" = GPU only
    # "float32" = highest quality, slowest on CPU

    whisper_language: str = "hi"
    # "hi" handles Hinglish better than "en" because Indian speakers
    # code-switch from a Hindi base, not an English base.

    audio_chunk_buffer_seconds: int = 3
    # Minimum seconds of audio to accumulate before sending to Whisper.
    # 3s = POC sweet spot: low enough latency, enough context for accuracy.

    audio_temp_dir: str = "/tmp/mediscribe_audio"
    # Temporary directory for audio chunk files.
    # Files are deleted immediately after transcription (DPDP Act compliance).

    max_concurrent_sessions: int = 5
    # POC hard limit: 5 simultaneous doctor sessions.


settings = Settings()
