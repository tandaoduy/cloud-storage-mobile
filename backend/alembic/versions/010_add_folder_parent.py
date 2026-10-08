"""add nested folders

Revision ID: 010_add_folder_parent
Revises: 009_add_file_trash
Create Date: 2026-10-07
"""

import sqlalchemy as sa
from alembic import op


revision = "010_add_folder_parent"
down_revision = "009_add_file_trash"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("folders", sa.Column("parent_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "fk_folders_parent_id_folders",
        "folders",
        "folders",
        ["parent_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index("ix_folders_parent_id", "folders", ["parent_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_folders_parent_id", table_name="folders")
    op.drop_constraint("fk_folders_parent_id_folders", "folders", type_="foreignkey")
    op.drop_column("folders", "parent_id")
