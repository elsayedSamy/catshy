"""CATSHY — All SQLAlchemy Models"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Boolean, Integer, Float, DateTime, ForeignKey, JSON, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID, ARRAY, JSONB, TSVECTOR
from sqlalchemy.orm import relationship
from app.database import Base

def gen_uuid():
    return str(uuid.uuid4())

# ── Users & Auth ──
class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="analyst")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    token_hash = Column(String(255), nullable=False, unique=True)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class AuthToken(Base):
    """One-time tokens for invite sign-up and password reset"""
    __tablename__ = "auth_tokens"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    token_hash = Column(String(255), nullable=False, unique=True, index=True)
    token_type = Column(String(20), nullable=False)  # "invite" or "reset"
    email = Column(String(255), nullable=False)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=True)
    role = Column(String(50), default="analyst")
    name = Column(String(255), nullable=True)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

# ── Assets ──
class Asset(Base):
    __tablename__ = "assets"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    type = Column(String(50), nullable=False, index=True)
    value = Column(String(500), nullable=False, index=True)
    label = Column(String(255))
    criticality = Column(String(20), default="medium")
    tags = Column(ARRAY(String), default=[])
    notes = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# ── Sources ──
class Source(Base):
    __tablename__ = "sources"
    id = Column(String(100), primary_key=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    category = Column(String(50), nullable=False)
    connector_type = Column(String(50), nullable=False)
    default_url = Column(Text)
    resolved_url = Column(Text)
    requires_auth = Column(Boolean, default=False)
    auth_type = Column(String(50))
    auth_credentials = Column(JSONB)
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

# ── Intel Items ──
class IntelItem(Base):
    __tablename__ = "intel_items"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    title = Column(String(500), nullable=False)
    description = Column(Text)
    severity = Column(String(20), default="info")
    observable_type = Column(String(50), index=True)
    observable_value = Column(String(500), index=True)
    canonical_value = Column(String(500), index=True)
    source_id = Column(String(100), ForeignKey("sources.id"))
    source_name = Column(String(255))
    fetched_at = Column(DateTime, default=datetime.utcnow)
    published_at = Column(DateTime)
    original_url = Column(Text)
    excerpt = Column(Text)
    dedup_hash = Column(String(128), index=True)
    dedup_count = Column(Integer, default=1)
    asset_match = Column(Boolean, default=False)
    matched_asset_ids = Column(ARRAY(String), default=[])
    confidence_score = Column(Float, default=0.0)
    risk_score = Column(Float, default=0.0)
    score_explanation = Column(JSONB)
    tags = Column(ARRAY(String), default=[])
    raw_data = Column(JSONB)
    search_vector = Column(TSVECTOR)
    created_at = Column(DateTime, default=datetime.utcnow)

# ── Entities (STIX-like) ──
class Entity(Base):
    __tablename__ = "entities"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    type = Column(String(50), nullable=False, index=True)
    name = Column(String(500), nullable=False)
    description = Column(Text)
    properties = Column(JSONB, default={})
    first_seen = Column(DateTime)
    last_seen = Column(DateTime)
    confidence = Column(Float, default=0.5)
    source_refs = Column(ARRAY(String), default=[])
    search_vector = Column(TSVECTOR)
    created_at = Column(DateTime, default=datetime.utcnow)

class EntityRelationship(Base):
    __tablename__ = "entity_relationships"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    source_entity_id = Column(UUID(as_uuid=False), ForeignKey("entities.id"), nullable=False, index=True)
    target_entity_id = Column(UUID(as_uuid=False), ForeignKey("entities.id"), nullable=False, index=True)
    relationship_type = Column(String(100), nullable=False)
    confidence = Column(Float, default=0.5)
    first_seen = Column(DateTime)
    last_seen = Column(DateTime)
    evidence_refs = Column(ARRAY(String), default=[])
    created_at = Column(DateTime, default=datetime.utcnow)

# ── Alert Rules & Alerts ──
class AlertRule(Base):
    __tablename__ = "alert_rules"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
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
    rule_id = Column(UUID(as_uuid=False), ForeignKey("alert_rules.id"), nullable=False)
    severity = Column(String(20))
    status = Column(String(20), default="new")
    matched_items = Column(ARRAY(String), default=[])
    triggered_at = Column(DateTime, default=datetime.utcnow)
    acknowledged_by = Column(UUID(as_uuid=False), ForeignKey("users.id"))
    resolved_at = Column(DateTime)
    notes = Column(Text, default="")

# ── Investigations ──
class Investigation(Base):
    __tablename__ = "investigations"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
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

# ── Cases ──
class Case(Base):
    __tablename__ = "cases"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
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

# ── Reports ──
class Report(Base):
    __tablename__ = "reports"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    title = Column(String(255), nullable=False)
    case_id = Column(UUID(as_uuid=False), ForeignKey("cases.id"))
    investigation_id = Column(UUID(as_uuid=False), ForeignKey("investigations.id"))
    format = Column(String(50), nullable=False)
    file_path = Column(Text)
    sections = Column(JSONB, default=[])
    generated_by = Column(UUID(as_uuid=False), ForeignKey("users.id"))
    generated_at = Column(DateTime, default=datetime.utcnow)

# ── Leaks ──
class LeakItem(Base):
    __tablename__ = "leak_items"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    type = Column(String(50), nullable=False)
    title = Column(String(500), nullable=False)
    description = Column(Text)
    severity = Column(String(20), default="medium")
    source_name = Column(String(255))
    source_url = Column(Text)
    discovered_at = Column(DateTime, default=datetime.utcnow)
    matched_asset_ids = Column(ARRAY(String), default=[])
    evidence_excerpt = Column(Text)
    provenance = Column(Text)
    is_tor_source = Column(Boolean, default=False)
    search_vector = Column(TSVECTOR)

# ── Playbooks ──
class Playbook(Base):
    __tablename__ = "playbooks"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    name = Column(String(255), nullable=False)
    description = Column(Text)
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
    status = Column(String(20), default="running")
    step_results = Column(JSONB, default=[])
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)
    triggered_by = Column(UUID(as_uuid=False), ForeignKey("users.id"))

# ── Audit Log ──
class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    action = Column(String(100), nullable=False, index=True)
    entity_type = Column(String(50))
    entity_id = Column(String(100))
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"))
    user_email = Column(String(255))
    details = Column(JSONB, default={})
    ip_address = Column(String(45))
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

# ── Feature Flags ──
class FeatureFlag(Base):
    __tablename__ = "feature_flags"
    key = Column(String(100), primary_key=True)
    enabled = Column(Boolean, default=False)
    updated_by = Column(UUID(as_uuid=False), ForeignKey("users.id"))
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
