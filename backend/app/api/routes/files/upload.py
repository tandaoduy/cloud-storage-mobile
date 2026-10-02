"""Endpoint for accepting uploads from authenticated devices."""

from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.files import ApiResponse, FileMutationResponse
from app.services.storage.files import FileService

router = APIRouter()
service = FileService()


@router.post(
    "/upload",
    status_code=status.HTTP_201_CREATED,
    response_model=ApiResponse[FileMutationResponse],
)
async def upload_file(
    file: UploadFile = File(...),
    original_name: str | None = Form(default=None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Store one uploaded file and return its metadata and new quota usage."""
    return {"data": await service.upload(db, user, file, original_name=original_name)}
