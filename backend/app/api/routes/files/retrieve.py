"""Endpoint for downloading an owned file."""

from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.services.storage.files import FileService

router = APIRouter()
service = FileService()


@router.get("/{file_id}/download")
async def download_file(
    file_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FileResponse:
    """Stream the requested file after ownership verification."""
    item = await service.get_file(db, file_id, user.id)
    path = Path(item.path)
    if not path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tệp vật lý không còn tồn tại.",
        )
    return FileResponse(path, media_type=item.mime_type, filename=item.name)
