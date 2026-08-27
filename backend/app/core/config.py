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

    # --- SMTP (email_backend="smtp") ---
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""
    smtp_from_name: str = "SafeIQ"
    smtp_use_tls: bool = True

    # --- Sumsub (kyc_provider="sumsub") ---
    sumsub_app_token: str = ""
    sumsub_secret_key: str = ""
    sumsub_webhook_secret: str = ""
    sumsub_base_url: str = "https://api.sumsub.com"
    sumsub_level_name: str = "id-and-liveness"
    # When true, a webhook that fails signature verification is still allowed to move an
    # applicant to "approved". Only for local testing without the shared webhook secret.
    kyc_allow_unverified_webhook_approval: bool = False

    # --- OpenAI (onboarding_search_provider="llm") ---
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    openai_base_url: str = "https://api.openai.com/v1"

    # --- Cloudflare Turnstile (CAPTCHA). Verification middleware is not wired yet;
    # these are recognised so a full .env doesn't carry orphan keys. ---
    captcha_enabled: bool = False
    turnstile_site_key: str = ""
    turnstile_secret_key: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
