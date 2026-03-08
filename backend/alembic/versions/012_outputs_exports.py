"""012 — webhook outputs, syslog outputs, export jobs tables

Revision ID: 012
Revises: 011
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY

revision = "012"
down_revision = "011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "webhook_outputs",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("workspace_id", UUID(as_uuid=False), sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("url", sa.Text, nullable=False),
        sa.Column("auth_type", sa.String(30), server_default="none"),
        sa.Column("encrypted_secret", sa.Text, nullable=True),
        sa.Column("custom_headers", JSONB, server_default="{}"),
        sa.Column("event_types", ARRAY(sa.String), server_default="{}"),
        sa.Column("enabled", sa.Boolean, server_default="true"),
        sa.Column("last_triggered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_status_code", sa.Integer, nullable=True),
        sa.Column("last_error", sa.Text, nullable=True),
        sa.Column("consecutive_failures", sa.Integer, server_default="0"),
        sa.Column("created_by", UUID(as_uuid=False), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "export_jobs",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("workspace_id", UUID(as_uuid=False), sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("job_type", sa.String(50), nullable=False),
        sa.Column("target", sa.String(500), nullable=True),
        sa.Column("event_type", sa.String(100), nullable=True),
        sa.Column("status", sa.String(30), server_default="pending"),
        sa.Column("status_code", sa.Integer, nullable=True),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("retry_count", sa.Integer, server_default="0"),
        sa.Column("payload_summary", sa.Text, nullable=True),
        sa.Column("created_by", UUID(as_uuid=False), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "syslog_outputs",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("workspace_id", UUID(as_uuid=False), sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("host", sa.String(255), nullable=False),
        sa.Column("port", sa.Integer, server_default="514"),
        sa.Column("protocol", sa.String(10), server_default="udp"),
        sa.Column("format", sa.String(20), server_default="cef"),
        sa.Column("event_types", ARRAY(sa.String), server_default="{}"),
        sa.Column("enabled", sa.Boolean, server_default="true"),
        sa.Column("last_sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("syslog_outputs")
    op.drop_table("export_jobs")
    op.drop_table("webhook_outputs")
