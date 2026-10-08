"""Local disk storage service with transactional quota accounting."""

from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.stored_file import StoredFile
from app.models.user import User
from app.repositories.files import FileRepository


class FileService:
    """Stores arbitrary user files and keeps their quota in sync with metadata."""

    def __init__(self, repository: FileRepository | None = None) -> None:
        """Create the service with an optional metadata repository."""
        self.repository = repository or FileRepository()

    @staticmethod
    def serialize(item: StoredFile) -> dict:
        """Convert a database model to public file metadata."""
        return {
            "id": item.id,
            "name": item.name,
            "mime_type": item.mime_type,
            "size_bytes": item.size_bytes,
            "is_starred": item.is_starred,
            "deleted_at": item.deleted_at,
            "created_at": item.created_at,
        }

    @staticmethod
    def storage_usage(user: User) -> dict:
        """Return quota values suitable for an API response."""
        return {
            "quota_bytes": user.quota_bytes,
            "used_storage_bytes": user.used_storage_bytes,
            "available_bytes": max(0, user.quota_bytes - user.used_storage_bytes),
        }

    async def list_files(self, db: AsyncSession, user_id: UUID) -> list[dict]:
        """Retrieve serialized metadata for a user's files."""
        return [self.serialize(item) for item in await self.repository.list_for_user(db, user_id)]

    async def list_trashed_files(self, db: AsyncSession, user_id: UUID) -> list[dict]:
        """Return files that were moved to the current user's Trash."""
        return [self.serialize(item) for item in await self.repository.list_trashed_for_user(db, user_id)]

    async def get_file(self, db: AsyncSession, file_id: UUID, user_id: UUID) -> StoredFile:
        """Retrieve an owned file or raise a not-found error."""
        item = await self.repository.get_for_user(db, file_id, user_id)
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy tệp.")
        return item

    async def get_trashed_file(self, db: AsyncSession, file_id: UUID, user_id: UUID) -> StoredFile:
        item = await self.repository.get_trashed_for_user(db, file_id, user_id)
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy tệp trong Thùng rác.")
        return item

    async def upload(
        self,
        db: AsyncSession,
        user: User,
        upload: UploadFile,
        *,
        original_name: str | None = None,
    ) -> dict:
        """Persist an upload and atomically add its actual size to quota usage."""
        settings = get_settings()
        root = settings.upload_directory
        temporary_dir = root / ".tmp"
        root.mkdir(parents=True, exist_ok=True)
        temporary_dir.mkdir(parents=True, exist_ok=True)

        name = Path(original_name or upload.filename or "untitled").name
        if not name or name in {".", ".."}:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Tên tệp không hợp lệ.",
            )

        temporary_path = temporary_dir / uuid4().hex
        stored_path: Path | None = None
        size_bytes = 0
        try:
            with temporary_path.open("wb") as destination:
                while chunk := await upload.read(1024 * 1024):
                    size_bytes += len(chunk)
                    if size_bytes > settings.max_upload_bytes:
                        raise HTTPException(
                            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                            detail=f"Tệp không được vượt quá {settings.max_upload_bytes} bytes.",
                        )
                    destination.write(chunk)

            # Lock the user's row so concurrent uploads cannot exceed quota.
            locked_user = await db.scalar(
                select(User).where(User.id == user.id).with_for_update()
            )
            if not locked_user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Người dùng không tồn tại.",
                )
            if size_bytes > locked_user.quota_bytes - locked_user.used_storage_bytes:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail="Không đủ dung lượng lưu trữ.",
                )

            stored_path = root / f"{uuid4().hex}_{name}"
            temporary_path.replace(stored_path)
            item = StoredFile(
                user_id=locked_user.id,
                name=name,
                mime_type=upload.content_type or "application/octet-stream",
                size_bytes=size_bytes,
                path=str(stored_path),
            )
            db.add(item)
            locked_user.used_storage_bytes += size_bytes
            await db.commit()
            await db.refresh(item)
            await db.refresh(locked_user)
            return {
                "file": self.serialize(item),
                "storage": self.storage_usage(locked_user),
            }
        except Exception:
            await db.rollback()
            if stored_path and stored_path.exists():
                stored_path.unlink()
            raise
        finally:
            await upload.close()
            if temporary_path.exists():
                temporary_path.unlink()

    async def move_to_trash(self, db: AsyncSession, user: User, file_id: UUID) -> dict:
        """Soft-delete a file while preserving its bytes and quota usage."""
        item = await self.get_file(db, file_id, user.id)
        item.deleted_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(item)
        return self.serialize(item)

    async def restore(self, db: AsyncSession, user: User, file_id: UUID) -> dict:
        """Restore a file from Trash without changing its storage usage."""
        item = await self.get_trashed_file(db, file_id, user.id)
        item.deleted_at = None
        await db.commit()
        await db.refresh(item)
        return self.serialize(item)

    async def permanently_delete(self, db: AsyncSession, user: User, file_id: UUID) -> dict:
        """Permanently delete a trashed file and then release its quota."""
        item = await self.get_trashed_file(db, file_id, user.id)
        locked_user = await db.scalar(
            select(User).where(User.id == user.id).with_for_update()
        )
        if not locked_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Người dùng không tồn tại.",
            )
        path = Path(item.path)
        await db.delete(item)
        locked_user.used_storage_bytes = max(0, locked_user.used_storage_bytes - item.size_bytes)
        await db.commit()
        await db.refresh(locked_user)
        # A failed unlink only leaves a safe orphan; the database stays authoritative.
        path.unlink(missing_ok=True)
        return {"storage": self.storage_usage(locked_user)}

    async def empty_trash(self, db: AsyncSession, user: User) -> dict:
        """Permanently delete every trashed file owned by the current user."""
        items = await self.repository.list_trashed_for_user(db, user.id)
        locked_user = await db.scalar(
            select(User).where(User.id == user.id).with_for_update()
        )
        if not locked_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Người dùng không tồn tại.",
            )

        paths = [Path(item.path) for item in items]
        released_bytes = sum(item.size_bytes for item in items)
        for item in items:
            await db.delete(item)
        locked_user.used_storage_bytes = max(0, locked_user.used_storage_bytes - released_bytes)
        await db.commit()
        await db.refresh(locked_user)
        for path in paths:
            path.unlink(missing_ok=True)
        return {"storage": self.storage_usage(locked_user)}

    async def rename(self, db: AsyncSession, user: User, file_id: UUID, name: str) -> dict:
        """Update display metadata without moving the underlying stored object."""
        sanitized_name = Path(name.strip()).name
        if not sanitized_name or sanitized_name in {".", ".."}:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Tên tệp không hợp lệ.",
            )

        item = await self.get_file(db, file_id, user.id)
        original_extension = Path(item.name).suffix
        requested_extension = Path(sanitized_name).suffix
        if original_extension:
            if requested_extension.lower() != original_extension.lower():
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Không được thay đổi đuôi tệp.",
                )

            requested_stem = sanitized_name[: -len(original_extension)]
            if not requested_stem or Path(requested_stem).suffix:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Chỉ được đổi phần tên, không được nhập đuôi tệp.",
                )

        item.name = sanitized_name
        await db.commit()
        await db.refresh(item)
        return self.serialize(item)

    async def set_starred(
        self, db: AsyncSession, user: User, file_id: UUID, is_starred: bool
    ) -> dict:
        """Persist a file's Starred state for the current user."""
        item = await self.get_file(db, file_id, user.id)
        item.is_starred = is_starred
        await db.commit()
        await db.refresh(item)
        return self.serialize(item)
