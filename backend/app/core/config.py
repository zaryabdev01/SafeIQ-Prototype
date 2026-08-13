from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: str = "development"
    database_url: str = "postgresql+asyncpg://safeiq:safeiq@localhost:5432/safeiq"

    jwt_secret: str = "change-me-in-prod"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_minutes: int = 60 * 24 * 30
    onboarding_token_expire_minutes: int = 30

    cors_origins: str = "http://localhost:3000"

    email_backend: str = "console"
    kyc_provider: str = "mock"
    onboarding_search_provider: str = "keyword"

    otp_expire_minutes: int = 10
    invite_expire_days: int = 14
    magic_link_base_url: str = "http://localhost:3000/invite"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
