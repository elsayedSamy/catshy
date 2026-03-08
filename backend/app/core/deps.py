"""FastAPI dependencies — authentication (cookie + Bearer), authorization, tenant scoping."""
import logging
from typing import Optional
from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from jose import JWTError

from app.database import get_db
from app.core.security import decode_token
from app.core.exceptions import (
    AuthenticationError, AuthorizationError, TenantIsolationError,
)

logger = logging.getLogger("catshy.deps")


# ── Token extraction: cookie-first, Bearer fallback ──

def _extract_token(request: Request) -> str:
    """Extract JWT from httpOnly cookie first, then Authorization header."""
    # 1. Cookie (production default)
    token = request.cookies.get("access_token")
    if token:
        return token

    # 2. Bearer header (CLI / dev / backwards compat)
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header.split(" ", 1)[1]

    raise AuthenticationError("No authentication credentials provided")


# ── Current User ──

async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)):
    """Extract and validate user from JWT (cookie or Bearer)."""
    from app.models.user import User, UserRole

    token = _extract_token(request)
    try:
        payload = decode_token(token)
    except JWTError:
        raise AuthenticationError("Invalid or expired token")

    user_id = payload.get("sub")
    if not user_id:
        raise AuthenticationError("Invalid token payload")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise AuthenticationError("User not found or inactive")

    request.state.user = user
    request.state.workspace_id = payload.get("wid")
    request.state.token_role = payload.get("role", "user")
    return user


async def get_current_user_optional(request: Request, db: AsyncSession = Depends(get_db)):
    try:
        return await get_current_user(request, db)
    except Exception:
        return None


# ── Workspace ID Extraction (with membership verification) ──

async def get_workspace_id(request: Request, db: AsyncSession = Depends(get_db),
                           user=Depends(get_current_user)) -> str:
    from app.models.workspace import WorkspaceMember

    wid = getattr(request.state, "workspace_id", None)
    if not wid:
        raise AuthorizationError("No workspace context. Re-login or select a workspace.")

    token_role = getattr(request.state, "token_role", "user")
    if token_role == "system_owner":
        return wid

    result = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == wid,
            WorkspaceMember.user_id == user.id,
            WorkspaceMember.is_active == True,
        )
    )
    membership = result.scalar_one_or_none()
    if not membership:
        raise TenantIsolationError("You are not a member of this workspace")

    request.state.workspace_role = membership.role
    return wid


# ── Role Enforcement ──

class RequireRole:
    def __init__(self, *allowed_roles: str):
        self.allowed_roles = set(allowed_roles)

    async def __call__(self, request: Request, db: AsyncSession = Depends(get_db)):
        from app.models.user import User, UserRole

        user = await get_current_user(request, db)
        result = await db.execute(
            select(UserRole.role).where(UserRole.user_id == user.id)
        )
        user_roles = {row[0] for row in result.all()}
        if not user_roles & self.allowed_roles:
            raise AuthorizationError(
                f"Required role(s): {', '.join(self.allowed_roles)}"
            )
        request.state.user_roles = user_roles
        return user


require_system_owner = RequireRole("system_owner")
require_team_admin = RequireRole("system_owner", "team_admin")
require_any_auth = RequireRole("system_owner", "team_admin", "team_member", "user")


# ── System Owner (separate token scope) ──

async def get_system_owner(request: Request, db: AsyncSession = Depends(get_db)):
    from app.models.user import User, UserRole

    token = _extract_token(request)
    try:
        payload = decode_token(token)
    except JWTError:
        raise AuthenticationError("Invalid system token")

    if payload.get("scope") != "system" or payload.get("role") != "system_owner":
        raise AuthorizationError("System owner access required")

    user_id = payload["sub"]
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise AuthenticationError("System owner account not found or inactive")

    role_result = await db.execute(
        select(UserRole).where(UserRole.user_id == user_id, UserRole.role == "system_owner")
    )
    if not role_result.scalar_one_or_none():
        raise AuthorizationError("User does not hold system_owner role")

    request.state.user = user
    request.state.is_system_owner = True
    return user


# ── Workspace Scoping (legacy compat) ──

class WorkspaceScope:
    async def __call__(self, request: Request, db: AsyncSession = Depends(get_db)):
        from app.models.workspace import WorkspaceMember

        user = await get_current_user(request, db)
        workspace_id = request.state.workspace_id

        if not workspace_id:
            raise AuthorizationError("No workspace context. Include workspace in token.")

        token_role = getattr(request.state, "token_role", "user")
        if token_role == "system_owner":
            request.state.workspace_scoped = True
            return user

        result = await db.execute(
            select(WorkspaceMember).where(
                WorkspaceMember.workspace_id == workspace_id,
                WorkspaceMember.user_id == user.id,
                WorkspaceMember.is_active == True,
            )
        )
        membership = result.scalar_one_or_none()
        if not membership:
            raise TenantIsolationError()

        request.state.workspace_scoped = True
        request.state.workspace_role = membership.role
        return user


workspace_scope = WorkspaceScope()
