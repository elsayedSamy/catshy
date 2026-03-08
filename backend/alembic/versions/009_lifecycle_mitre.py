"""Alembic migration 009 — IOC lifecycle + MITRE ATT&CK structured mapping."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "009_lifecycle_mitre"
down_revision = "008_source_health_deadletter"
branch_labels = None
depends_on = None


def upgrade():
    # ── IntelItem lifecycle + MITRE columns ──
    op.add_column("intel_items", sa.Column("status", sa.String(30), server_default="active", index=True))
    op.add_column("intel_items", sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("intel_items", sa.Column("analyst_verdict", sa.String(30), nullable=True))
    op.add_column("intel_items", sa.Column("verdict_reason", sa.Text, nullable=True))
    op.add_column("intel_items", sa.Column("analyst_notes", sa.Text, nullable=True))
    op.add_column("intel_items", sa.Column("mitre_technique_ids", postgresql.ARRAY(sa.String), server_default="{}"))
    op.add_column("intel_items", sa.Column("mitre_tactics", postgresql.ARRAY(sa.String), server_default="{}"))
    op.add_column("intel_items", sa.Column("mitre_mapping_confidence", sa.Float, server_default="0"))
    op.add_column("intel_items", sa.Column("mitre_mapping_source", sa.String(30), nullable=True))
    op.create_index("ix_intel_items_status", "intel_items", ["status"])

    # ── Observable lifecycle columns ──
    op.add_column("observables", sa.Column("status", sa.String(30), server_default="active", index=True))
    op.add_column("observables", sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_observables_status", "observables", ["status"])


def downgrade():
    op.drop_index("ix_observables_status", table_name="observables")
    op.drop_column("observables", "expires_at")
    op.drop_column("observables", "status")
    op.drop_index("ix_intel_items_status", table_name="intel_items")
    op.drop_column("intel_items", "mitre_mapping_source")
    op.drop_column("intel_items", "mitre_mapping_confidence")
    op.drop_column("intel_items", "mitre_tactics")
    op.drop_column("intel_items", "mitre_technique_ids")
    op.drop_column("intel_items", "analyst_notes")
    op.drop_column("intel_items", "verdict_reason")
    op.drop_column("intel_items", "analyst_verdict")
    op.drop_column("intel_items", "expires_at")
    op.drop_column("intel_items", "status")
