"""Output connector models — Webhook, Syslog, Export Job tracking."""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Boolean, Integer, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, ARRAY, JSONB
from app.database import Base


def gen_uuid():
    return str(uuid.uuid4())


def _utcnow():
    return datetime.now(timezone.utc)


class WebhookOutput(Base):
    """Per-workspace outbound webhook connector."""
    __tablename__ = "webhook_outputs"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    workspace_id = Column(UUID(as_uuid=False), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    url = Column(Text, nullable=False)
    auth_type = Column(String(30), default="none")  # none, bearer, hmac, basic
    encrypted_secret = Column(Text, nullable=True)   # Fernet-encrypted
    custom_headers = Column(JSONB, default=dict)
    event_types = Column(ARRAY(String), default=list)  # new_intel, new_alert, new_leak, vuln_kev, report_generated, source_failure
    enabled = Column(Boolean, default=True)
    last_triggered_at = Column(DateTime(timezone=True), nullable=True)
    last_status_code = Column(Integer, nullable=True)
    last_error = Column(Text, nullable=True)
    consecutive_failures = Column(Integer, default=0)
    created_by = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


class ExportJob(Base):
    """Tracks export/output job history — webhook deliveries, report exports, STIX exports."""
    __tablename__ = "export_jobs"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    workspace_id = Column(UUID(as_uuid=False), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    job_type = Column(String(50), nullable=False)  # webhook, pdf, csv, json, stix, syslog
    target = Column(String(500))  # webhook URL or filename
    event_type = Column(String(100), nullable=True)
    status = Column(String(30), default="pending")  # pending, success, failed, retrying
    status_code = Column(Integer, nullable=True)
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0)
    payload_summary = Column(Text, nullable=True)  # truncated summary, no secrets
    created_by = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    completed_at = Column(DateTime(timezone=True), nullable=True)


class SyslogOutput(Base):
    """Per-workspace syslog/CEF output configuration."""
    __tablename__ = "syslog_outputs"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    workspace_id = Column(UUID(as_uuid=False), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    host = Column(String(255), nullable=False)
    port = Column(Integer, default=514)
    protocol = Column(String(10), default="udp")  # udp, tcp, tls
    format = Column(String(20), default="cef")  # cef, rfc5424
    event_types = Column(ARRAY(String), default=list)
    enabled = Column(Boolean, default=True)
    last_sent_at = Column(DateTime(timezone=True), nullable=True)
    last_error = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
