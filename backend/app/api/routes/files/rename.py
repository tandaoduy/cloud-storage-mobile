"""Endpoint for renaming an owned file."""

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.files import ApiResponse, FileMetadata, RenameFileRequest
from app.services.storage.files import FileService

router = APIRouter()
service = FileService()


@router.patch("/{file_id}", response_model=ApiResponse[FileMetadata])
async def rename_file(
    file_id: UUID,
    payload: RenameFileRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Change a file's display name while retaining its stored contents."""
    return {"data": await service.rename(db, user, file_id, payload.name)}
