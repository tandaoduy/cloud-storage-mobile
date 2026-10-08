"""add soft-delete support for stored files

Revision ID: 009_add_file_trash
Revises: 008_add_file_starred_status
"""

import sqlalchemy as sa
from alembic import op


revision = "009_add_file_trash"
down_revision = "008_add_file_starred_status"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("stored_files", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_stored_files_deleted_at", "stored_files", ["deleted_at"])


def downgrade() -> None:
    op.drop_index("ix_stored_files_deleted_at", table_name="stored_files")
    op.drop_column("stored_files", "deleted_at")
