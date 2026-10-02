"""Endpoints for listing a user's files."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.files import ApiResponse, FileMetadata
from app.services.storage.files import FileService

router = APIRouter()
service = FileService()


@router.get("", response_model=ApiResponse[list[FileMetadata]])
async def list_files(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Return the current user's files, newest first."""
    return {"data": await service.list_files(db, user.id)}
