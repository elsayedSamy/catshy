"""004 — Intelligence core: observables, intel_observables, intel_matches, source_stats, user_feedback, geo columns.

Revision ID: 004_intelligence_core
Create Date: 2026-02-14
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY

revision = '004_intelligence_core'
down_revision = '003_role_model'
branch_labels = None
depends_on = None


def upgrade():
    # ── Observables ──
    op.create_table('observables',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('workspace_id', UUID(as_uuid=False), sa.ForeignKey('workspaces.id'), nullable=True),
        sa.Column('type', sa.String(50), nullable=False),
        sa.Column('value', sa.String(500), nullable=False),
        sa.Column('normalized_value', sa.String(500), nullable=False),
        sa.Column('first_seen', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('last_seen', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('sighting_count', sa.Integer(), server_default='1'),
        sa.Column('geo_lat', sa.Float(), nullable=True),
        sa.Column('geo_lon', sa.Float(), nullable=True),
        sa.Column('geo_country', sa.String(10), nullable=True),
        sa.Column('geo_country_name', sa.String(100), nullable=True),
        sa.Column('geo_city', sa.String(200), nullable=True),
        sa.Column('geo_asn', sa.String(100), nullable=True),
        sa.Column('geo_org', sa.String(255), nullable=True),
        sa.Column('enrichment_data', JSONB, server_default='{}'),
        sa.Column('tags', ARRAY(sa.String), server_default='{}'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index('ix_observables_workspace', 'observables', ['workspace_id'])
    op.create_index('ix_observables_type', 'observables', ['type'])
    op.create_index('ix_observables_normalized', 'observables', ['normalized_value'])
    op.create_unique_constraint('uq_observable_per_workspace', 'observables', ['workspace_id', 'type', 'normalized_value'])

    # ── Intel-Observable M2M ──
    op.create_table('intel_observables',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('intel_item_id', UUID(as_uuid=False), sa.ForeignKey('intel_items.id', ondelete='CASCADE'), nullable=False),
        sa.Column('observable_id', UUID(as_uuid=False), sa.ForeignKey('observables.id', ondelete='CASCADE'), nullable=False),
        sa.Column('context', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index('ix_io_intel', 'intel_observables', ['intel_item_id'])
    op.create_index('ix_io_obs', 'intel_observables', ['observable_id'])
    op.create_unique_constraint('uq_intel_observable', 'intel_observables', ['intel_item_id', 'observable_id'])

    # ── Intel Matches ──
    op.create_table('intel_matches',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('workspace_id', UUID(as_uuid=False), sa.ForeignKey('workspaces.id'), nullable=True),
        sa.Column('intel_item_id', UUID(as_uuid=False), sa.ForeignKey('intel_items.id', ondelete='CASCADE'), nullable=False),
        sa.Column('asset_id', UUID(as_uuid=False), sa.ForeignKey('assets.id', ondelete='CASCADE'), nullable=False),
        sa.Column('observable_id', UUID(as_uuid=False), sa.ForeignKey('observables.id'), nullable=True),
        sa.Column('match_type', sa.String(50), nullable=False),
        sa.Column('asset_value', sa.String(500)),
        sa.Column('asset_criticality', sa.String(20)),
        sa.Column('matched_observable_value', sa.String(500)),
        sa.Column('confidence', sa.Float(), server_default='1.0'),
        sa.Column('explain_json', JSONB),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index('ix_im_intel', 'intel_matches', ['intel_item_id'])
    op.create_index('ix_im_asset', 'intel_matches', ['asset_id'])
    op.create_index('ix_im_workspace', 'intel_matches', ['workspace_id'])

    # ── Source Stats ──
    op.create_table('source_stats',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('source_id', sa.String(100), sa.ForeignKey('sources.id', ondelete='CASCADE'), nullable=False),
        sa.Column('workspace_id', UUID(as_uuid=False), sa.ForeignKey('workspaces.id'), nullable=True),
        sa.Column('date', sa.DateTime(), nullable=False),
        sa.Column('items_fetched', sa.Integer(), server_default='0'),
        sa.Column('items_new', sa.Integer(), server_default='0'),
        sa.Column('items_deduplicated', sa.Integer(), server_default='0'),
        sa.Column('items_matched_assets', sa.Integer(), server_default='0'),
        sa.Column('false_positive_count', sa.Integer(), server_default='0'),
        sa.Column('true_positive_count', sa.Integer(), server_default='0'),
        sa.Column('avg_confidence', sa.Float(), server_default='0.0'),
        sa.Column('avg_risk', sa.Float(), server_default='0.0'),
        sa.Column('reliability_score', sa.Float(), server_default='0.5'),
        sa.Column('fetch_duration_ms', sa.Integer(), server_default='0'),
        sa.Column('error_count', sa.Integer(), server_default='0'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index('ix_ss_source', 'source_stats', ['source_id'])
    op.create_index('ix_ss_date', 'source_stats', ['date'])

    # ── User Feedback ──
    op.create_table('user_feedback',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('workspace_id', UUID(as_uuid=False), sa.ForeignKey('workspaces.id'), nullable=True),
        sa.Column('intel_item_id', UUID(as_uuid=False), sa.ForeignKey('intel_items.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', UUID(as_uuid=False), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('verdict', sa.String(20), nullable=False),
        sa.Column('reason', sa.Text()),
        sa.Column('previous_score', sa.Float()),
        sa.Column('adjusted_score', sa.Float()),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index('ix_uf_intel', 'user_feedback', ['intel_item_id'])

    # ── Add geo + campaign columns to intel_items ──
    op.add_column('intel_items', sa.Column('geo_lat', sa.Float(), nullable=True))
    op.add_column('intel_items', sa.Column('geo_lon', sa.Float(), nullable=True))
    op.add_column('intel_items', sa.Column('geo_country', sa.String(10), nullable=True))
    op.add_column('intel_items', sa.Column('geo_country_name', sa.String(100), nullable=True))
    op.add_column('intel_items', sa.Column('geo_city', sa.String(200), nullable=True))
    op.add_column('intel_items', sa.Column('campaign_id', sa.String(100), nullable=True))
    op.add_column('intel_items', sa.Column('campaign_name', sa.String(255), nullable=True))
    op.add_column('intel_items', sa.Column('feedback_adjustment', sa.Float(), server_default='0.0'))
    op.create_index('ix_intel_geo_country', 'intel_items', ['geo_country'])
    op.create_index('ix_intel_campaign', 'intel_items', ['campaign_id'])

    # ── Unique dedup_hash per workspace ──
    op.create_unique_constraint('uq_intel_dedup_per_workspace', 'intel_items', ['workspace_id', 'dedup_hash'])

    # ── Remove old observable columns from intel_items (now in observables table) ──
    # Keep observable_type and observable_value for backward compat — they store the primary observable


def downgrade():
    op.drop_constraint('uq_intel_dedup_per_workspace', 'intel_items', type_='unique')
    op.drop_index('ix_intel_campaign', table_name='intel_items')
    op.drop_index('ix_intel_geo_country', table_name='intel_items')
    for col in ['geo_lat', 'geo_lon', 'geo_country', 'geo_country_name', 'geo_city',
                'campaign_id', 'campaign_name', 'feedback_adjustment']:
        op.drop_column('intel_items', col)

    op.drop_table('user_feedback')
    op.drop_table('source_stats')
    op.drop_table('intel_matches')
    op.drop_table('intel_observables')
    op.drop_table('observables')
