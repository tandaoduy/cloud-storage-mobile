"""add user avatar url

Revision ID: 004_user_avatar
Revises: 003_user_active
Create Date: 2026-10-01
"""
# Alembic discovers migration metadata and operations dynamically. Its required
# variable names and the numeric-prefixed filename intentionally differ from
# Pylint's normal naming and member-resolution conventions.
# pylint: disable=invalid-name,no-member,missing-function-docstring
import sqlalchemy as sa
from alembic import op

revision = "004_user_avatar"
down_revision = "003_user_active"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("avatar_url", sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "avatar_url")
