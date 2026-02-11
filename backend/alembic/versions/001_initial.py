"""001 — Initial schema: all Phase 1-3 tables

Revision ID: 001_initial
Create Date: 2025-01-01
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, ARRAY, JSONB, TSVECTOR

revision = '001_initial'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # Users
    op.create_table('users',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('email', sa.String(255), unique=True, nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('hashed_password', sa.String(255), nullable=False),
        sa.Column('role', sa.String(50), nullable=False, server_default='analyst'),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index('ix_users_email', 'users', ['email'])

    # Refresh Tokens
    op.create_table('refresh_tokens',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=False), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('token_hash', sa.String(255), unique=True, nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )

    # Assets
    op.create_table('assets',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('type', sa.String(50), nullable=False),
        sa.Column('value', sa.String(500), nullable=False),
        sa.Column('label', sa.String(255)),
        sa.Column('criticality', sa.String(20), server_default='medium'),
        sa.Column('tags', ARRAY(sa.String), server_default='{}'),
        sa.Column('notes', sa.Text(), server_default=''),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index('ix_assets_type', 'assets', ['type'])
    op.create_index('ix_assets_value', 'assets', ['value'])

    # Sources
    op.create_table('sources',
        sa.Column('id', sa.String(100), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text()),
        sa.Column('category', sa.String(50), nullable=False),
        sa.Column('connector_type', sa.String(50), nullable=False),
        sa.Column('default_url', sa.Text()),
        sa.Column('resolved_url', sa.Text()),
        sa.Column('requires_auth', sa.Boolean(), server_default='false'),
        sa.Column('auth_type', sa.String(50)),
        sa.Column('auth_credentials', JSONB),
        sa.Column('polling_interval_minutes', sa.Integer(), server_default='60'),
        sa.Column('rate_limit_rpm', sa.Integer()),
        sa.Column('enabled', sa.Boolean(), server_default='false'),
        sa.Column('health', sa.String(20), server_default='disabled'),
        sa.Column('last_fetch_at', sa.DateTime()),
        sa.Column('last_error', sa.Text()),
        sa.Column('item_count', sa.Integer(), server_default='0'),
        sa.Column('consecutive_failures', sa.Integer(), server_default='0'),
        sa.Column('backoff_until', sa.DateTime()),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
    )

    # Intel Items
    op.create_table('intel_items',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('description', sa.Text()),
        sa.Column('severity', sa.String(20), server_default='info'),
        sa.Column('observable_type', sa.String(50)),
        sa.Column('observable_value', sa.String(500)),
        sa.Column('canonical_value', sa.String(500)),
        sa.Column('source_id', sa.String(100), sa.ForeignKey('sources.id')),
        sa.Column('source_name', sa.String(255)),
        sa.Column('fetched_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('published_at', sa.DateTime()),
        sa.Column('original_url', sa.Text()),
        sa.Column('excerpt', sa.Text()),
        sa.Column('dedup_hash', sa.String(128)),
        sa.Column('dedup_count', sa.Integer(), server_default='1'),
        sa.Column('asset_match', sa.Boolean(), server_default='false'),
        sa.Column('matched_asset_ids', ARRAY(sa.String), server_default='{}'),
        sa.Column('confidence_score', sa.Float(), server_default='0'),
        sa.Column('risk_score', sa.Float(), server_default='0'),
        sa.Column('score_explanation', JSONB),
        sa.Column('tags', ARRAY(sa.String), server_default='{}'),
        sa.Column('raw_data', JSONB),
        sa.Column('search_vector', TSVECTOR),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index('ix_intel_observable_type', 'intel_items', ['observable_type'])
    op.create_index('ix_intel_observable_value', 'intel_items', ['observable_value'])
    op.create_index('ix_intel_dedup_hash', 'intel_items', ['dedup_hash'])
    op.create_index('ix_intel_search_vector', 'intel_items', ['search_vector'], postgresql_using='gin')

    # Auto-update search_vector trigger
    op.execute("""
        CREATE OR REPLACE FUNCTION intel_search_vector_update() RETURNS trigger AS $$
        BEGIN
            NEW.search_vector := to_tsvector('english',
                coalesce(NEW.title, '') || ' ' ||
                coalesce(NEW.description, '') || ' ' ||
                coalesce(NEW.observable_value, '') || ' ' ||
                coalesce(NEW.source_name, '')
            );
            RETURN NEW;
        END
        $$ LANGUAGE plpgsql;

        CREATE TRIGGER intel_search_vector_trigger
        BEFORE INSERT OR UPDATE ON intel_items
        FOR EACH ROW EXECUTE FUNCTION intel_search_vector_update();
    """)

    # Entities
    op.create_table('entities',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('type', sa.String(50), nullable=False),
        sa.Column('name', sa.String(500), nullable=False),
        sa.Column('description', sa.Text()),
        sa.Column('properties', JSONB, server_default='{}'),
        sa.Column('first_seen', sa.DateTime()),
        sa.Column('last_seen', sa.DateTime()),
        sa.Column('confidence', sa.Float(), server_default='0.5'),
        sa.Column('source_refs', ARRAY(sa.String), server_default='{}'),
        sa.Column('search_vector', TSVECTOR),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index('ix_entities_type', 'entities', ['type'])
    op.create_index('ix_entities_search_vector', 'entities', ['search_vector'], postgresql_using='gin')

    op.execute("""
        CREATE OR REPLACE FUNCTION entity_search_vector_update() RETURNS trigger AS $$
        BEGIN
            NEW.search_vector := to_tsvector('english', coalesce(NEW.name, '') || ' ' || coalesce(NEW.description, ''));
            RETURN NEW;
        END
        $$ LANGUAGE plpgsql;
        CREATE TRIGGER entity_search_vector_trigger BEFORE INSERT OR UPDATE ON entities FOR EACH ROW EXECUTE FUNCTION entity_search_vector_update();
    """)

    # Entity Relationships
    op.create_table('entity_relationships',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('source_entity_id', UUID(as_uuid=False), sa.ForeignKey('entities.id'), nullable=False),
        sa.Column('target_entity_id', UUID(as_uuid=False), sa.ForeignKey('entities.id'), nullable=False),
        sa.Column('relationship_type', sa.String(100), nullable=False),
        sa.Column('confidence', sa.Float(), server_default='0.5'),
        sa.Column('first_seen', sa.DateTime()),
        sa.Column('last_seen', sa.DateTime()),
        sa.Column('evidence_refs', ARRAY(sa.String), server_default='{}'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )

    # Alert Rules
    op.create_table('alert_rules',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text()),
        sa.Column('conditions', JSONB, nullable=False),
        sa.Column('severity', sa.String(20), server_default='high'),
        sa.Column('channels', ARRAY(sa.String), server_default="{'webhook'}"),
        sa.Column('enabled', sa.Boolean(), server_default='true'),
        sa.Column('created_by', UUID(as_uuid=False), sa.ForeignKey('users.id')),
        sa.Column('last_triggered_at', sa.DateTime()),
        sa.Column('trigger_count', sa.Integer(), server_default='0'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )

    # Alerts
    op.create_table('alerts',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('rule_id', UUID(as_uuid=False), sa.ForeignKey('alert_rules.id'), nullable=False),
        sa.Column('severity', sa.String(20)),
        sa.Column('status', sa.String(20), server_default='new'),
        sa.Column('matched_items', ARRAY(sa.String), server_default='{}'),
        sa.Column('triggered_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('acknowledged_by', UUID(as_uuid=False), sa.ForeignKey('users.id')),
        sa.Column('resolved_at', sa.DateTime()),
        sa.Column('notes', sa.Text(), server_default=''),
    )

    # Investigations
    op.create_table('investigations',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text()),
        sa.Column('notebook_content', sa.Text(), server_default=''),
        sa.Column('pinned_evidence', ARRAY(sa.String), server_default='{}'),
        sa.Column('linked_entities', ARRAY(sa.String), server_default='{}'),
        sa.Column('linked_intel', ARRAY(sa.String), server_default='{}'),
        sa.Column('status', sa.String(20), server_default='active'),
        sa.Column('created_by', UUID(as_uuid=False), sa.ForeignKey('users.id')),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
    )

    # Cases
    op.create_table('cases',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text()),
        sa.Column('status', sa.String(20), server_default='open'),
        sa.Column('priority', sa.String(20), server_default='medium'),
        sa.Column('assignee_id', UUID(as_uuid=False), sa.ForeignKey('users.id')),
        sa.Column('investigation_ids', ARRAY(sa.String), server_default='{}'),
        sa.Column('evidence_ids', ARRAY(sa.String), server_default='{}'),
        sa.Column('tasks', JSONB, server_default='[]'),
        sa.Column('sla_due_at', sa.DateTime()),
        sa.Column('created_by', UUID(as_uuid=False), sa.ForeignKey('users.id')),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('closed_at', sa.DateTime()),
    )

    # Reports
    op.create_table('reports',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('case_id', UUID(as_uuid=False), sa.ForeignKey('cases.id')),
        sa.Column('investigation_id', UUID(as_uuid=False), sa.ForeignKey('investigations.id')),
        sa.Column('format', sa.String(50), nullable=False),
        sa.Column('file_path', sa.Text()),
        sa.Column('sections', JSONB, server_default='[]'),
        sa.Column('generated_by', UUID(as_uuid=False), sa.ForeignKey('users.id')),
        sa.Column('generated_at', sa.DateTime(), server_default=sa.func.now()),
    )

    # Leak Items
    op.create_table('leak_items',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('type', sa.String(50), nullable=False),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('description', sa.Text()),
        sa.Column('severity', sa.String(20), server_default='medium'),
        sa.Column('source_name', sa.String(255)),
        sa.Column('source_url', sa.Text()),
        sa.Column('discovered_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('matched_asset_ids', ARRAY(sa.String), server_default='{}'),
        sa.Column('evidence_excerpt', sa.Text()),
        sa.Column('provenance', sa.Text()),
        sa.Column('is_tor_source', sa.Boolean(), server_default='false'),
        sa.Column('search_vector', TSVECTOR),
    )

    # Playbooks
    op.create_table('playbooks',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text()),
        sa.Column('steps', JSONB, server_default='[]'),
        sa.Column('version', sa.Integer(), server_default='1'),
        sa.Column('enabled', sa.Boolean(), server_default='true'),
        sa.Column('created_by', UUID(as_uuid=False), sa.ForeignKey('users.id')),
        sa.Column('last_run_at', sa.DateTime()),
        sa.Column('run_count', sa.Integer(), server_default='0'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )

    op.create_table('playbook_runs',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('playbook_id', UUID(as_uuid=False), sa.ForeignKey('playbooks.id'), nullable=False),
        sa.Column('status', sa.String(20), server_default='running'),
        sa.Column('step_results', JSONB, server_default='[]'),
        sa.Column('started_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('completed_at', sa.DateTime()),
        sa.Column('triggered_by', UUID(as_uuid=False), sa.ForeignKey('users.id')),
    )

    # Audit Logs
    op.create_table('audit_logs',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('action', sa.String(100), nullable=False),
        sa.Column('entity_type', sa.String(50)),
        sa.Column('entity_id', sa.String(100)),
        sa.Column('user_id', UUID(as_uuid=False), sa.ForeignKey('users.id')),
        sa.Column('user_email', sa.String(255)),
        sa.Column('details', JSONB, server_default='{}'),
        sa.Column('ip_address', sa.String(45)),
        sa.Column('timestamp', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index('ix_audit_action', 'audit_logs', ['action'])
    op.create_index('ix_audit_timestamp', 'audit_logs', ['timestamp'])

    # Feature Flags
    op.create_table('feature_flags',
        sa.Column('key', sa.String(100), primary_key=True),
        sa.Column('enabled', sa.Boolean(), server_default='false'),
        sa.Column('updated_by', UUID(as_uuid=False), sa.ForeignKey('users.id')),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
    )

def downgrade():
    tables = ['feature_flags', 'audit_logs', 'playbook_runs', 'playbooks', 'leak_items',
              'reports', 'cases', 'investigations', 'alerts', 'alert_rules',
              'entity_relationships', 'entities', 'intel_items', 'sources', 'assets',
              'refresh_tokens', 'users']
    for t in tables:
        op.drop_table(t)
    op.execute("DROP FUNCTION IF EXISTS intel_search_vector_update() CASCADE;")
    op.execute("DROP FUNCTION IF EXISTS entity_search_vector_update() CASCADE;")
