"""013 — Correlation clusters and correlation links tables."""
import uuid
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY

revision = "013"
down_revision = "012"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "correlation_clusters",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, default=str(uuid.uuid4())),
        sa.Column("workspace_id", UUID(as_uuid=False), sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("name", sa.String(500), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("cluster_type", sa.String(50), nullable=False),  # shared_ioc, shared_actor, shared_infra, temporal, campaign
        sa.Column("severity", sa.String(20), default="medium"),
        sa.Column("confidence", sa.Float, default=0.0),
        sa.Column("status", sa.String(30), default="active"),  # active, merged, resolved, false_positive
        sa.Column("tags", ARRAY(sa.String), default=list),
        sa.Column("pivot_indicators", JSONB, default=list),  # the shared IOCs/values that link items
        sa.Column("summary", sa.Text, nullable=True),
        sa.Column("item_count", sa.Integer, default=0),
        sa.Column("first_seen", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_seen", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "correlation_links",
        sa.Column("id", UUID(as_uuid=False), primary_key=True, default=str(uuid.uuid4())),
        sa.Column("cluster_id", UUID(as_uuid=False), sa.ForeignKey("correlation_clusters.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("intel_item_id", UUID(as_uuid=False), sa.ForeignKey("intel_items.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("link_reason", sa.String(100), nullable=False),  # shared_ip, shared_domain, shared_hash, shared_cve, temporal_proximity
        sa.Column("shared_value", sa.String(500), nullable=True),
        sa.Column("confidence", sa.Float, default=1.0),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("cluster_id", "intel_item_id", name="uq_correlation_link"),
    )

    op.create_index("ix_correlation_clusters_type", "correlation_clusters", ["cluster_type"])
    op.create_index("ix_correlation_clusters_severity", "correlation_clusters", ["severity"])


def downgrade():
    op.drop_table("correlation_links")
    op.drop_table("correlation_clusters")
