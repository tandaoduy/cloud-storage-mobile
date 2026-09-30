"""add user active status

Revision ID: 003_user_active
Revises: 002_user_role
Create Date: 2026-09-30
"""
import sqlalchemy as sa
from alembic import op

revision = "003_user_active"
down_revision = "002_user_role"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False))


def downgrade() -> None:
    op.drop_column("users", "is_active")
