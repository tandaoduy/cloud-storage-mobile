import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.db.database import get_db
from app.models.folder import Folder
from app.models.user import User
from app.schemas.folders import CreateFolderRequest

router = APIRouter(prefix="/folders", tags=["folders"])


def serialize_folder(folder: Folder) -> dict:
    return {"id": str(folder.id), "name": folder.name, "created_at": folder.created_at.isoformat(), "updated_at": folder.updated_at.isoformat()}


@router.get("")
async def list_folders(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> dict:
    result = await db.execute(select(Folder).where(Folder.user_id == user.id).order_by(Folder.updated_at.desc()))
    return {"data": [serialize_folder(folder) for folder in result.scalars()]}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_folder(payload: CreateFolderRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> dict:
    name = payload.name.strip()
    existing = await db.scalar(select(Folder.id).where(Folder.user_id == user.id, Folder.name == name))
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Thư mục cùng tên đã tồn tại.")
    folder = Folder(user_id=user.id, name=name)
    db.add(folder)
    await db.commit()
    await db.refresh(folder)
    return {"data": serialize_folder(folder)}


@router.delete("/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_folder(folder_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> None:
    folder = await db.scalar(select(Folder).where(Folder.id == folder_id, Folder.user_id == user.id))
    if not folder:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy thư mục.")
    await db.delete(folder)
    await db.commit()
