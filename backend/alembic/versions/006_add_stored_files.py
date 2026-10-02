"""add stored files"""
import sqlalchemy as sa
from alembic import op

revision = "006_stored_files"
down_revision = "005_folders"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table("stored_files", sa.Column("id", sa.Uuid(), primary_key=True), sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("name", sa.String(255), nullable=False), sa.Column("mime_type", sa.String(255), nullable=False), sa.Column("size_bytes", sa.BigInteger(), nullable=False), sa.Column("path", sa.String(500), nullable=False, unique=True), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")))
    op.create_index("ix_stored_files_user_id", "stored_files", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_stored_files_user_id", table_name="stored_files")
    op.drop_table("stored_files")
