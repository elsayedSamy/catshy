"""System-level models — AuditLog, FeatureFlag, PendingOwnerRequest, SystemAuditLog."""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.database import Base


def gen_uuid():
    return str(uuid.uuid4())


def _utcnow():
    return datetime.now(timezone.utc)


class AuditLog(Base):
    """General audit log for all user actions."""
    __tablename__ = "audit_logs"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    action = Column(String(100), nullable=False, index=True)
    entity_type = Column(String(50))
    entity_id = Column(String(100))
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"))
    user_email = Column(String(255))
    workspace_id = Column(UUID(as_uuid=False), ForeignKey("workspaces.id"), nullable=True)
    details = Column(JSONB, default={})
    ip_address = Column(String(45))
    user_agent = Column(Text, nullable=True)
    outcome = Column(String(20), default="success")
    failure_reason = Column(Text, nullable=True)
    correlation_id = Column(String(100), nullable=True)
    timestamp = Column(DateTime(timezone=True), default=_utcnow, index=True)


class SystemAuditLog(Base):
    """Immutable audit log for system_owner actions only. Separate table for isolation."""
    __tablename__ = "system_audit_logs"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    action = Column(String(100), nullable=False, index=True)
    actor_user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    actor_email = Column(String(255), nullable=False)
    target_user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=True)
    details = Column(JSONB, default={})
    ip_address = Column(String(45))
    user_agent = Column(Text, nullable=True)
    outcome = Column(String(20), default="success")
    timestamp = Column(DateTime(timezone=True), default=_utcnow, index=True)


class PendingOwnerRequest(Base):
    """Tracks requests to become system_owner. Requires approval by existing owner."""
    __tablename__ = "pending_owner_requests"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    requester_user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    requester_email = Column(String(255), nullable=False)
    reason = Column(Text, nullable=True)
    status = Column(String(20), default="pending")
    reviewed_by = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    review_notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)


class FeatureFlag(Base):
    __tablename__ = "feature_flags"
    key = Column(String(100), primary_key=True)
    enabled = Column(Boolean, default=False)
    updated_by = Column(UUID(as_uuid=False), ForeignKey("users.id"))
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)
