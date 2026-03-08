"""Alembic migration — Phase 9: Leak monitoring lifecycle fields."""
revision = "011_leak_lifecycle"
down_revision = "010_vulnerabilities"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column("leak_items", sa.Column("status", sa.String(30), server_default="new", index=True))
    op.add_column("leak_items", sa.Column("analyst_notes", sa.Text(), nullable=True))
    op.add_column("leak_items", sa.Column("linked_case_id", sa.String(100), nullable=True))
    op.add_column("leak_items", sa.Column("attribution_notes", sa.Text(), nullable=True))
    op.add_column("leak_items", sa.Column("dedup_hash", sa.String(128), nullable=True))
    op.add_column("leak_items", sa.Column("fetched_at", sa.DateTime(timezone=True), server_default=sa.func.now()))
    op.add_column("leak_items", sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()))
    op.create_index("ix_leak_items_status", "leak_items", ["status"])
    op.create_index("ix_leak_items_dedup_hash", "leak_items", ["dedup_hash"])


def downgrade():
    op.drop_index("ix_leak_items_dedup_hash")
    op.drop_index("ix_leak_items_status")
    op.drop_column("leak_items", "created_at")
    op.drop_column("leak_items", "fetched_at")
    op.drop_column("leak_items", "dedup_hash")
    op.drop_column("leak_items", "attribution_notes")
    op.drop_column("leak_items", "linked_case_id")
    op.drop_column("leak_items", "analyst_notes")
    op.drop_column("leak_items", "status")
