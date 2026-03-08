"""Workspace Integrations + Settings models — per-workspace BYOK API keys and configuration."""
import sqlalchemy as sa
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Boolean, DateTime, ForeignKey, Integer, Float, JSON
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


def gen_uuid():
    return str(uuid.uuid4())


def _utcnow():
    return datetime.now(timezone.utc)


class WorkspaceIntegration(Base):
    """Per-workspace integration provider config (BYOK API keys, encrypted at rest)."""
    __tablename__ = "workspace_integrations"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    workspace_id = Column(UUID(as_uuid=False), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    provider = Column(String(50), nullable=False, index=True)  # virustotal, shodan, abuseipdb, otx, etc.
    enabled = Column(Boolean, default=False)
    encrypted_api_key = Column(Text, nullable=True)  # Fernet-encrypted
    status = Column(String(30), default="not_configured")  # not_configured, active, error
    last_success = Column(DateTime(timezone=True), nullable=True)
    last_error = Column(Text, nullable=True)
    last_checked = Column(DateTime(timezone=True), nullable=True)
    config = Column(JSON, default=dict)  # Provider-specific extra config
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    __table_args__ = (
        {"extend_existing": True},
        sa.UniqueConstraint("workspace_id", "provider", name="uq_workspace_provider"),
    )


class WorkspaceSettings(Base):
    """Per-workspace configurable settings."""
    __tablename__ = "workspace_settings"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    workspace_id = Column(UUID(as_uuid=False), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)

    # Retention
    retention_days = Column(Integer, default=30)

    # Polling
    default_polling_interval_minutes = Column(Integer, default=5)

    # Risk scoring weights (optional tuning)
    risk_weight_severity = Column(Float, default=0.4)
    risk_weight_asset_relevance = Column(Float, default=0.3)
    risk_weight_confidence = Column(Float, default=0.2)
    risk_weight_recency = Column(Float, default=0.1)

    # Notification preferences
    notify_on_critical = Column(Boolean, default=True)
    notify_on_high = Column(Boolean, default=True)
    notify_on_medium = Column(Boolean, default=False)
    notify_on_low = Column(Boolean, default=False)
    notify_on_asset_match = Column(Boolean, default=True)

    # Misc
    timezone = Column(String(50), default="UTC")
    auto_enrich = Column(Boolean, default=True)

    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)
