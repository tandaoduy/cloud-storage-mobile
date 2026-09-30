"""add user role

Revision ID: 002_user_role
Revises: 001_users_auth
Create Date: 2026-09-30
"""
import sqlalchemy as sa
from alembic import op

revision = "002_user_role"
down_revision = "001_users_auth"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("role", sa.String(20), server_default="user", nullable=False))
    op.create_check_constraint("ck_users_role", "users", "role IN ('admin', 'user')")


def downgrade() -> None:
    op.drop_constraint("ck_users_role", "users", type_="check")
    op.drop_column("users", "role")
