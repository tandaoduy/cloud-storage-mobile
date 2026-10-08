"""Endpoints for listing folders."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.api.routes.folders.common import serialize_folder
from app.db.database import get_db
from app.models.folder import Folder
from app.models.user import User

router = APIRouter()


@router.get("")
async def list_folders(
    parent_id: uuid.UUID | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Return all folders, or only the direct children of ``parent_id``."""
    conditions = [Folder.user_id == user.id]
    if parent_id is not None:
        parent = await db.scalar(
            select(Folder.id).where(Folder.id == parent_id, Folder.user_id == user.id)
        )
        if not parent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy thư mục cha.",
            )
        conditions.append(Folder.parent_id == parent_id)

    statement = select(Folder).where(*conditions).order_by(Folder.updated_at.desc())
    result = await db.execute(statement)
    return {"data": [serialize_folder(folder) for folder in result.scalars()]}
