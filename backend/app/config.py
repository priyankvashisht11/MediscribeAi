from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    database_url: str = "postgresql+asyncpg://chartr:chartr_dev_secret@db:5432/chartr_db"

    # Redis
    redis_url: str = "redis://redis:6379/0"

    # App
    secret_key: str = ""  # REQUIRED in production — set via: flyctl secrets set SECRET_KEY=$(openssl rand -hex 32)
    environment: str = "development"

    # Sprint 10 auth
    seed_doctor_password: str = "demo1234"   # override via SEED_DOCTOR_PASSWORD env var
    frontend_url: str = "https://chartr-ai-eight.vercel.app"

    # ── LLM / Note Generation ──────────────────────────────────────────────────
    # Perplexity (primary) — uses OpenAI-compatible API
    perplexity_api_key: str = ""
    perplexity_model: str = "sonar-pro"
    # sonar-pro: Perplexity's best reasoning model. Strong structured JSON extraction.
    # r1-1776 was retired by Perplexity in mid-2026.
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

    # ── Sarvam ASR (Saaras v3) ─────────────────────────────────────────────────
    sarvam_api_key: str = ""
    # Get from: https://dashboard.sarvam.ai → API Keys
    # Set via: flyctl secrets set SARVAM_API_KEY=your_key --app mediscribe-api
    # Saaras v3: purpose-built for Hindi/Hinglish, <150ms TTFT, ₹30/hr

    # CORS — comma-separated list of allowed frontend origins
    # Dev default is localhost:3000. In production set to your Vercel URL.
    # Example: ALLOWED_ORIGINS=https://chartr.vercel.app,https://chartr.yourdomain.com
    allowed_origins: str = "http://localhost:3000"

    # ── Access PIN gate ────────────────────────────────────────────────────────
    access_pin: str = ""
    # Empty string = gate disabled (dev default). Set via:
    #   flyctl secrets set ACCESS_PIN="your_pin" --app chartr-api

    max_concurrent_sessions: int = 5
    # POC hard limit: 5 simultaneous doctor sessions.

    speaker_assignment_window_seconds: int = 60
    # Seconds of session audio used to determine doctor vs patient.
    # After this window the assignment is fixed for the rest of the session.

    # ── Email (password reset) ─────────────────────────────────────────────────
    resend_api_key: str = ""
    # Get from: https://resend.com → API Keys
    # Set via: flyctl secrets set RESEND_API_KEY=re_... --app chartr-api

    from_email: str = "noreply@getchartr.in"
    # Must be a verified sender domain in Resend

    # ── Razorpay Billing ───────────────────────────────────────────────────────
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    razorpay_webhook_secret: str = ""
    razorpay_plan_solo: str = ""
    razorpay_plan_clinic: str = ""

    # ── Vision AI (medical image + PDF analysis) ───────────────────────────────
    gemini_api_key: str = ""
    # Free tier: 1,500 req/day, 0 cost. Model: gemini-1.5-flash
    # Get key: https://aistudio.google.com/apikey (free Google account, takes 1 min)
    # Set via: flyctl secrets set GEMINI_API_KEY=AIza... --app mediscribe-api


settings = Settings()
