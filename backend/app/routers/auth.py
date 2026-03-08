"""Auth router — login, invite, password reset, token refresh.
Roles: system_owner | team_admin | team_member | user"""
import logging
import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
from jose import jwt, JWTError
from app.database import get_db
from app.config import settings
from app.models import User, UserRole, RefreshToken, AuthToken, AuditLog
from app.models.workspace import Workspace, WorkspaceMember
from app.services.mail import send_invite_email, send_reset_email
from app.core.security import get_rate_limiter

logger = logging.getLogger("catshy.auth")
router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Unified role constants
VALID_ROLES = {"system_owner", "team_admin", "team_member", "user"}
DEFAULT_ROLE = "user"
ADMIN_ROLES = {"system_owner", "team_admin"}


def _check_rate_limit(key: str, max_per_minute: int = 5):
    try:
        get_rate_limiter().check(key, max_per_minute)
    except ValueError:
        raise HTTPException(status_code=429, detail="Too many requests. Try again later.")

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
    role: str = DEFAULT_ROLE
    workspace_id: str = ""

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
def create_access_token(user_id: str, role: str, workspace_id: str | None = None) -> str:
    """Create JWT with workspace_id (wid) claim for tenant scoping."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": user_id, "role": role, "exp": expire}
    if workspace_id:
        payload["wid"] = workspace_id
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

def create_refresh_token_value() -> str:
    return str(uuid.uuid4())

def _generate_token() -> tuple[str, str]:
    """Returns (raw_token, token_hash)"""
    raw = secrets.token_urlsafe(48)
    h = hashlib.sha256(raw.encode()).hexdigest()
    return raw, h

def _get_current_admin_user_id(request: Request) -> str:
    """Extract user_id from JWT. Requires system_owner or team_admin role."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = auth_header.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    if payload.get("role") not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Admin access required (system_owner or team_admin)")
    return payload["sub"]


async def _assign_role(db: AsyncSession, user_id: str, role: str):
    """Assign a role in the user_roles table if not already present."""
    existing = await db.execute(
        select(UserRole).where(UserRole.user_id == user_id, UserRole.role == role)
    )
    if not existing.scalar_one_or_none():
        db.add(UserRole(user_id=user_id, role=role))


async def _get_user_workspace(db: AsyncSession, user_id: str) -> str | None:
    """Get the user's first active workspace_id, or None."""
    result = await db.execute(
        select(WorkspaceMember.workspace_id)
        .where(WorkspaceMember.user_id == user_id, WorkspaceMember.is_active == True)
        .limit(1)
    )
    row = result.first()
    return row[0] if row else None


async def _ensure_default_workspace(db: AsyncSession, user_id: str, user_email: str) -> str:
    """Create a default workspace for the user if none exists, return workspace_id."""
    wid = await _get_user_workspace(db, user_id)
    if wid:
        return wid
    # Create default workspace
    ws = Workspace(
        name=f"{user_email.split('@')[0]}'s Workspace",
        slug=f"ws-{user_id[:8]}",
        owner_id=user_id,
    )
    db.add(ws)
    await db.flush()
    db.add(WorkspaceMember(workspace_id=ws.id, user_id=user_id, role="team_admin"))
    await db.flush()
    return ws.id


# ── Login ──
@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()
    if not user or not pwd_context.verify(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")

    # Resolve workspace for token
    workspace_id = await _ensure_default_workspace(db, user.id, user.email)

    access = create_access_token(user.id, user.role, workspace_id=workspace_id)
    refresh = create_refresh_token_value()
    rt = RefreshToken(user_id=user.id, token_hash=hashlib.sha256(refresh.encode()).hexdigest(),
                      expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS))
    db.add(rt)
    db.add(AuditLog(action="login", entity_type="user", entity_id=user.id,
                    user_id=user.id, user_email=user.email, workspace_id=workspace_id))
    await db.commit()
    return TokenResponse(access_token=access, refresh_token=refresh,
                         user={"id": user.id, "email": user.email, "name": user.name,
                               "role": user.role, "workspace_id": workspace_id})


