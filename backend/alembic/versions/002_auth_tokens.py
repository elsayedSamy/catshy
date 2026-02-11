"""002 — Add auth_tokens table for invite & password reset

Revision ID: 002_auth_tokens
Create Date: 2025-06-01
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '002_auth_tokens'
down_revision = '001_initial'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table('auth_tokens',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('token_hash', sa.String(255), nullable=False, unique=True),
        sa.Column('token_type', sa.String(20), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('user_id', UUID(as_uuid=False), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('role', sa.String(50), server_default='analyst'),
        sa.Column('name', sa.String(255), nullable=True),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('used_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index('ix_auth_tokens_hash', 'auth_tokens', ['token_hash'])

def downgrade():
    op.drop_table('auth_tokens')
