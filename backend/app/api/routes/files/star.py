"""Endpoint for updating a file's Starred state."""

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.files import ApiResponse, FileMetadata, StarFileRequest
from app.services.storage.files import FileService

router = APIRouter()
service = FileService()


@router.patch("/{file_id}/star", response_model=ApiResponse[FileMetadata])
async def set_file_starred(
    file_id: UUID,
    payload: StarFileRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return {"data": await service.set_starred(db, user, file_id, payload.is_starred)}
