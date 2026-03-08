"""Auth router — cookie-based JWT, login, register, /me, refresh, CSRF, invite, password reset.
Phase 3: httpOnly cookies for access + refresh tokens, CSRF double-submit, /auth/me endpoint."""
import logging
import hashlib
import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from passlib.context import CryptContext
from jose import jwt, JWTError
from app.database import get_db
from app.config import settings
from app.models import User, UserRole, RefreshToken, AuthToken, AuditLog
from app.models.workspace import Workspace, WorkspaceMember
from app.services.mail import send_invite_email, send_reset_email
from app.core.security import get_rate_limiter, generate_csrf_token

logger = logging.getLogger("catshy.auth")
router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

VALID_ROLES = {"system_owner", "team_admin", "team_member", "user"}
DEFAULT_ROLE = "user"
ADMIN_ROLES = {"system_owner", "team_admin"}

IS_PRODUCTION = os.getenv("CATSHY_ENV", "development") == "production"
COOKIE_SECURE = IS_PRODUCTION
COOKIE_SAMESITE = "lax"  # Lax: allows top-level navigations; Strict blocks cross-site entirely
COOKIE_DOMAIN = os.getenv("COOKIE_DOMAIN", None)  # e.g., ".company.com" for subdomains


def _check_rate_limit(key: str, max_per_minute: int = 5):
    try:
        get_rate_limiter().check(key, max_per_minute)
    except ValueError:
        raise HTTPException(status_code=429, detail="Too many requests. Try again later.")


# ── Cookie helpers ──

def _set_auth_cookies(response: Response, access_token: str, refresh_token: str, csrf_token: str):
    """Set httpOnly cookies for access + refresh tokens, and a readable CSRF cookie."""
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/api",
        domain=COOKIE_DOMAIN,
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        path="/api/auth",  # Only sent to auth endpoints
        domain=COOKIE_DOMAIN,
    )
    response.set_cookie(
        key="csrf_token",
        value=csrf_token,
        httponly=False,  # Frontend reads this
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
        domain=COOKIE_DOMAIN,
    )


def _clear_auth_cookies(response: Response):
    """Clear all auth cookies."""
    for name, path in [("access_token", "/api"), ("refresh_token", "/api/auth"), ("csrf_token", "/")]:
        response.delete_cookie(key=name, path=path, domain=COOKIE_DOMAIN)


# ── Schemas ──
class LoginRequest(BaseModel):
    email: str
    password: str

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

class SwitchWorkspaceRequest(BaseModel):
    workspace_id: str


