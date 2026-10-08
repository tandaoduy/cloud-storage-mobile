"""Endpoints for moving a file to Trash and permanently deleting it."""

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.files import ApiResponse, DeleteFileResponse, FileMetadata
from app.services.storage.files import FileService

router = APIRouter()
service = FileService()


@router.delete("/{file_id}", response_model=ApiResponse[FileMetadata])
async def delete_file(
    file_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Move an owned file to Trash without deleting its contents."""
    return {"data": await service.move_to_trash(db, user, file_id)}


@router.delete("/{file_id}/permanent", response_model=ApiResponse[DeleteFileResponse])
async def permanently_delete_file(
    file_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Irreversibly delete a file that is already in Trash."""
    return {"data": await service.permanently_delete(db, user, file_id)}


@router.post("/{file_id}/restore", response_model=ApiResponse[FileMetadata])
async def restore_file(
    file_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Restore a trashed file to the active file list."""
    return {"data": await service.restore(db, user, file_id)}
