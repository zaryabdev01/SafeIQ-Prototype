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
    # "keyword" | "llm" (OpenAI ranker) | "embedding" (cosine similarity + threshold)
    onboarding_search_provider: str = "keyword"
    # Minimum cosine similarity for a video to be returned by the "embedding" provider.
    # ~0.25 = loosely related, ~0.35+ = on topic. Tune against the real catalogue.
    onboarding_search_min_similarity: float = 0.30

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

    # --- OpenAI (onboarding_search_provider="llm" or "embedding") ---
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    openai_embedding_model: str = "text-embedding-3-small"
    openai_base_url: str = "https://api.openai.com/v1"

    # --- Onboarding media storage. "none" (default) is a no-op stub: the
    # upload-url endpoint 503s and video responses fall back to whatever
    # media_url the operator typed. "s3" enables presigned upload/playback.
    # Credentials come from the ECS task role by default; the *_access_key_id
    # / *_secret_access_key pair is a fallback only. ---
    media_storage_backend: str = "none"  # "none" | "s3"
    media_s3_bucket: str = ""
    media_s3_region: str = ""
    media_s3_prefix: str = "onboarding/"
    media_s3_access_key_id: str = ""
    media_s3_secret_access_key: str = ""
    media_cdn_domain: str = ""  # optional CloudFront domain for playback
    media_upload_ttl_seconds: int = 900
    media_url_ttl_seconds: int = 3600

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
