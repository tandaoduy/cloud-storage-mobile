"""Reconcile quota usage from files uploaded by the legacy API.

Revision ID: 007_reconcile_file_storage_usage
Revises: 006_stored_files
"""

from alembic import op


revision = "007_reconcile_file_storage_usage"
down_revision = "006_stored_files"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE users AS user_account
        SET used_storage_bytes = COALESCE(
            (
                SELECT SUM(stored_file.size_bytes)
                FROM stored_files AS stored_file
                WHERE stored_file.user_id = user_account.id
            ),
            0
        )
        """
    )


def downgrade() -> None:
    # The previous value cannot be recovered safely; keep the reconciled total.
    pass
