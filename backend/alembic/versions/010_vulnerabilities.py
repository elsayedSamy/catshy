"""Alembic migration — Phase 8: Vulnerability Intelligence tables."""
revision = "010_vulnerabilities"
down_revision = "009_lifecycle_mitre"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


def upgrade():
    # Vulnerability table
    op.create_table(
        "vulnerabilities",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("workspaces.id"), nullable=True, index=True),
        sa.Column("cve_id", sa.String(30), nullable=False, index=True),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("cvss_score", sa.Float(), nullable=True),
        sa.Column("cvss_vector", sa.String(200), nullable=True),
        sa.Column("severity", sa.String(20), default="medium"),
        sa.Column("cwe_ids", postgresql.ARRAY(sa.String), default=[]),
        sa.Column("references", postgresql.JSONB(), default=[]),
        sa.Column("vendor", sa.String(255), nullable=True),
        sa.Column("product", sa.String(255), nullable=True),
        sa.Column("cpe_uris", postgresql.ARRAY(sa.String), default=[]),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        # KEV fields
        sa.Column("is_kev", sa.Boolean(), default=False, index=True),
        sa.Column("kev_date_added", sa.DateTime(timezone=True), nullable=True),
        sa.Column("kev_due_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("kev_ransomware_use", sa.Boolean(), default=False),
        sa.Column("kev_required_action", sa.Text(), nullable=True),
        # Correlation
        sa.Column("affects_assets", sa.Boolean(), default=False, index=True),
        sa.Column("matched_asset_ids", postgresql.ARRAY(sa.String), default=[]),
        # Status
        sa.Column("status", sa.String(30), default="open"),
        sa.Column("patch_available", sa.Boolean(), default=False),
        sa.Column("analyst_notes", sa.Text(), nullable=True),
        sa.Column("tags", postgresql.ARRAY(sa.String), default=[]),
        sa.Column("source_name", sa.String(255), nullable=True),
        sa.Column("dedup_hash", sa.String(128), index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("workspace_id", "cve_id", name="uq_vuln_cve_per_workspace"),
    )

    # Advisory table
    op.create_table(
        "advisories",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("workspaces.id"), nullable=True, index=True),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("vendor", sa.String(255), nullable=True),
        sa.Column("source_name", sa.String(255), nullable=True),
        sa.Column("source_url", sa.Text(), nullable=True),
        sa.Column("advisory_id", sa.String(100), nullable=True),
        sa.Column("severity", sa.String(20), default="medium"),
        sa.Column("linked_cve_ids", postgresql.ARRAY(sa.String), default=[]),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("fetched_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("dedup_hash", sa.String(128), index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("workspace_id", "dedup_hash", name="uq_advisory_dedup_per_workspace"),
    )


def downgrade():
    op.drop_table("advisories")
    op.drop_table("vulnerabilities")
