"""Service layer — auth service. Business logic separated from routes."""
import logging
import hashlib
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.security import (
    verify_password, hash_password, create_access_token,
    create_refresh_token_value, generate_secure_token,
    check_rate_limit, record_failed_login, is_locked_out, clear_failed_attempts,
)
from app.core.exceptions import AuthenticationError, RateLimitError, ConflictError
from app.config import settings
from app.models.user import User, UserRole, RefreshToken, AuthToken
from app.models.system import AuditLog

logger = logging.getLogger("catshy.auth_service")


async def authenticate_user(email: str, password: str, ip: str, user_agent: str, db: AsyncSession) -> dict:
    """Authenticate a user and return tokens + user data."""
    # Lockout check
    if is_locked_out(f"login-ip:{ip}") or is_locked_out(f"login-email:{email}"):
        raise RateLimitError("Account temporarily locked due to too many failed attempts.")

    try:
        check_rate_limit(f"login:{ip}", max_per_minute=10)
    except ValueError:
        raise RateLimitError()

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(password, user.hashed_password):
        record_failed_login(f"login-ip:{ip}")
        record_failed_login(f"login-email:{email}")
        db.add(AuditLog(
            action="AUTH_LOGIN_FAILED", entity_type="user",
            user_email=email, ip_address=ip, user_agent=user_agent,
            outcome="failure", failure_reason="invalid_credentials",
        ))
        await db.commit()
        raise AuthenticationError("Invalid email or password")

    if not user.is_active:
        raise AuthenticationError("Account disabled")

    clear_failed_attempts(f"login-ip:{ip}")
    clear_failed_attempts(f"login-email:{email}")

    # Get user's roles
    roles_result = await db.execute(select(UserRole.role).where(UserRole.user_id == user.id))
    roles = [r[0] for r in roles_result.all()]
    primary_role = roles[0] if roles else "user"

    access = create_access_token(user.id, primary_role)
    refresh = create_refresh_token_value()

    rt = RefreshToken(
        user_id=user.id,
        token_hash=hashlib.sha256(refresh.encode()).hexdigest(),
        expires_at=datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        ip_address=ip,
        user_agent=user_agent,
    )
    db.add(rt)
    db.add(AuditLog(
        action="AUTH_LOGIN_SUCCESS", entity_type="user",
        entity_id=user.id, user_id=user.id, user_email=user.email,
        ip_address=ip, user_agent=user_agent, outcome="success",
    ))
    await db.commit()

    return {
        "access_token": access,
        "refresh_token": refresh,
        "user": {
            "id": user.id, "email": user.email, "name": user.name,
            "role": primary_role, "roles": roles,
        },
    }


async def register_user(email: str, password: str, name: str, ip: str, db: AsyncSession) -> dict:
    """Register a new user with email verification required."""
    try:
        check_rate_limit(f"register-ip:{ip}", max_per_minute=5)
        check_rate_limit(f"register-email:{email}", max_per_minute=3)
    except ValueError:
        raise RateLimitError()

    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters")

    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none():
        raise ConflictError("Email already registered")

    user = User(
        email=email,
        name=name or email.split("@")[0],
        hashed_password=hash_password(password),
        role="user",
        is_active=False,  # Requires email verification
    )
    db.add(user)
    await db.flush()

    # Default role assignment
    db.add(UserRole(user_id=user.id, role="user"))

    # Generate verification token
    raw_token, token_hash = generate_secure_token()
    auth_token = AuthToken(
        token_hash=token_hash,
        token_type="verify_email",
        email=email,
        user_id=user.id,
        expires_at=datetime.utcnow() + timedelta(hours=24),
    )
    db.add(auth_token)
    db.add(AuditLog(action="USER_REGISTERED", entity_type="user", entity_id=user.id, user_email=email))
    await db.commit()

    return {"user_id": user.id, "verification_token": raw_token}


async def revoke_all_sessions(user_id: str, db: AsyncSession):
    """Revoke all refresh tokens for a user (force logout)."""
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.user_id == user_id, RefreshToken.revoked == False)
    )
    tokens = result.scalars().all()
    for t in tokens:
        t.revoked = True
    await db.commit()
    return len(tokens)
