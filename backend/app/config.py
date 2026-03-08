from pydantic_settings import BaseSettings
from typing import List, Optional

class Settings(BaseSettings):
    # Environment
    CATSHY_ENV: str = "development"
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://catshy:catshy_secret@localhost:5432/catshy"
    DATABASE_URL_SYNC: str = "postgresql://catshy:catshy_secret@localhost:5432/catshy"
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    # Auth
    JWT_SECRET: str = "CHANGE_ME_IN_PRODUCTION_USE_openssl_rand_hex_64"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    # Cookie
    COOKIE_DOMAIN: Optional[str] = None
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:8080", "http://localhost:3000", "http://localhost:5173",
        "http://127.0.0.1:8080", "http://127.0.0.1:5173",
    ]
    CORS_EXTRA_ORIGINS: List[str] = []
    # SSRF
    SSRF_DENY_PRIVATE: bool = True
    SSRF_TIMEOUT: int = 15
    SSRF_ALLOWLIST: List[str] = []
    # Celery
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"
    # Features
    ENABLE_TOR: bool = False
    REPORT_COMPANY_NAME: str = "CATSHY"
    # Enrichment
    VIRUSTOTAL_API_KEY: str = ""
    SHODAN_API_KEY: str = ""
    ABUSEIPDB_API_KEY: str = ""
    OTX_API_KEY: str = ""
    # Admin
    ADMIN_EMAIL: str = ""
    ADMIN_PASSWORD: str = ""
    ADMIN_NAME: str = "Admin"
    ADMIN_FORCE_CHANGE_PASSWORD: bool = False
    DEV_AUTO_ADMIN: bool = False
    SYSTEM_OWNER_REQUIRE_MFA: bool = True
    # SMTP
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASS: str = ""
    SMTP_FROM_NAME: str = "CATSHY"
    SMTP_FROM_EMAIL: str = ""
    SMTP_USE_TLS: bool = True
    SMTP_REPLY_TO: str = ""
    # URLs
    FRONTEND_BASE_URL: str = "http://localhost:5173"
    BACKEND_BASE_URL: str = "http://127.0.0.1:8080"
    INVITE_PATH: str = "/auth/accept-invite"
    RESET_PATH: str = "/auth/reset-password"
    # Tokens
    TOKEN_SECRET: str = "CHANGE_ME_USE_openssl_rand_hex_64"
    INVITE_TOKEN_TTL_MIN: int = 1440
    RESET_TOKEN_TTL_MIN: int = 30

    @property
    def all_cors_origins(self) -> List[str]:
        return list(set(self.CORS_ORIGINS + self.CORS_EXTRA_ORIGINS))

    class Config:
        env_file = ".env"

settings = Settings()
