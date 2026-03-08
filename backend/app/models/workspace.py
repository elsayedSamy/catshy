"""Workspace & WorkspaceMember — tenant isolation models."""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


def gen_uuid():
    return str(uuid.uuid4())


def _utcnow():
    return datetime.now(timezone.utc)


class Workspace(Base):
    """A workspace/team is the tenant boundary. All intel, assets, cases are scoped to a workspace."""
    __tablename__ = "workspaces"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    name = Column(String(255), nullable=False)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(Text, default="")
    owner_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    is_active = Column(Boolean, default=True)
    settings = Column(Text, default="{}")
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


class WorkspaceMember(Base):
    """Maps users to workspaces with a workspace-level role."""
    __tablename__ = "workspace_members"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    workspace_id = Column(UUID(as_uuid=False), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(50), nullable=False, default="team_member")
    is_active = Column(Boolean, default=True)
    joined_at = Column(DateTime(timezone=True), default=_utcnow)

    __table_args__ = (
        UniqueConstraint("workspace_id", "user_id", name="uq_workspace_user"),
    )
