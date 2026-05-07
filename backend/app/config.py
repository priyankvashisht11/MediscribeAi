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


settings = Settings()
