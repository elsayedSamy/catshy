"""Intelligence models — IntelItem, Entity, EntityRelationship."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Boolean, Integer, Float, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, ARRAY, JSONB, TSVECTOR
from app.database import Base


def gen_uuid():
    return str(uuid.uuid4())


class IntelItem(Base):
    __tablename__ = "intel_items"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    workspace_id = Column(UUID(as_uuid=False), ForeignKey("workspaces.id"), nullable=True, index=True)
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


class Entity(Base):
    __tablename__ = "entities"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    workspace_id = Column(UUID(as_uuid=False), ForeignKey("workspaces.id"), nullable=True, index=True)
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
