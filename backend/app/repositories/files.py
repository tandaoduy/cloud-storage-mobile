"""Queries for persisted file metadata."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.stored_file import StoredFile


class FileRepository:
    """Database queries for files; business rules live in FileService."""

    async def list_for_user(self, db: AsyncSession, user_id: UUID) -> list[StoredFile]:
        """List a user's files in reverse creation order."""
        result = await db.execute(
            select(StoredFile)
            .where(StoredFile.user_id == user_id, StoredFile.deleted_at.is_(None))
            .order_by(StoredFile.created_at.desc())
        )
        return list(result.scalars())

    async def get_for_user(
        self, db: AsyncSession, file_id: UUID, user_id: UUID
    ) -> StoredFile | None:
        """Find one file only when it is owned by the given user."""
        return await db.scalar(
            select(StoredFile).where(
                StoredFile.id == file_id,
                StoredFile.user_id == user_id,
                StoredFile.deleted_at.is_(None),
            )
        )

    async def list_trashed_for_user(self, db: AsyncSession, user_id: UUID) -> list[StoredFile]:
        result = await db.execute(
            select(StoredFile)
            .where(StoredFile.user_id == user_id, StoredFile.deleted_at.is_not(None))
            .order_by(StoredFile.deleted_at.desc())
        )
        return list(result.scalars())

    async def get_trashed_for_user(
        self, db: AsyncSession, file_id: UUID, user_id: UUID
    ) -> StoredFile | None:
        return await db.scalar(
            select(StoredFile).where(
                StoredFile.id == file_id,
                StoredFile.user_id == user_id,
                StoredFile.deleted_at.is_not(None),
            )
        )
