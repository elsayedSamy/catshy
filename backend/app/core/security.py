"""Core security utilities — JWT, password hashing, Redis-backed rate limiting & brute-force."""
import hashlib
import logging
import os
import secrets
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import jwt, JWTError
from passlib.context import CryptContext
from app.config import settings

logger = logging.getLogger("catshy.security")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ── JWT ──

def create_access_token(user_id: str, role: str, workspace_id: Optional[str] = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": user_id, "role": role, "exp": expire}
    if workspace_id:
        payload["wid"] = workspace_id
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token_value() -> str:
    return str(uuid.uuid4())


def create_system_owner_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    payload = {"sub": user_id, "role": "system_owner", "scope": "system", "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])


def generate_secure_token() -> tuple[str, str]:
    raw = secrets.token_urlsafe(48)
    h = hashlib.sha256(raw.encode()).hexdigest()
    return raw, h


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ── CSRF Token ──

def generate_csrf_token() -> str:
    """Generate a cryptographically secure CSRF token."""
    return secrets.token_urlsafe(32)


def verify_csrf_token(cookie_token: str, header_token: str) -> bool:
    """Double-submit cookie: compare cookie value with header value."""
    if not cookie_token or not header_token:
        return False
    return secrets.compare_digest(cookie_token, header_token)


# ── Redis Connection ──

_redis_client = None


def _get_redis():
    """Get or create a Redis connection. Returns None if unavailable."""
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    try:
        import redis
        _redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
        _redis_client.ping()
        return _redis_client
    except Exception:
        logger.warning("Redis unavailable")
        _redis_client = None
        return None


# ── Rate Limiting (Redis-only in production) ──

PRODUCTION = os.getenv("CATSHY_ENV", "development") == "production"

# In-memory fallback for development only
_rate_windows: dict[str, list[float]] = {}


def check_rate_limit(key: str, max_per_minute: int = 5):
    """Rate limit check. Redis-only in production; in-memory fallback in dev."""
    r = _get_redis()
    if r:
        _redis_rate_limit(r, key, max_per_minute)
    elif PRODUCTION:
        raise ValueError("Redis required for rate limiting in production")
    else:
        _inmemory_rate_limit(key, max_per_minute)


def _redis_rate_limit(r, key: str, max_per_minute: int):
    rkey = f"ratelimit:{key}"
    now = time.time()
    pipe = r.pipeline()
    pipe.zremrangebyscore(rkey, 0, now - 60)
    pipe.zadd(rkey, {str(now): now})
    pipe.zcard(rkey)
    pipe.expire(rkey, 120)
    results = pipe.execute()
    if results[2] > max_per_minute:
        raise ValueError("Rate limit exceeded")


def _inmemory_rate_limit(key: str, max_per_minute: int):
    now = time.time()
    window = _rate_windows.setdefault(key, [])
    window[:] = [t for t in window if now - t < 60]
    if len(window) >= max_per_minute:
        raise ValueError("Rate limit exceeded")
    window.append(now)


class RedisRateLimiter:
    """Convenience wrapper used by route-level rate limiting."""

    def check(self, key: str, max_per_minute: int = 5):
        check_rate_limit(key, max_per_minute)


_redis_limiter: Optional[RedisRateLimiter] = None


def get_rate_limiter() -> RedisRateLimiter:
    global _redis_limiter
    if _redis_limiter is None:
        _redis_limiter = RedisRateLimiter()
    return _redis_limiter


# ── Brute-Force Detection (Redis-backed) ──

BRUTE_FORCE_WINDOW = 300   # 5 minutes
BRUTE_FORCE_THRESHOLD = 10
LOCKOUT_DURATION = 600      # 10 minutes

# In-memory fallback (dev only)
_failed_attempts: dict[str, list[float]] = {}
_lockouts: dict[str, float] = {}


def record_failed_login(key: str):
    r = _get_redis()
    if r:
        rkey = f"bruteforce:{key}"
        now = time.time()
        pipe = r.pipeline()
        pipe.zadd(rkey, {str(now): now})
        pipe.zremrangebyscore(rkey, 0, now - BRUTE_FORCE_WINDOW)
        pipe.zcard(rkey)
        pipe.expire(rkey, BRUTE_FORCE_WINDOW + 60)
        results = pipe.execute()
        if results[2] >= BRUTE_FORCE_THRESHOLD:
            r.setex(f"lockout:{key}", LOCKOUT_DURATION, "1")
            logger.warning("Brute-force lockout triggered (Redis) for key=%s", key)
    elif PRODUCTION:
        raise ValueError("Redis required for brute-force detection in production")
    else:
        now = time.time()
        attempts = _failed_attempts.setdefault(key, [])
        attempts.append(now)
        attempts[:] = [t for t in attempts if now - t < BRUTE_FORCE_WINDOW]
        if len(attempts) >= BRUTE_FORCE_THRESHOLD:
            _lockouts[key] = now + LOCKOUT_DURATION
            logger.warning("Brute-force lockout triggered (memory) for key=%s", key)


def is_locked_out(key: str) -> bool:
    r = _get_redis()
    if r:
        return r.exists(f"lockout:{key}") > 0
    elif PRODUCTION:
        return False  # Fail open only if Redis was available at startup and died
    else:
        lockout_until = _lockouts.get(key)
        if lockout_until and time.time() < lockout_until:
            return True
        if lockout_until:
            del _lockouts[key]
        return False


def clear_failed_attempts(key: str):
    r = _get_redis()
    if r:
        pipe = r.pipeline()
        pipe.delete(f"bruteforce:{key}")
        pipe.delete(f"lockout:{key}")
        pipe.execute()
    else:
        _failed_attempts.pop(key, None)
        _lockouts.pop(key, None)