# ── Helpers ──
def create_access_token(user_id: str, role: str, workspace_id: str | None = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": user_id, "role": role, "exp": expire}
    if workspace_id:
        payload["wid"] = workspace_id
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token_value() -> str:
    return str(uuid.uuid4())


def _generate_token() -> tuple[str, str]:
    raw = secrets.token_urlsafe(48)
    h = hashlib.sha256(raw.encode()).hexdigest()
    return raw, h


def _get_current_admin_user_id(request: Request) -> str:
    from app.core.deps import _extract_token
    from app.core.security import decode_token
    token = _extract_token(request)
    try:
        payload = decode_token(token)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    if payload.get("role") not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Admin access required")
    return payload["sub"]


async def _assign_role(db: AsyncSession, user_id: str, role: str):
    existing = await db.execute(
        select(UserRole).where(UserRole.user_id == user_id, UserRole.role == role)
    )
    if not existing.scalar_one_or_none():
        db.add(UserRole(user_id=user_id, role=role))


async def _get_user_workspace(db: AsyncSession, user_id: str) -> str | None:
    result = await db.execute(
        select(WorkspaceMember.workspace_id)
        .where(WorkspaceMember.user_id == user_id, WorkspaceMember.is_active == True)
        .limit(1)
    )
    row = result.first()
    return row[0] if row else None


async def _ensure_default_workspace(db: AsyncSession, user_id: str, user_email: str) -> str:
    wid = await _get_user_workspace(db, user_id)
    if wid:
        return wid
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


def _user_dict(user, workspace_id: str | None = None) -> dict:
    return {
        "id": user.id, "email": user.email, "name": user.name,
        "role": user.role, "workspace_id": workspace_id,
    }


# ══════════════════════════════════════════════════════════════
# CSRF Token endpoint
# ══════════════════════════════════════════════════════════════

@router.get("/csrf-token")
async def get_csrf_token(response: Response):
    """Issue a CSRF token via cookie + response body."""
    token = generate_csrf_token()
    response.set_cookie(
        key="csrf_token", value=token, httponly=False,
        secure=COOKIE_SECURE, samesite=COOKIE_SAMESITE,
        max_age=3600, path="/", domain=COOKIE_DOMAIN,
    )
    return {"csrf_token": token}


# ══════════════════════════════════════════════════════════════
# Login — sets httpOnly cookies
# ══════════════════════════════════════════════════════════════

@router.post("/login")
async def login(req: LoginRequest, request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    _check_rate_limit(f"login-ip:{request.client.host}", max_per_minute=10)

    from app.core.security import record_failed_login, is_locked_out, clear_failed_attempts

    lock_key_ip = f"login-ip:{request.client.host}"
    lock_key_email = f"login-email:{req.email}"

    if is_locked_out(lock_key_ip) or is_locked_out(lock_key_email):
        raise HTTPException(status_code=429, detail="Account temporarily locked. Try again later.")

    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()
    if not user or not pwd_context.verify(req.password, user.hashed_password):
        record_failed_login(lock_key_ip)
        record_failed_login(lock_key_email)
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")

    clear_failed_attempts(lock_key_ip)
    clear_failed_attempts(lock_key_email)

    workspace_id = await _ensure_default_workspace(db, user.id, user.email)

    access = create_access_token(user.id, user.role, workspace_id=workspace_id)
    refresh = create_refresh_token_value()
    csrf = generate_csrf_token()

    rt = RefreshToken(user_id=user.id, token_hash=hashlib.sha256(refresh.encode()).hexdigest(),
                      expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS))
    db.add(rt)
    db.add(AuditLog(action="login", entity_type="user", entity_id=user.id,
                    user_id=user.id, user_email=user.email, workspace_id=workspace_id))
    await db.commit()

    _set_auth_cookies(response, access, refresh, csrf)

    # Also return user data + tokens in body for backwards compat / CLI usage
    return {
        "user": _user_dict(user, workspace_id),
        "csrf_token": csrf,
        # Include tokens in body for CLI/dev (production frontends should use cookies)
        "access_token": access,
        "refresh_token": refresh,
    }


# ══════════════════════════════════════════════════════════════
# /me — fetch current session from cookie
# ══════════════════════════════════════════════════════════════

@router.get("/me")
async def get_me(request: Request, db: AsyncSession = Depends(get_db)):
    """Return current authenticated user from cookie/bearer token."""
    from app.core.deps import get_current_user
    user = await get_current_user(request, db)
    workspace_id = getattr(request.state, "workspace_id", None)
    return {"user": _user_dict(user, workspace_id)}


# ══════════════════════════════════════════════════════════════
# Logout — clear cookies + revoke refresh token
# ══════════════════════════════════════════════════════════════

@router.post("/logout")
async def logout(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    """Clear auth cookies and revoke refresh token."""
    refresh_cookie = request.cookies.get("refresh_token")
    if refresh_cookie:
        token_hash = hashlib.sha256(refresh_cookie.encode()).hexdigest()
        result = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
        rt = result.scalar_one_or_none()
        if rt:
            rt.revoked = True
            await db.commit()

    _clear_auth_cookies(response)
    return {"message": "Logged out"}


# ══════════════════════════════════════════════════════════════
# Refresh — rotate access token via refresh cookie
# ══════════════════════════════════════════════════════════════

@router.post("/refresh")
async def refresh_token(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    """Refresh access token using refresh_token cookie (or body param for CLI)."""
    refresh_val = request.cookies.get("refresh_token")
    if not refresh_val:
        # Fallback: accept in body for CLI
        try:
            body = await request.json()
            refresh_val = body.get("refresh_token")
        except Exception:
            pass
    if not refresh_val:
        raise HTTPException(status_code=401, detail="No refresh token")

    token_hash = hashlib.sha256(refresh_val.encode()).hexdigest()
    result = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    rt = result.scalar_one_or_none()
    if not rt or rt.expires_at < datetime.now(timezone.utc) or getattr(rt, "revoked", False):
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    user_result = await db.execute(select(User).where(User.id == rt.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    workspace_id = await _get_user_workspace(db, user.id)
    access = create_access_token(user.id, user.role, workspace_id=workspace_id)
    csrf = generate_csrf_token()

    response.set_cookie(
        key="access_token", value=access, httponly=True,
        secure=COOKIE_SECURE, samesite=COOKIE_SAMESITE,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/api", domain=COOKIE_DOMAIN,
    )
    response.set_cookie(
        key="csrf_token", value=csrf, httponly=False,
        secure=COOKIE_SECURE, samesite=COOKIE_SAMESITE,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/", domain=COOKIE_DOMAIN,
    )

    return {"access_token": access, "csrf_token": csrf}


# ══════════════════════════════════════════════════════════════
# Register (public sign-up)
# ══════════════════════════════════════════════════════════════

@router.post("/register")
async def register(req: RegisterRequest, request: Request, db: AsyncSession = Depends(get_db)):
    _check_rate_limit(f"register-ip:{request.client.host}", max_per_minute=5)
    _check_rate_limit(f"register-email:{req.email}", max_per_minute=3)

    if len(req.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    existing = await db.execute(select(User).where(User.email == req.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    user_count = (await db.execute(select(User))).scalars().all()
    is_first_user = len(user_count) == 0
    assigned_role = "system_owner" if is_first_user else DEFAULT_ROLE

    user = User(
        email=req.email,
        name=req.name or req.email.split("@")[0],
        hashed_password=pwd_context.hash(req.password),
        role=assigned_role,
        is_active=True if is_first_user else False,
    )
    db.add(user)
    await db.flush()
    await _assign_role(db, user.id, assigned_role)
    workspace_id = await _ensure_default_workspace(db, user.id, req.email)

    if not is_first_user:
        raw_token, token_hash = _generate_token()
        auth_token = AuthToken(
            token_hash=token_hash, token_type="verify_email",
            email=req.email, user_id=user.id,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
        )
        db.add(auth_token)

    db.add(AuditLog(action="user_registered", entity_type="user", entity_id=user.id,
                    user_email=req.email, workspace_id=workspace_id))
    await db.commit()

    if is_first_user:
        return {"message": "System owner account created. You can log in now.", "role": assigned_role}

    try:
        from app.services.mail import send_verification_email
        send_verification_email(req.email, raw_token)
    except Exception:
        logger.exception("Failed to send verification email")

    return {"message": "Account created. Please check your email to verify your account."}


# ══════════════════════════════════════════════════════════════
# Verify Email
# ══════════════════════════════════════════════════════════════

@router.post("/verify-email")
async def verify_email(token: str, db: AsyncSession = Depends(get_db)):
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    result = await db.execute(select(AuthToken).where(
        AuthToken.token_hash == token_hash, AuthToken.token_type == "verify_email",
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


# ══════════════════════════════════════════════════════════════
# Invite (admin only)
# ══════════════════════════════════════════════════════════════

@router.post("/invite")
async def create_invite(req: InviteRequest, request: Request, db: AsyncSession = Depends(get_db)):
    admin_id = _get_current_admin_user_id(request)
    _check_rate_limit(f"invite:{request.client.host}", max_per_minute=10)

    if req.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(VALID_ROLES)}")

    existing = await db.execute(select(User).where(User.email == req.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    raw_token, token_hash = _generate_token()
    auth_token = AuthToken(
        token_hash=token_hash, token_type="invite",
        email=req.email, name=req.name or None, role=req.role,
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


# ══════════════════════════════════════════════════════════════
# Accept Invite
# ══════════════════════════════════════════════════════════════

@router.post("/accept-invite")
async def accept_invite(req: AcceptInviteRequest, db: AsyncSession = Depends(get_db)):
    token_hash = hashlib.sha256(req.token.encode()).hexdigest()
    result = await db.execute(select(AuthToken).where(
        AuthToken.token_hash == token_hash, AuthToken.token_type == "invite",
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
        role=assigned_role, is_active=True,
    )
    db.add(user)
    await db.flush()
    await _assign_role(db, user.id, assigned_role)
    await _ensure_default_workspace(db, user.id, at.email)

    at.used_at = datetime.now(timezone.utc)
    at.user_id = user.id
    db.add(AuditLog(action="invite_accepted", entity_type="user", entity_id=user.id, user_email=at.email))
    await db.commit()
    return {"message": "Account created. You can now log in."}


# ══════════════════════════════════════════════════════════════
# Password Reset
# ══════════════════════════════════════════════════════════════

@router.post("/request-password-reset")
async def request_password_reset(req: RequestResetRequest, request: Request, db: AsyncSession = Depends(get_db)):
    _check_rate_limit(f"reset-ip:{request.client.host}", max_per_minute=5)
    _check_rate_limit(f"reset-email:{req.email}", max_per_minute=3)

    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()
    if user and user.is_active:
        raw_token, token_hash = _generate_token()
        auth_token = AuthToken(
            token_hash=token_hash, token_type="reset",
            email=req.email, user_id=user.id,
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


@router.post("/reset-password")
async def reset_password(req: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    token_hash = hashlib.sha256(req.token.encode()).hexdigest()
    result = await db.execute(select(AuthToken).where(
        AuthToken.token_hash == token_hash, AuthToken.token_type == "reset",
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


# ══════════════════════════════════════════════════════════════
# Switch Workspace
# ══════════════════════════════════════════════════════════════

@router.post("/switch-workspace")
async def switch_workspace(req: SwitchWorkspaceRequest, request: Request, response: Response,
                           db: AsyncSession = Depends(get_db)):
    from app.core.deps import get_current_user

    user = await get_current_user(request, db)

    result = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == req.workspace_id,
            WorkspaceMember.user_id == user.id,
            WorkspaceMember.is_active == True,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="You are not a member of this workspace")

    ws_result = await db.execute(
        select(Workspace).where(Workspace.id == req.workspace_id, Workspace.is_active == True)
    )
    workspace = ws_result.scalar_one_or_none()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found or inactive")

    access = create_access_token(user.id, user.role, workspace_id=req.workspace_id)
    csrf = generate_csrf_token()

    # Update access token cookie
    response.set_cookie(
        key="access_token", value=access, httponly=True,
        secure=COOKIE_SECURE, samesite=COOKIE_SAMESITE,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/api", domain=COOKIE_DOMAIN,
    )
    response.set_cookie(
        key="csrf_token", value=csrf, httponly=False,
        secure=COOKIE_SECURE, samesite=COOKIE_SAMESITE,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/", domain=COOKIE_DOMAIN,
    )

    db.add(AuditLog(action="workspace_switched", entity_type="workspace",
                    entity_id=req.workspace_id, user_id=user.id, user_email=user.email,
                    workspace_id=req.workspace_id))
    await db.commit()

    return {
        "access_token": access,
        "csrf_token": csrf,
        "workspace": {"id": workspace.id, "name": workspace.name, "slug": workspace.slug},
    }
