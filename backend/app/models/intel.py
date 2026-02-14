"""Intelligence models — IntelItem, Observable, IntelObservable, IntelMatch, SourceStats, UserFeedback."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Boolean, Integer, Float, DateTime, ForeignKey, UniqueConstraint
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
    # Geo metadata
    geo_lat = Column(Float, nullable=True)
    geo_lon = Column(Float, nullable=True)
    geo_country = Column(String(10), nullable=True, index=True)
    geo_country_name = Column(String(100), nullable=True)
    geo_city = Column(String(200), nullable=True)
    # Campaign grouping
    campaign_id = Column(String(100), nullable=True, index=True)
    campaign_name = Column(String(255), nullable=True)
    # Feedback-adjusted score
    feedback_adjustment = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('workspace_id', 'dedup_hash', name='uq_intel_dedup_per_workspace'),
    )


class Observable(Base):
    """Extracted and normalized observable (IOC) — unique per workspace+type+value."""
    __tablename__ = "observables"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    workspace_id = Column(UUID(as_uuid=False), ForeignKey("workspaces.id"), nullable=True, index=True)
    type = Column(String(50), nullable=False, index=True)  # ip, domain, url, email, hash_md5, hash_sha1, hash_sha256, cve
    value = Column(String(500), nullable=False)
    normalized_value = Column(String(500), nullable=False, index=True)
    first_seen = Column(DateTime, default=datetime.utcnow)
    last_seen = Column(DateTime, default=datetime.utcnow)
    sighting_count = Column(Integer, default=1)
    # GeoIP enrichment
    geo_lat = Column(Float, nullable=True)
    geo_lon = Column(Float, nullable=True)
    geo_country = Column(String(10), nullable=True)
    geo_country_name = Column(String(100), nullable=True)
    geo_city = Column(String(200), nullable=True)
    geo_asn = Column(String(100), nullable=True)
    geo_org = Column(String(255), nullable=True)
    # Enrichment metadata
    enrichment_data = Column(JSONB, default={})
    tags = Column(ARRAY(String), default=[])
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('workspace_id', 'type', 'normalized_value', name='uq_observable_per_workspace'),
    )


class IntelObservable(Base):
    """M2M link between intel_items and observables."""
    __tablename__ = "intel_observables"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    intel_item_id = Column(UUID(as_uuid=False), ForeignKey("intel_items.id", ondelete="CASCADE"), nullable=False, index=True)
    observable_id = Column(UUID(as_uuid=False), ForeignKey("observables.id", ondelete="CASCADE"), nullable=False, index=True)
    context = Column(Text)  # Where in the intel item this observable was found
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('intel_item_id', 'observable_id', name='uq_intel_observable'),
    )


class IntelMatch(Base):
    """Records when an intel item matches an organizational asset."""
    __tablename__ = "intel_matches"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    workspace_id = Column(UUID(as_uuid=False), ForeignKey("workspaces.id"), nullable=True, index=True)
    intel_item_id = Column(UUID(as_uuid=False), ForeignKey("intel_items.id", ondelete="CASCADE"), nullable=False, index=True)
    asset_id = Column(UUID(as_uuid=False), ForeignKey("assets.id", ondelete="CASCADE"), nullable=False, index=True)
    observable_id = Column(UUID(as_uuid=False), ForeignKey("observables.id"), nullable=True)
    match_type = Column(String(50), nullable=False)  # exact, fuzzy, cidr, subdomain
    asset_value = Column(String(500))
    asset_criticality = Column(String(20))
    matched_observable_value = Column(String(500))
    confidence = Column(Float, default=1.0)
    explain_json = Column(JSONB)  # Full explainability payload
    created_at = Column(DateTime, default=datetime.utcnow)


class SourceStats(Base):
    """Per-source reliability and ingestion statistics."""
    __tablename__ = "source_stats"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    source_id = Column(String(100), ForeignKey("sources.id", ondelete="CASCADE"), nullable=False, index=True)
    workspace_id = Column(UUID(as_uuid=False), ForeignKey("workspaces.id"), nullable=True, index=True)
    date = Column(DateTime, nullable=False, index=True)
    items_fetched = Column(Integer, default=0)
    items_new = Column(Integer, default=0)
    items_deduplicated = Column(Integer, default=0)
    items_matched_assets = Column(Integer, default=0)
    false_positive_count = Column(Integer, default=0)
    true_positive_count = Column(Integer, default=0)
    avg_confidence = Column(Float, default=0.0)
    avg_risk = Column(Float, default=0.0)
    reliability_score = Column(Float, default=0.5)  # Adjusted by feedback
    fetch_duration_ms = Column(Integer, default=0)
    error_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class UserFeedback(Base):
    """User feedback on intel items for false-positive learning."""
    __tablename__ = "user_feedback"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    workspace_id = Column(UUID(as_uuid=False), ForeignKey("workspaces.id"), nullable=True, index=True)
    intel_item_id = Column(UUID(as_uuid=False), ForeignKey("intel_items.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    verdict = Column(String(20), nullable=False)  # true_positive, false_positive, needs_review
    reason = Column(Text)
    previous_score = Column(Float)
    adjusted_score = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)


# Keep backward-compat aliases
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
