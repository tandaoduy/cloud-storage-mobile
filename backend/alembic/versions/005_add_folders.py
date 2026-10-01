"""add folders

Revision ID: 005_folders
Revises: 004_user_avatar
Create Date: 2026-10-01
"""
import sqlalchemy as sa
from alembic import op

revision = "005_folders"
down_revision = "004_user_avatar"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "folders",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_folders_user_id", "folders", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_folders_user_id", table_name="folders")
    op.drop_table("folders")
