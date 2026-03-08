"""Alembic migration 007 — workspace integrations + settings tables."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "007_integrations_settings"
down_revision = "006_add_observable_columns"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "workspace_integrations",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("provider", sa.String(50), nullable=False, index=True),
        sa.Column("enabled", sa.Boolean, default=False),
        sa.Column("encrypted_api_key", sa.Text, nullable=True),
        sa.Column("status", sa.String(30), default="not_configured"),
        sa.Column("last_success", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text, nullable=True),
        sa.Column("last_checked", sa.DateTime(timezone=True), nullable=True),
        sa.Column("config", sa.JSON, default=dict),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("workspace_id", "provider", name="uq_workspace_provider"),
    )

    op.create_table(
        "workspace_settings",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, unique=True, index=True),
        sa.Column("retention_days", sa.Integer, default=30),
        sa.Column("default_polling_interval_minutes", sa.Integer, default=5),
        sa.Column("risk_weight_severity", sa.Float, default=0.4),
        sa.Column("risk_weight_asset_relevance", sa.Float, default=0.3),
        sa.Column("risk_weight_confidence", sa.Float, default=0.2),
        sa.Column("risk_weight_recency", sa.Float, default=0.1),
        sa.Column("notify_on_critical", sa.Boolean, default=True),
        sa.Column("notify_on_high", sa.Boolean, default=True),
        sa.Column("notify_on_medium", sa.Boolean, default=False),
        sa.Column("notify_on_low", sa.Boolean, default=False),
        sa.Column("notify_on_asset_match", sa.Boolean, default=True),
        sa.Column("timezone", sa.String(50), default="UTC"),
        sa.Column("auto_enrich", sa.Boolean, default=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade():
    op.drop_table("workspace_settings")
    op.drop_table("workspace_integrations")
