"""Auth router — login, invite, password reset, token refresh"""
import logging
import hashlib
import secrets
import uuid
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
from jose import jwt, JWTError
from app.database import get_db
from app.config import settings
from app.models import User, RefreshToken, AuthToken, AuditLog
from app.services.mail import send_invite_email, send_reset_email

logger = logging.getLogger("catshy.auth")
router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ── Rate-limit state (basic in-memory per-process) ──
_rate_limits: dict[str, list[float]] = {}

def _check_rate_limit(key: str, max_per_minute: int = 5):
    import time
    now = time.time()
    window = _rate_limits.setdefault(key, [])
    window[:] = [t for t in window if now - t < 60]
    if len(window) >= max_per_minute:
        raise HTTPException(status_code=429, detail="Too many requests. Try again later.")
    window.append(now)

# ── Schemas ──
class LoginRequest(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    user: dict

class InviteRequest(BaseModel):
    email: str
    name: str = ""
    role: str = "analyst"

class AcceptInviteRequest(BaseModel):
    token: str
    password: str
    name: str = ""

class RequestResetRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str = ""


# ── Helpers ──
def create_access_token(user_id: str, role: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({"sub": user_id, "role": role, "exp": expire}, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

def create_refresh_token_value() -> str:
    return str(uuid.uuid4())

def _generate_token() -> tuple[str, str]:
    """Returns (raw_token, token_hash)"""
    raw = secrets.token_urlsafe(48)
    h = hashlib.sha256(raw.encode()).hexdigest()
    return raw, h

def _get_current_admin_user_id(request: Request) -> str:
    """Extract user_id from JWT in Authorization header. Raises 401/403."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = auth_header.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return payload["sub"]


# ── Login ──
@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()
    if not user or not pwd_context.verify(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")
    access = create_access_token(user.id, user.role)
    refresh = create_refresh_token_value()
    rt = RefreshToken(user_id=user.id, token_hash=hashlib.sha256(refresh.encode()).hexdigest(),
                      expires_at=datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS))
    db.add(rt)
    db.add(AuditLog(action="login", entity_type="user", entity_id=user.id, user_id=user.id, user_email=user.email))
    await db.commit()
    return TokenResponse(access_token=access, refresh_token=refresh,
                         user={"id": user.id, "email": user.email, "name": user.name, "role": user.role})


# ── Register (public sign-up with email verification) ──
@router.post("/register")
async def register(req: RegisterRequest, request: Request, db: AsyncSession = Depends(get_db)):
    _check_rate_limit(f"register-ip:{request.client.host}", max_per_minute=5)
    _check_rate_limit(f"register-email:{req.email}", max_per_minute=3)

    if len(req.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    existing = await db.execute(select(User).where(User.email == req.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    # Create user as inactive until email verified
    user = User(
        email=req.email,
        name=req.name or req.email.split("@")[0],
        hashed_password=pwd_context.hash(req.password),
        role="analyst",
        is_active=False,  # Requires email verification
    )
    db.add(user)
    await db.flush()

    # Generate verification token
    raw_token, token_hash = _generate_token()
    auth_token = AuthToken(
        token_hash=token_hash,
        token_type="verify_email",
        email=req.email,
        user_id=user.id,
        expires_at=datetime.utcnow() + timedelta(hours=24),
    )
    db.add(auth_token)
    db.add(AuditLog(action="user_registered", entity_type="user", entity_id=user.id, user_email=req.email))
    await db.commit()

    # Send verification email
    try:
        from app.services.mail import send_verification_email
        send_verification_email(req.email, raw_token)
    except Exception:
        logger.exception("Failed to send verification email")

    return {"message": "Account created. Please check your email to verify your account."}


# ── Verify Email ──
@router.post("/verify-email")
async def verify_email(token: str, db: AsyncSession = Depends(get_db)):
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    result = await db.execute(select(AuthToken).where(
        AuthToken.token_hash == token_hash,
        AuthToken.token_type == "verify_email",
    ))
    at = result.scalar_one_or_none()
    if not at:
        raise HTTPException(status_code=400, detail="Invalid verification token")
    if at.used_at is not None:
        raise HTTPException(status_code=400, detail="Token already used")
    if at.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Token expired")

    user_result = await db.execute(select(User).where(User.id == at.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=400, detail="User not found")

    user.is_active = True
    at.used_at = datetime.utcnow()
    db.add(AuditLog(action="email_verified", entity_type="user", entity_id=user.id, user_email=user.email))
    await db.commit()
    return {"message": "Email verified. You can now log in."}


# ── Invite (admin only) ──
@router.post("/invite")
async def create_invite(req: InviteRequest, request: Request, db: AsyncSession = Depends(get_db)):
    admin_id = _get_current_admin_user_id(request)
    _check_rate_limit(f"invite:{request.client.host}", max_per_minute=10)

    # Check email not already registered
    existing = await db.execute(select(User).where(User.email == req.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    raw_token, token_hash = _generate_token()
    auth_token = AuthToken(
        token_hash=token_hash,
        token_type="invite",
        email=req.email,
        name=req.name or None,
        role=req.role,
        expires_at=datetime.utcnow() + timedelta(minutes=settings.INVITE_TOKEN_TTL_MIN),
    )
    db.add(auth_token)
    db.add(AuditLog(action="invite_created", entity_type="user", user_id=admin_id,
                    details={"invited_email": req.email, "role": req.role}))
    await db.commit()

    # Send email
    try:
        admin_result = await db.execute(select(User).where(User.id == admin_id))
        admin_user = admin_result.scalar_one_or_none()
        send_invite_email(req.email, raw_token, inviter_name=admin_user.name if admin_user else "Admin")
    except Exception:
        logger.exception("Failed to send invite email")

    return {"message": "Invite sent", "email": req.email}


# ── Accept Invite ──
@router.post("/accept-invite")
async def accept_invite(req: AcceptInviteRequest, db: AsyncSession = Depends(get_db)):
    token_hash = hashlib.sha256(req.token.encode()).hexdigest()
    result = await db.execute(select(AuthToken).where(
        AuthToken.token_hash == token_hash,
        AuthToken.token_type == "invite",
    ))
    at = result.scalar_one_or_none()
    if not at:
        raise HTTPException(status_code=400, detail="Invalid invite token")
    if at.used_at is not None:
        raise HTTPException(status_code=400, detail="Invite already used")
    if at.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Invite expired")

    # Check email not taken (race condition guard)
    existing = await db.execute(select(User).where(User.email == at.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        email=at.email,
        name=req.name or at.name or at.email.split("@")[0],
        hashed_password=pwd_context.hash(req.password),
        role=at.role or "analyst",
        is_active=True,
    )
    db.add(user)
    at.used_at = datetime.utcnow()
    at.user_id = user.id
    db.add(AuditLog(action="invite_accepted", entity_type="user", entity_id=user.id, user_email=at.email))
    await db.commit()
    return {"message": "Account created. You can now log in."}


# ── Request Password Reset ──
@router.post("/request-password-reset")
async def request_password_reset(req: RequestResetRequest, request: Request, db: AsyncSession = Depends(get_db)):
    _check_rate_limit(f"reset-ip:{request.client.host}", max_per_minute=5)
    _check_rate_limit(f"reset-email:{req.email}", max_per_minute=3)

    # Always return 200 to not reveal if email exists
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()
    if user and user.is_active:
        raw_token, token_hash = _generate_token()
        auth_token = AuthToken(
            token_hash=token_hash,
            token_type="reset",
            email=req.email,
            user_id=user.id,
            expires_at=datetime.utcnow() + timedelta(minutes=settings.RESET_TOKEN_TTL_MIN),
        )
        db.add(auth_token)
        db.add(AuditLog(action="password_reset_requested", entity_type="user",
                        entity_id=user.id, user_email=req.email))
        await db.commit()
        try:
            send_reset_email(req.email, raw_token)
        except Exception:
            logger.exception("Failed to send reset email")

    return {"message": "If that email is registered, a reset link has been sent."}


# ── Reset Password ──
@router.post("/reset-password")
async def reset_password(req: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    token_hash = hashlib.sha256(req.token.encode()).hexdigest()
    result = await db.execute(select(AuthToken).where(
        AuthToken.token_hash == token_hash,
        AuthToken.token_type == "reset",
    ))
    at = result.scalar_one_or_none()
    if not at:
        raise HTTPException(status_code=400, detail="Invalid reset token")
    if at.used_at is not None:
        raise HTTPException(status_code=400, detail="Token already used")
    if at.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Token expired")

    user_result = await db.execute(select(User).where(User.id == at.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=400, detail="User not found")

    user.hashed_password = pwd_context.hash(req.new_password)
    at.used_at = datetime.utcnow()
    db.add(AuditLog(action="password_reset", entity_type="user", entity_id=user.id, user_email=user.email))
    await db.commit()
    return {"message": "Password has been reset. You can now log in."}


# ── Refresh Token ──
@router.post("/refresh")
async def refresh_token(refresh_token: str, db: AsyncSession = Depends(get_db)):
    token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
    result = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    rt = result.scalar_one_or_none()
    if not rt or rt.expires_at < datetime.utcnow():
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
    user_result = await db.execute(select(User).where(User.id == rt.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    access = create_access_token(user.id, user.role)
    return {"access_token": access}
