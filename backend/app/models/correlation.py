"""Correlation models — CorrelationCluster and CorrelationLink."""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Integer, Float, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, ARRAY, JSONB
from app.database import Base


def gen_uuid():
    return str(uuid.uuid4())


def _utcnow():
    return datetime.now(timezone.utc)


class CorrelationCluster(Base):
    """A group of correlated intel items sharing common indicators."""
    __tablename__ = "correlation_clusters"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    workspace_id = Column(UUID(as_uuid=False), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    cluster_type = Column(String(50), nullable=False)  # shared_ioc, shared_actor, shared_infra, temporal, campaign
    severity = Column(String(20), default="medium")
    confidence = Column(Float, default=0.0)
    status = Column(String(30), default="active")  # active, merged, resolved, false_positive
    tags = Column(ARRAY(String), default=list)
    pivot_indicators = Column(JSONB, default=list)  # [{type, value}] — the shared IOCs
    summary = Column(Text, nullable=True)
    item_count = Column(Integer, default=0)
    first_seen = Column(DateTime(timezone=True), nullable=True)
    last_seen = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow)


class CorrelationLink(Base):
    """Links an intel item to a correlation cluster."""
    __tablename__ = "correlation_links"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    cluster_id = Column(UUID(as_uuid=False), ForeignKey("correlation_clusters.id", ondelete="CASCADE"), nullable=False, index=True)
    intel_item_id = Column(UUID(as_uuid=False), ForeignKey("intel_items.id", ondelete="CASCADE"), nullable=False, index=True)
    link_reason = Column(String(100), nullable=False)  # shared_ip, shared_domain, shared_hash, shared_cve, temporal_proximity
    shared_value = Column(String(500), nullable=True)
    confidence = Column(Float, default=1.0)
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    __table_args__ = (
        UniqueConstraint('cluster_id', 'intel_item_id', name='uq_correlation_link'),
    )
