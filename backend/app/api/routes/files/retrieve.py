"""Endpoint for downloading an owned file."""

from pathlib import Path
from uuid import UUID

import jwt
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.core.config import get_settings
from app.core.security import create_file_view_token
from app.services.storage.files import FileService

router = APIRouter()
service = FileService()


@router.post("/{file_id}/view-token")
async def create_view_token(
    file_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    await service.get_file(db, file_id, user.id)
    return {"data": {"token": create_file_view_token(str(user.id), str(file_id))}}


@router.get("/{file_id}/view")
async def view_file(
    file_id: UUID,
    token: str = Query(...),
    db: AsyncSession = Depends(get_db),
) -> FileResponse:
    try:
        payload = jwt.decode(token, get_settings().secret_key, algorithms=["HS256"])
        if payload.get("scope") != "file:view" or payload.get("file_id") != str(file_id):
            raise ValueError
        user_id = UUID(payload["sub"])
    except (jwt.InvalidTokenError, KeyError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Liên kết xem tệp không hợp lệ.")

    item = await service.get_file(db, file_id, user_id)
    path = Path(item.path)
    if not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tệp vật lý không còn tồn tại.")
    return FileResponse(path, media_type=item.mime_type, filename=item.name, content_disposition_type="inline")


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
