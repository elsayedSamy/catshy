from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
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
    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:8080", "http://localhost:3000", "http://127.0.0.1:8080"]
    # SSRF Protection
    SSRF_DENY_PRIVATE: bool = True
    SSRF_TIMEOUT: int = 15
    SSRF_ALLOWLIST: List[str] = []
    # Celery
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"
    # Feature flags
    ENABLE_TOR: bool = False
    # Report branding
    REPORT_COMPANY_NAME: str = "CATSHY"

    class Config:
        env_file = ".env"

settings = Settings()
