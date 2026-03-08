"""Alembic migration 008 — source health columns + failed_ingestions dead-letter table."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "008_source_health_deadletter"
down_revision = "007_integrations_settings"
branch_labels = None
depends_on = None


def upgrade():
    # Add health-tracking columns to sources
    op.add_column("sources", sa.Column("next_fetch_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("sources", sa.Column("last_success_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("sources", sa.Column("backoff_seconds", sa.Integer, server_default="0"))
    op.add_column("sources", sa.Column("last_fetched_count", sa.Integer, server_default="0"))
    op.add_column("sources", sa.Column("last_new_count", sa.Integer, server_default="0"))
    op.add_column("sources", sa.Column("last_dedup_count", sa.Integer, server_default="0"))

    # Dead-letter / failed ingestions table
    op.create_table(
        "failed_ingestions",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=False),
                  sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("source_id", sa.String(100),
                  sa.ForeignKey("sources.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("source_name", sa.String(255)),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("error_type", sa.String(100), nullable=False),
        sa.Column("error_message", sa.Text),
        sa.Column("retry_count", sa.Integer, server_default="0"),
        sa.Column("max_retries", sa.Integer, server_default="3"),
        sa.Column("status", sa.String(30), server_default="'failed'"),  # failed, retrying, resolved, abandoned
        sa.Column("raw_response_excerpt", sa.Text, nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_failed_ingestions_status", "failed_ingestions", ["status"])


def downgrade():
    op.drop_table("failed_ingestions")
    op.drop_column("sources", "last_dedup_count")
    op.drop_column("sources", "last_new_count")
    op.drop_column("sources", "last_fetched_count")
    op.drop_column("sources", "backoff_seconds")
    op.drop_column("sources", "last_success_at")
    op.drop_column("sources", "next_fetch_at")
