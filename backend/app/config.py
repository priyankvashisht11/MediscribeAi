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

    # ── LLM / Note Generation ──────────────────────────────────────────────────
    # Perplexity (primary) — uses OpenAI-compatible API
    perplexity_api_key: str = ""
    perplexity_model: str = "sonar-reasoning-pro"
    # sonar-reasoning-pro: Perplexity's best reasoning model for structured clinical extraction.
    perplexity_base_url: str = "https://api.perplexity.ai"

    # OpenAI (fallback)
    openai_api_key: str = ""
    openai_model: str = "gpt-4o"

    note_generation_timeout_seconds: int = 60

    note_generation_enabled: bool = True
    # Set to False to return stub note without calling any LLM.

    icd_db_path: str = "data/icd10_codes.db"

    # ── Deepgram ASR ───────────────────────────────────────────────────────────
    deepgram_api_key: str = ""
    # Get from: https://console.deepgram.com → Create API Key
    # Nova-3 model, Indian English, speaker diarization enabled

    # CORS — comma-separated list of allowed frontend origins
    # Dev default is localhost:3000. In production set to your Vercel URL.
    # Example: ALLOWED_ORIGINS=https://mediscribe.vercel.app,https://mediscribe.yourdomain.com
    allowed_origins: str = "http://localhost:3000"

    # ── Access PIN gate ────────────────────────────────────────────────────────
    access_pin: str = ""
    # Empty string = gate disabled (dev default). Set via:
    #   flyctl secrets set ACCESS_PIN="your_pin" --app mediscribe-api

    max_concurrent_sessions: int = 5
    # POC hard limit: 5 simultaneous doctor sessions.

    speaker_assignment_window_seconds: int = 60
    # Seconds of session audio used to determine doctor vs patient.
    # After this window the assignment is fixed for the rest of the session.


settings = Settings()