# ── Register (public sign-up) ──
@router.post("/register")
async def register(req: RegisterRequest, request: Request, db: AsyncSession = Depends(get_db)):
    _check_rate_limit(f"register-ip:{request.client.host}", max_per_minute=5)
    _check_rate_limit(f"register-email:{req.email}", max_per_minute=3)

    if len(req.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    existing = await db.execute(select(User).where(User.email == req.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    # First user auto-promoted to system_owner
    user_count = (await db.execute(select(User))).scalars().all()
    is_first_user = len(user_count) == 0
    assigned_role = "system_owner" if is_first_user else DEFAULT_ROLE

    user = User(
        email=req.email,
        name=req.name or req.email.split("@")[0],
        hashed_password=pwd_context.hash(req.password),
        role=assigned_role,
        is_active=False if not is_first_user else True,
    )
    db.add(user)
    await db.flush()

    # Assign role in user_roles table
    await _assign_role(db, user.id, assigned_role)

    # Create default workspace for new user
    workspace_id = await _ensure_default_workspace(db, user.id, req.email)

    if not is_first_user:
        # Generate verification token
        raw_token, token_hash = _generate_token()
        auth_token = AuthToken(
            token_hash=token_hash,
            token_type="verify_email",
            email=req.email,
            user_id=user.id,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
        )
        db.add(auth_token)

    db.add(AuditLog(action="user_registered", entity_type="user", entity_id=user.id,
                    user_email=req.email, workspace_id=workspace_id))
    await db.commit()

    if is_first_user:
        return {"message": "System owner account created. You can log in now.", "role": assigned_role}

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
    if at.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Token expired")

    user_result = await db.execute(select(User).where(User.id == at.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=400, detail="User not found")

    user.is_active = True
    at.used_at = datetime.now(timezone.utc)
    db.add(AuditLog(action="email_verified", entity_type="user", entity_id=user.id, user_email=user.email))
    await db.commit()
    return {"message": "Email verified. You can now log in."}


# ── Invite (admin only) ──
@router.post("/invite")
async def create_invite(req: InviteRequest, request: Request, db: AsyncSession = Depends(get_db)):
    admin_id = _get_current_admin_user_id(request)
    _check_rate_limit(f"invite:{request.client.host}", max_per_minute=10)

    # Validate role
    if req.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(VALID_ROLES)}")

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
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=settings.INVITE_TOKEN_TTL_MIN),
    )
    db.add(auth_token)
    db.add(AuditLog(action="invite_created", entity_type="user", user_id=admin_id,
                    details={"invited_email": req.email, "role": req.role}))
    await db.commit()

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
    if at.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Invite expired")

    existing = await db.execute(select(User).where(User.email == at.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    assigned_role = at.role if at.role in VALID_ROLES else DEFAULT_ROLE
    user = User(
        email=at.email,
        name=req.name or at.name or at.email.split("@")[0],
        hashed_password=pwd_context.hash(req.password),
        role=assigned_role,
        is_active=True,
    )
    db.add(user)
    await db.flush()
    await _assign_role(db, user.id, assigned_role)

    # Create default workspace for invited user
    await _ensure_default_workspace(db, user.id, at.email)

    at.used_at = datetime.now(timezone.utc)
    at.user_id = user.id
    db.add(AuditLog(action="invite_accepted", entity_type="user", entity_id=user.id, user_email=at.email))
    await db.commit()
    return {"message": "Account created. You can now log in."}


# ── Request Password Reset ──
@router.post("/request-password-reset")
async def request_password_reset(req: RequestResetRequest, request: Request, db: AsyncSession = Depends(get_db)):
    _check_rate_limit(f"reset-ip:{request.client.host}", max_per_minute=5)
    _check_rate_limit(f"reset-email:{req.email}", max_per_minute=3)

    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()
    if user and user.is_active:
        raw_token, token_hash = _generate_token()
        auth_token = AuthToken(
            token_hash=token_hash,
            token_type="reset",
            email=req.email,
            user_id=user.id,
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=settings.RESET_TOKEN_TTL_MIN),
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
    if at.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Token expired")

    user_result = await db.execute(select(User).where(User.id == at.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=400, detail="User not found")

    user.hashed_password = pwd_context.hash(req.new_password)
    at.used_at = datetime.now(timezone.utc)
    db.add(AuditLog(action="password_reset", entity_type="user", entity_id=user.id, user_email=user.email))
    await db.commit()
    return {"message": "Password has been reset. You can now log in."}


# ── Refresh Token ──
@router.post("/refresh")
async def refresh_token(refresh_token: str, db: AsyncSession = Depends(get_db)):
    token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
    result = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    rt = result.scalar_one_or_none()
    if not rt or rt.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
    user_result = await db.execute(select(User).where(User.id == rt.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    # Include workspace_id in refreshed token
    workspace_id = await _get_user_workspace(db, user.id)
    access = create_access_token(user.id, user.role, workspace_id=workspace_id)
    return {"access_token": access}
