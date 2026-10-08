"""Endpoint for creating folders."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.api.routes.folders.common import serialize_folder
from app.db.database import get_db
from app.models.folder import Folder
from app.models.user import User
from app.schemas.folders import CreateFolderRequest

router = APIRouter()


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_folder(
    payload: CreateFolderRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Create a root folder or a child folder for the current user."""
    name = payload.name.strip()
    if payload.parent_id is not None:
        parent = await db.scalar(
            select(Folder.id).where(
                Folder.id == payload.parent_id,
                Folder.user_id == user.id,
            )
        )
        if not parent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy thư mục cha.",
            )

    parent_condition = (
        Folder.parent_id.is_(None)
        if payload.parent_id is None
        else Folder.parent_id == payload.parent_id
    )
    existing = await db.scalar(
        select(Folder.id).where(
            Folder.user_id == user.id,
            parent_condition,
            Folder.name == name,
        )
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Thư mục cùng tên đã tồn tại.",
        )

    folder = Folder(user_id=user.id, parent_id=payload.parent_id, name=name)
    db.add(folder)
    await db.commit()
    await db.refresh(folder)
    return {"data": serialize_folder(folder)}
