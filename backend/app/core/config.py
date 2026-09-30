from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://cloudbox:cloudbox@db:5432/cloudbox"
    allowed_origins: str = "http://localhost:8081,http://127.0.0.1:8081"
    secret_key: str = "change-this-development-secret-before-production"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
