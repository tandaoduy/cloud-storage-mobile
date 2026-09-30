import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import require_admin
from app.db.database import get_db
from app.models.user import User
from app.schemas.admin import UpdateQuotaRequest

router = APIRouter(prefix="/admin", tags=["admin"])


def serialize_user(user: User) -> dict:
    return {"id": str(user.id), "email": user.email, "display_name": user.display_name, "role": user.role, "is_active": user.is_active, "quota_bytes": user.quota_bytes, "used_storage_bytes": user.used_storage_bytes, "created_at": user.created_at}


@router.get("/users")
async def list_users(_: User = Depends(require_admin), db: AsyncSession = Depends(get_db)) -> dict:
    users = (await db.scalars(select(User).order_by(User.created_at.desc()))).all()
    return {"data": [serialize_user(user) for user in users]}


@router.patch("/users/{user_id}/quota")
async def update_quota(user_id: uuid.UUID, payload: UpdateQuotaRequest, _: User = Depends(require_admin), db: AsyncSession = Depends(get_db)) -> dict:
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy người dùng.")
    if payload.quota_bytes < user.used_storage_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Quota mới không được thấp hơn dung lượng đang dùng.")
    user.quota_bytes = payload.quota_bytes
    await db.commit()
    await db.refresh(user)
    return {"data": serialize_user(user)}


@router.patch("/users/{user_id}/status")
async def update_user_status(user_id: uuid.UUID, is_active: bool, admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)) -> dict:
    if user_id == admin.id and not is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Admin không thể tự khoá tài khoản của mình.")
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy người dùng.")
    user.is_active = is_active
    await db.commit()
    await db.refresh(user)
    return {"data": serialize_user(user)}


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: uuid.UUID, admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)) -> None:
    if user_id == admin.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Admin không thể tự xoá tài khoản của mình.")
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy người dùng.")
    await db.delete(user)
    await db.commit()
