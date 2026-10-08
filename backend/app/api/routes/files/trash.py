"""Endpoint for listing the current user's Trash."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.files import ApiResponse, DeleteFileResponse, FileMetadata
from app.services.storage.files import FileService

router = APIRouter()
service = FileService()


@router.get("/trash", response_model=ApiResponse[list[FileMetadata]])
async def list_trashed_files(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> dict:
    return {"data": await service.list_trashed_files(db, user.id)}


@router.delete("/trash", response_model=ApiResponse[DeleteFileResponse])
async def empty_trash(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> dict:
    """Permanently remove all files from the current user's Trash."""
    return {"data": await service.empty_trash(db, user)}
