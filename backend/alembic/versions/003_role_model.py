"""003 — Role model, workspaces, tenant isolation, system owner infrastructure.

Revision ID: 003_role_model
Create Date: 2026-02-13
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = '003_role_model'
down_revision = '002_auth_tokens'
branch_labels = None
depends_on = None


def upgrade():
    # ── User Roles (separate table — prevents privilege escalation) ──
    op.create_table('user_roles',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=False), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('role', sa.String(50), nullable=False),
    )
    op.create_index('ix_user_roles_user_id', 'user_roles', ['user_id'])
    op.create_unique_constraint('uq_user_role', 'user_roles', ['user_id', 'role'])

    # ── Workspaces (tenant boundary) ──
    op.create_table('workspaces',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('slug', sa.String(100), unique=True, nullable=False),
        sa.Column('description', sa.Text(), server_default=''),
        sa.Column('owner_id', UUID(as_uuid=False), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('settings', sa.Text(), server_default='{}'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index('ix_workspaces_slug', 'workspaces', ['slug'])

    # ── Workspace Members ──
    op.create_table('workspace_members',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('workspace_id', UUID(as_uuid=False), sa.ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', UUID(as_uuid=False), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('role', sa.String(50), nullable=False, server_default='team_member'),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('joined_at', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index('ix_wm_workspace', 'workspace_members', ['workspace_id'])
    op.create_index('ix_wm_user', 'workspace_members', ['user_id'])
    op.create_unique_constraint('uq_workspace_user', 'workspace_members', ['workspace_id', 'user_id'])

    # ── System Audit Logs (immutable, system_owner actions only) ──
    op.create_table('system_audit_logs',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('action', sa.String(100), nullable=False),
        sa.Column('actor_user_id', UUID(as_uuid=False), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('actor_email', sa.String(255), nullable=False),
        sa.Column('target_user_id', UUID(as_uuid=False), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('details', JSONB, server_default='{}'),
        sa.Column('ip_address', sa.String(45)),
        sa.Column('user_agent', sa.Text()),
        sa.Column('outcome', sa.String(20), server_default='success'),
        sa.Column('timestamp', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index('ix_sysaudit_action', 'system_audit_logs', ['action'])
    op.create_index('ix_sysaudit_timestamp', 'system_audit_logs', ['timestamp'])

    # ── Pending Owner Requests ──
    op.create_table('pending_owner_requests',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('requester_user_id', UUID(as_uuid=False), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('requester_email', sa.String(255), nullable=False),
        sa.Column('reason', sa.Text()),
        sa.Column('status', sa.String(20), server_default='pending'),
        sa.Column('reviewed_by', UUID(as_uuid=False), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('reviewed_at', sa.DateTime()),
        sa.Column('review_notes', sa.Text()),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )

    # ── Add MFA columns to users ──
    op.add_column('users', sa.Column('mfa_secret', sa.String(255), nullable=True))
    op.add_column('users', sa.Column('mfa_enabled', sa.Boolean(), server_default='false'))

    # ── Add workspace_id FK to existing tables for tenant scoping ──
    for table in ['assets', 'sources', 'intel_items', 'entities', 'alert_rules',
                  'alerts', 'investigations', 'cases', 'reports', 'leak_items',
                  'playbooks', 'playbook_runs']:
        op.add_column(table, sa.Column('workspace_id', UUID(as_uuid=False), nullable=True))
        op.create_index(f'ix_{table}_workspace', table, ['workspace_id'])
        op.create_foreign_key(f'fk_{table}_workspace', table, 'workspaces', ['workspace_id'], ['id'])

    # ── Enhance audit_logs with extra fields ──
    op.add_column('audit_logs', sa.Column('workspace_id', UUID(as_uuid=False), nullable=True))
    op.add_column('audit_logs', sa.Column('user_agent', sa.Text(), nullable=True))
    op.add_column('audit_logs', sa.Column('outcome', sa.String(20), server_default='success'))
    op.add_column('audit_logs', sa.Column('failure_reason', sa.Text(), nullable=True))
    op.add_column('audit_logs', sa.Column('correlation_id', sa.String(100), nullable=True))

    # ── Add revoked + metadata to refresh_tokens ──
    op.add_column('refresh_tokens', sa.Column('revoked', sa.Boolean(), server_default='false'))
    op.add_column('refresh_tokens', sa.Column('ip_address', sa.String(45), nullable=True))
    op.add_column('refresh_tokens', sa.Column('user_agent', sa.Text(), nullable=True))

    # ── Seed initial system_owner role for existing admin users ──
    op.execute("""
        INSERT INTO user_roles (id, user_id, role)
        SELECT gen_random_uuid()::text, id, 'system_owner'
        FROM users WHERE role = 'admin'
        ON CONFLICT DO NOTHING;
    """)
    # Also give them the 'user' base role
    op.execute("""
        INSERT INTO user_roles (id, user_id, role)
        SELECT gen_random_uuid()::text, id, 'user'
        FROM users WHERE role = 'admin'
        ON CONFLICT DO NOTHING;
    """)


def downgrade():
    # Remove workspace_id from existing tables
    for table in ['playbook_runs', 'playbooks', 'leak_items', 'reports', 'cases',
                  'investigations', 'alerts', 'alert_rules', 'entities',
                  'intel_items', 'sources', 'assets', 'audit_logs']:
        op.drop_constraint(f'fk_{table}_workspace', table, type_='foreignkey')
        op.drop_index(f'ix_{table}_workspace', table_name=table)
        op.drop_column(table, 'workspace_id')

    # Remove enhanced audit_logs columns
    for col in ['user_agent', 'outcome', 'failure_reason', 'correlation_id']:
        op.drop_column('audit_logs', col)

    # Remove refresh_token enhancements
    for col in ['revoked', 'ip_address', 'user_agent']:
        op.drop_column('refresh_tokens', col)

    # Remove MFA columns
    op.drop_column('users', 'mfa_secret')
    op.drop_column('users', 'mfa_enabled')

    op.drop_table('pending_owner_requests')
    op.drop_table('system_audit_logs')
    op.drop_table('workspace_members')
    op.drop_table('workspaces')
    op.drop_table('user_roles')
