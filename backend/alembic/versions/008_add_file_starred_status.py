"""persist starred status for stored files

Revision ID: 008_add_file_starred_status
Revises: 007_reconcile_file_storage_usage
"""

import sqlalchemy as sa
from alembic import op


revision = "008_add_file_starred_status"
down_revision = "007_reconcile_file_storage_usage"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "stored_files",
        sa.Column("is_starred", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.alter_column("stored_files", "is_starred", server_default=None)


def downgrade() -> None:
    op.drop_column("stored_files", "is_starred")
