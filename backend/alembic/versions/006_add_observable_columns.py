"""Add observable_type and observable_value columns to intel_items; fix user_roles constraint.

Revision ID: 006_observable_columns
Revises: 005_phase0_indexes
Create Date: 2026-03-08
"""
from alembic import op
import sqlalchemy as sa

revision = '006_observable_columns'
down_revision = '005_phase0_indexes'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Bug #1: Add missing observable columns to intel_items
    op.add_column('intel_items', sa.Column('observable_type', sa.String(50), nullable=True))
    op.add_column('intel_items', sa.Column('observable_value', sa.String(500), nullable=True))
    op.create_index('ix_intel_items_observable_type', 'intel_items', ['observable_type'])

    # Bug #12: Add proper unique constraint to user_roles
    op.create_unique_constraint('uq_user_role', 'user_roles', ['user_id', 'role'])


def downgrade() -> None:
    op.drop_constraint('uq_user_role', 'user_roles', type_='unique')
    op.drop_index('ix_intel_items_observable_type', table_name='intel_items')
    op.drop_column('intel_items', 'observable_value')
    op.drop_column('intel_items', 'observable_type')
