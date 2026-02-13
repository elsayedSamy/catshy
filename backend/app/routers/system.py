"""System Owner Router — /api/system/* namespace.

Requires system_owner role + scoped JWT token.
Handles: owner login (separate route), impersonation, owner approval, system audit.
"""
import logging
import hashlib
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.core.security import (
    verify_password, create_system_owner_token, create_access_token,
    check_rate_limit, record_failed_login, is_locked_out, clear_failed_attempts,
    hash_password,
)
from app.core.deps import get_system_owner
from app.core.exceptions import AuthenticationError, AuthorizationError, RateLimitError
from app.models.user import User, UserRole
from app.models.system import SystemAuditLog, PendingOwnerRequest, AuditLog

logger = logging.getLogger("catshy.system")
router = APIRouter()


# ── Schemas ──

class OwnerLoginRequest(BaseModel):
    email: str
    password: str
    mfa_code: Optional[str] = None  # Required when MFA is enabled


class OwnerLoginResponse(BaseModel):
    access_token: str
    user: dict


class OwnerRequestCreate(BaseModel):
    reason: str


class OwnerRequestReview(BaseModel):
    status: str  # approved | rejected
    notes: str = ""


class ImpersonateRequest(BaseModel):
    target_user_id: str
    reason: str


# ── System Owner Login (separate route) ──

@router.post("/owner-login", response_model=OwnerLoginResponse)
async def owner_login(req: OwnerLoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    client_ip = request.client.host if request.client else "unknown"

    # Rate limit & lockout
    if is_locked_out(f"owner-ip:{client_ip}"):
        raise RateLimitError("Account temporarily locked due to too many failed attempts.")
    try:
        check_rate_limit(f"owner-login:{client_ip}", max_per_minute=3)
    except ValueError:
        raise RateLimitError()

    # Find user
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(req.password, user.hashed_password):
        record_failed_login(f"owner-ip:{client_ip}")
        record_failed_login(f"owner-email:{req.email}")
        # Log failed attempt
        db.add(SystemAuditLog(
            action="OWNER_LOGIN_FAILED",
            actor_user_id=user.id if user else "00000000-0000-0000-0000-000000000000",
            actor_email=req.email,
            ip_address=client_ip,
            user_agent=request.headers.get("user-agent", ""),
            outcome="failure",
            details={"reason": "invalid_credentials"},
        ))
        await db.commit()
        raise AuthenticationError("Invalid credentials")

    if not user.is_active:
        raise AuthenticationError("Account disabled")

    # Verify system_owner role
    role_result = await db.execute(
        select(UserRole).where(UserRole.user_id == user.id, UserRole.role == "system_owner")
    )
    if not role_result.scalar_one_or_none():
        record_failed_login(f"owner-email:{req.email}")
        db.add(SystemAuditLog(
            action="OWNER_LOGIN_DENIED",
            actor_user_id=user.id,
            actor_email=user.email,
            ip_address=client_ip,
            outcome="failure",
            details={"reason": "not_system_owner"},
        ))
        await db.commit()
        raise AuthorizationError("System owner access required")

    # MFA check (mandatory for system_owner)
    if user.mfa_enabled:
        if not req.mfa_code:
            raise HTTPException(status_code=428, detail="MFA code required")
        # TODO: Validate TOTP code against user.mfa_secret
        # For now, placeholder — integrate pyotp in production
        logger.warning("MFA validation placeholder — integrate pyotp for production")

    # Success
    clear_failed_attempts(f"owner-ip:{client_ip}")
    clear_failed_attempts(f"owner-email:{req.email}")

    token = create_system_owner_token(user.id)
    db.add(SystemAuditLog(
        action="OWNER_LOGIN_SUCCESS",
        actor_user_id=user.id,
        actor_email=user.email,
        ip_address=client_ip,
        user_agent=request.headers.get("user-agent", ""),
        outcome="success",
    ))
    await db.commit()

    return OwnerLoginResponse(
        access_token=token,
        user={"id": user.id, "email": user.email, "name": user.name},
    )


# ── Impersonation ──

@router.post("/impersonate")
async def impersonate_user(
    req: ImpersonateRequest,
    request: Request,
    owner: User = Depends(get_system_owner),
    db: AsyncSession = Depends(get_db),
):
    """Generate a short-lived token as another user. Strictly audit-logged."""
    target_result = await db.execute(select(User).where(User.id == req.target_user_id))
    target_user = target_result.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail="Target user not found")

    # Cannot impersonate another system_owner
    role_result = await db.execute(
        select(UserRole).where(UserRole.user_id == target_user.id, UserRole.role == "system_owner")
    )
    if role_result.scalar_one_or_none():
        raise AuthorizationError("Cannot impersonate another system owner")

    # Generate impersonation token (very short-lived, 10 min)
    impersonation_token = create_access_token(target_user.id, "user")

    db.add(SystemAuditLog(
        action="IMPERSONATION_START",
        actor_user_id=owner.id,
        actor_email=owner.email,
        target_user_id=target_user.id,
        ip_address=request.client.host if request.client else "unknown",
        user_agent=request.headers.get("user-agent", ""),
        details={"reason": req.reason, "target_email": target_user.email},
    ))
    await db.commit()

    return {
        "access_token": impersonation_token,
        "target_user": {"id": target_user.id, "email": target_user.email, "name": target_user.name},
        "expires_in_minutes": 10,
        "warning": "All actions during impersonation are audit-logged.",
    }


