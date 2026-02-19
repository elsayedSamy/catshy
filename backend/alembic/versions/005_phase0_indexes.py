"""005 — Phase 0: Add missing performance indexes on intel_items.

Revision ID: 005_phase0_indexes
Create Date: 2026-02-19
"""
from alembic import op

revision = '005_phase0_indexes'
down_revision = '004_intelligence_core'
branch_labels = None
depends_on = None


def upgrade():
    # Indexes required by Phase 0 — Data Integrity Foundation
    op.create_index('ix_intel_fetched_at', 'intel_items', ['fetched_at'])
    op.create_index('ix_intel_published_at', 'intel_items', ['published_at'])
    op.create_index('ix_intel_severity', 'intel_items', ['severity'])
    op.create_index('ix_intel_source_id', 'intel_items', ['source_id'])
    op.create_index('ix_intel_risk_score', 'intel_items', ['risk_score'])
    op.create_index('ix_intel_confidence_score', 'intel_items', ['confidence_score'])
    op.create_index('ix_intel_asset_match', 'intel_items', ['asset_match'])
    op.create_index('ix_intel_workspace_id', 'intel_items', ['workspace_id'])


def downgrade():
    op.drop_index('ix_intel_workspace_id', table_name='intel_items')
    op.drop_index('ix_intel_asset_match', table_name='intel_items')
    op.drop_index('ix_intel_confidence_score', table_name='intel_items')
    op.drop_index('ix_intel_risk_score', table_name='intel_items')
    op.drop_index('ix_intel_source_id', table_name='intel_items')
    op.drop_index('ix_intel_severity', table_name='intel_items')
    op.drop_index('ix_intel_published_at', table_name='intel_items')
    op.drop_index('ix_intel_fetched_at', table_name='intel_items')
