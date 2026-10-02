"""Endpoint for permanently deleting an owned file."""

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.files import ApiResponse, DeleteFileResponse
from app.services.storage.files import FileService

router = APIRouter()
service = FileService()


@router.delete("/{file_id}", response_model=ApiResponse[DeleteFileResponse])
async def delete_file(
    file_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Delete a file and return the user's recalculated storage usage."""
    return {"data": await service.delete(db, user, file_id)}
