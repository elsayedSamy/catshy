"""Core security utilities — JWT, password hashing, rate limiting, brute-force detection."""
import hashlib
import logging
import secrets
import time
import uuid
from datetime import datetime, timedelta
from typing import Optional

from jose import jwt, JWTError
from passlib.context import CryptContext
from app.config import settings

logger = logging.getLogger("catshy.security")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ── JWT ──

def create_access_token(user_id: str, role: str, workspace_id: Optional[str] = None) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": user_id, "role": role, "exp": expire}
    if workspace_id:
        payload["wid"] = workspace_id
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_system_owner_token(user_id: str) -> str:
    """Separate token for system_owner with shorter TTL and explicit scope."""
    expire = datetime.utcnow() + timedelta(minutes=15)  # Short-lived
    payload = {
        "sub": user_id,
        "role": "system_owner",
        "scope": "system",
        "exp": expire,
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and validate a JWT. Raises JWTError on failure."""
    return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])


def create_refresh_token_value() -> str:
    return str(uuid.uuid4())


def generate_secure_token() -> tuple[str, str]:
    """Returns (raw_token, sha256_hash)."""
    raw = secrets.token_urlsafe(48)
    h = hashlib.sha256(raw.encode()).hexdigest()
    return raw, h


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ── Rate Limiting (in-memory, per-process) ──

_rate_windows: dict[str, list[float]] = {}


def check_rate_limit(key: str, max_per_minute: int = 5):
    """Raises ValueError if rate limit exceeded."""
    now = time.time()
    window = _rate_windows.setdefault(key, [])
    window[:] = [t for t in window if now - t < 60]
    if len(window) >= max_per_minute:
        raise ValueError("Rate limit exceeded")
    window.append(now)


# ── Brute-Force Detection ──

_failed_attempts: dict[str, list[float]] = {}
BRUTE_FORCE_WINDOW = 300  # 5 minutes
BRUTE_FORCE_THRESHOLD = 10
LOCKOUT_DURATION = 600  # 10 minutes
_lockouts: dict[str, float] = {}


def record_failed_login(key: str):
    """Track a failed login attempt. Key can be IP or email."""
    now = time.time()
    attempts = _failed_attempts.setdefault(key, [])
    attempts.append(now)
    # Trim old entries
    attempts[:] = [t for t in attempts if now - t < BRUTE_FORCE_WINDOW]
    if len(attempts) >= BRUTE_FORCE_THRESHOLD:
        _lockouts[key] = now + LOCKOUT_DURATION
        logger.warning("Brute-force lockout triggered for key=%s", key)


def is_locked_out(key: str) -> bool:
    lockout_until = _lockouts.get(key)
    if lockout_until and time.time() < lockout_until:
        return True
    if lockout_until:
        del _lockouts[key]
    return False


def clear_failed_attempts(key: str):
    _failed_attempts.pop(key, None)
    _lockouts.pop(key, None)
