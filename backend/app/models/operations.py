"""Operational models — Asset, Source, Alert, Case, Report, Leak, Playbook."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Boolean, Integer, Float, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, ARRAY, JSONB, TSVECTOR
from app.database import Base


def gen_uuid():
    return str(uuid.uuid4())


class Asset(Base):
    __tablename__ = "assets"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    workspace_id = Column(UUID(as_uuid=False), ForeignKey("workspaces.id"), nullable=True, index=True)
    type = Column(String(50), nullable=False, index=True)
    value = Column(String(500), nullable=False, index=True)
    label = Column(String(255))
    criticality = Column(String(20), default="medium")
    tags = Column(ARRAY(String), default=[])
    notes = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Source(Base):
    __tablename__ = "sources"
    id = Column(String(100), primary_key=True)
    workspace_id = Column(UUID(as_uuid=False), ForeignKey("workspaces.id"), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    category = Column(String(50), nullable=False)
    connector_type = Column(String(50), nullable=False)
    default_url = Column(Text)
    resolved_url = Column(Text)
    requires_auth = Column(Boolean, default=False)
    auth_type = Column(String(50))
    auth_credentials = Column(JSONB)  # Encrypted at rest in production
    polling_interval_minutes = Column(Integer, default=60)
    rate_limit_rpm = Column(Integer)
    enabled = Column(Boolean, default=False)
    health = Column(String(20), default="disabled")
    last_fetch_at = Column(DateTime)
    last_error = Column(Text)
    item_count = Column(Integer, default=0)
    consecutive_failures = Column(Integer, default=0)
    backoff_until = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AlertRule(Base):
    __tablename__ = "alert_rules"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    workspace_id = Column(UUID(as_uuid=False), ForeignKey("workspaces.id"), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    conditions = Column(JSONB, nullable=False)
    severity = Column(String(20), default="high")
    channels = Column(ARRAY(String), default=["webhook"])
    enabled = Column(Boolean, default=True)
    created_by = Column(UUID(as_uuid=False), ForeignKey("users.id"))
    last_triggered_at = Column(DateTime)
    trigger_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class Alert(Base):
    __tablename__ = "alerts"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    workspace_id = Column(UUID(as_uuid=False), ForeignKey("workspaces.id"), nullable=True, index=True)
    rule_id = Column(UUID(as_uuid=False), ForeignKey("alert_rules.id"), nullable=False)
    severity = Column(String(20))
    status = Column(String(20), default="new")
    matched_items = Column(ARRAY(String), default=[])
    triggered_at = Column(DateTime, default=datetime.utcnow)
    acknowledged_by = Column(UUID(as_uuid=False), ForeignKey("users.id"))
    resolved_at = Column(DateTime)
    notes = Column(Text, default="")


class Investigation(Base):
    __tablename__ = "investigations"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    workspace_id = Column(UUID(as_uuid=False), ForeignKey("workspaces.id"), nullable=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    notebook_content = Column(Text, default="")
    pinned_evidence = Column(ARRAY(String), default=[])
    linked_entities = Column(ARRAY(String), default=[])
    linked_intel = Column(ARRAY(String), default=[])
    status = Column(String(20), default="active")
    created_by = Column(UUID(as_uuid=False), ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Case(Base):
    __tablename__ = "cases"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    workspace_id = Column(UUID(as_uuid=False), ForeignKey("workspaces.id"), nullable=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    status = Column(String(20), default="open")
    priority = Column(String(20), default="medium")
    assignee_id = Column(UUID(as_uuid=False), ForeignKey("users.id"))
    investigation_ids = Column(ARRAY(String), default=[])
    evidence_ids = Column(ARRAY(String), default=[])
    tasks = Column(JSONB, default=[])
    sla_due_at = Column(DateTime)
    created_by = Column(UUID(as_uuid=False), ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    closed_at = Column(DateTime)


class Report(Base):
    __tablename__ = "reports"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    workspace_id = Column(UUID(as_uuid=False), ForeignKey("workspaces.id"), nullable=True, index=True)
    title = Column(String(255), nullable=False)
    case_id = Column(UUID(as_uuid=False), ForeignKey("cases.id"))
    investigation_id = Column(UUID(as_uuid=False), ForeignKey("investigations.id"))
    format = Column(String(50), nullable=False)
    file_path = Column(Text)
    sections = Column(JSONB, default=[])
    generated_by = Column(UUID(as_uuid=False), ForeignKey("users.id"))
    generated_at = Column(DateTime, default=datetime.utcnow)


class LeakItem(Base):
    __tablename__ = "leak_items"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    workspace_id = Column(UUID(as_uuid=False), ForeignKey("workspaces.id"), nullable=True, index=True)
    type = Column(String(50), nullable=False)
    title = Column(String(500), nullable=False)
    description = Column(Text)
    severity = Column(String(20), default="medium")
    source_name = Column(String(255))
    source_url = Column(Text)
    discovered_at = Column(DateTime, default=datetime.utcnow)
    matched_asset_ids = Column(ARRAY(String), default=[])
    evidence_excerpt = Column(Text)  # Redacted/hashed in production
    provenance = Column(Text)
    is_tor_source = Column(Boolean, default=False)
    search_vector = Column(TSVECTOR)


class Playbook(Base):
    __tablename__ = "playbooks"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    workspace_id = Column(UUID(as_uuid=False), ForeignKey("workspaces.id"), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    trigger = Column(JSONB, default={})
    steps = Column(JSONB, default=[])
    version = Column(Integer, default=1)
    enabled = Column(Boolean, default=True)
    created_by = Column(UUID(as_uuid=False), ForeignKey("users.id"))
    last_run_at = Column(DateTime)
    run_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class PlaybookRun(Base):
    __tablename__ = "playbook_runs"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    playbook_id = Column(UUID(as_uuid=False), ForeignKey("playbooks.id"), nullable=False)
    workspace_id = Column(UUID(as_uuid=False), ForeignKey("workspaces.id"), nullable=True, index=True)
    status = Column(String(20), default="running")
    step_results = Column(JSONB, default=[])
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)
    triggered_by = Column(UUID(as_uuid=False), ForeignKey("users.id"))
