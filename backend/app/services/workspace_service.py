"""Service layer — workspace service. Tenant creation and membership management."""
import logging
import re
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.exceptions import ConflictError, NotFoundError, AuthorizationError
from app.models.workspace import Workspace, WorkspaceMember
from app.models.user import UserRole
from app.models.system import AuditLog

logger = logging.getLogger("catshy.workspace_service")


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug[:100]


async def create_workspace(name: str, owner_id: str, owner_email: str, db: AsyncSession) -> Workspace:
    """Create a new workspace and add owner as team_admin."""
    slug = _slugify(name)

    # Check slug uniqueness
    existing = await db.execute(select(Workspace).where(Workspace.slug == slug))
    if existing.scalar_one_or_none():
        raise ConflictError(f"Workspace slug '{slug}' already exists")

    workspace = Workspace(name=name, slug=slug, owner_id=owner_id)
    db.add(workspace)
    await db.flush()

    # Add owner as team_admin member
    member = WorkspaceMember(
        workspace_id=workspace.id,
        user_id=owner_id,
        role="team_admin",
    )
    db.add(member)

    # Also ensure user has team_admin role if not already
    role_result = await db.execute(
        select(UserRole).where(UserRole.user_id == owner_id, UserRole.role == "team_admin")
    )
    if not role_result.scalar_one_or_none():
        db.add(UserRole(user_id=owner_id, role="team_admin"))

    db.add(AuditLog(
        action="WORKSPACE_CREATED", entity_type="workspace",
        entity_id=workspace.id, user_id=owner_id, user_email=owner_email,
        workspace_id=workspace.id,
    ))
    await db.commit()
    return workspace


async def add_member(workspace_id: str, user_id: str, role: str, actor_id: str, db: AsyncSession):
    """Add a user to a workspace. Actor must be team_admin of that workspace."""
    # Verify actor is team_admin
    actor_membership = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == actor_id,
            WorkspaceMember.role == "team_admin",
        )
    )
    if not actor_membership.scalar_one_or_none():
        raise AuthorizationError("Only team admins can add members")

    # Check if already a member
    existing = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
        )
    )
    if existing.scalar_one_or_none():
        raise ConflictError("User is already a member of this workspace")

    member = WorkspaceMember(workspace_id=workspace_id, user_id=user_id, role=role)
    db.add(member)
    await db.commit()
    return member


async def remove_member(workspace_id: str, user_id: str, actor_id: str, db: AsyncSession):
    """Remove a user from a workspace."""
    result = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise NotFoundError("Membership")

    await db.delete(member)
    await db.commit()


async def list_user_workspaces(user_id: str, db: AsyncSession) -> list:
    """List all workspaces a user belongs to."""
    result = await db.execute(
        select(Workspace, WorkspaceMember.role).join(
            WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id
        ).where(WorkspaceMember.user_id == user_id, WorkspaceMember.is_active == True)
    )
    return [
        {"id": ws.id, "name": ws.name, "slug": ws.slug, "role": role}
        for ws, role in result.all()
    ]