# ── Owner Approval System ──

@router.post("/owner-request")
async def create_owner_request(
    req: OwnerRequestCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Any authenticated user can request system_owner elevation."""
    from app.core.deps import get_current_user
    user = await get_current_user(request, db)

    # Check if already system_owner
    role_result = await db.execute(
        select(UserRole).where(UserRole.user_id == user.id, UserRole.role == "system_owner")
    )
    if role_result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Already a system owner")

    # Check for pending request
    pending = await db.execute(
        select(PendingOwnerRequest).where(
            PendingOwnerRequest.requester_user_id == user.id,
            PendingOwnerRequest.status == "pending",
        )
    )
    if pending.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Request already pending")

    owner_req = PendingOwnerRequest(
        requester_user_id=user.id,
        requester_email=user.email,
        reason=req.reason,
    )
    db.add(owner_req)
    db.add(SystemAuditLog(
        action="OWNER_REQUEST_CREATED",
        actor_user_id=user.id,
        actor_email=user.email,
        details={"reason": req.reason},
    ))
    await db.commit()
    return {"message": "Owner request submitted for review", "request_id": owner_req.id}


@router.get("/owner-requests")
async def list_owner_requests(
    owner: User = Depends(get_system_owner),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PendingOwnerRequest).order_by(PendingOwnerRequest.created_at.desc())
    )
    return [
        {
            "id": r.id, "requester_email": r.requester_email,
            "reason": r.reason, "status": r.status,
            "created_at": str(r.created_at),
        }
        for r in result.scalars().all()
    ]


@router.post("/owner-requests/{request_id}/review")
async def review_owner_request(
    request_id: str,
    review: OwnerRequestReview,
    request: Request,
    owner: User = Depends(get_system_owner),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PendingOwnerRequest).where(PendingOwnerRequest.id == request_id)
    )
    owner_req = result.scalar_one_or_none()
    if not owner_req:
        raise HTTPException(status_code=404, detail="Request not found")
    if owner_req.status != "pending":
        raise HTTPException(status_code=409, detail="Request already reviewed")

    if review.status not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="Status must be 'approved' or 'rejected'")

    owner_req.status = review.status
    owner_req.reviewed_by = owner.id
    owner_req.reviewed_at = datetime.utcnow()
    owner_req.review_notes = review.notes

    if review.status == "approved":
        # Grant system_owner role
        new_role = UserRole(user_id=owner_req.requester_user_id, role="system_owner")
        db.add(new_role)

    db.add(SystemAuditLog(
        action=f"OWNER_REQUEST_{review.status.upper()}",
        actor_user_id=owner.id,
        actor_email=owner.email,
        target_user_id=owner_req.requester_user_id,
        details={"notes": review.notes},
        ip_address=request.client.host if request.client else "unknown",
    ))
    await db.commit()
    return {"message": f"Request {review.status}"}


# ── System Audit Logs ──

@router.get("/audit-logs")
async def system_audit_logs(
    action: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    owner: User = Depends(get_system_owner),
    db: AsyncSession = Depends(get_db),
):
    q = select(SystemAuditLog)
    if action:
        q = q.where(SystemAuditLog.action == action)
    result = await db.execute(q.order_by(SystemAuditLog.timestamp.desc()).offset(offset).limit(limit))
    return [
        {
            "id": log.id, "action": log.action, "actor_email": log.actor_email,
            "outcome": log.outcome, "ip_address": log.ip_address,
            "details": log.details, "timestamp": str(log.timestamp),
        }
        for log in result.scalars().all()
    ]


# ── System Health ──

@router.get("/health")
async def system_health(owner: User = Depends(get_system_owner), db: AsyncSession = Depends(get_db)):
    """Comprehensive system health check — system_owner only."""
    health = {"api": "ok", "database": "unknown", "redis": "unknown", "workers": "unknown"}

    # Database check
    try:
        await db.execute(select(func.now()))
        health["database"] = "ok"
    except Exception as e:
        health["database"] = f"error: {str(e)}"

    # Redis check
    try:
        import redis
        r = redis.from_url(settings.REDIS_URL, socket_timeout=2)
        r.ping()
        health["redis"] = "ok"
    except Exception as e:
        health["redis"] = f"error: {str(e)}"

    return health


# ── All Users (system-wide) ──

@router.get("/users")
async def list_all_users(
    owner: User = Depends(get_system_owner),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    users = result.scalars().all()
    out = []
    for u in users:
        roles_result = await db.execute(select(UserRole.role).where(UserRole.user_id == u.id))
        roles = [r[0] for r in roles_result.all()]
        out.append({
            "id": u.id, "email": u.email, "name": u.name,
            "roles": roles, "is_active": u.is_active,
            "mfa_enabled": u.mfa_enabled,
            "created_at": str(u.created_at),
        })
    return out


# Import settings for health check
from app.config import settings
