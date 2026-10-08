"""Endpoint for deleting folders."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.db.database import get_db
from app.models.folder import Folder
from app.models.user import User

router = APIRouter()


@router.delete("/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_folder(
    folder_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete one owned folder and its descendants."""
    folder = await db.scalar(
        select(Folder).where(Folder.id == folder_id, Folder.user_id == user.id)
    )
    if not folder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy thư mục.",
        )
    await db.delete(folder)
    await db.commit()
