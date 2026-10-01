from datetime import UTC, datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.api.routes.auth import issue_token_pair
from app.core.security import hash_password, verify_password
from app.db.database import get_db
from app.models.user import User
from app.models.refresh_token import RefreshToken
from app.schemas.me import ChangePasswordRequest, UpdateProfileRequest

router = APIRouter(tags=["me"])
AVATAR_DIR = Path("uploads/avatars")
MAX_AVATAR_BYTES = 5 * 1024 * 1024
ALLOWED_AVATAR_TYPES = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/pjpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/heic": ".heic",
    "image/heif": ".heif",
}


def serialize_user(user: User) -> dict:
    return {
        "id": str(user.id), "email": user.email, "display_name": user.display_name,
        "avatar_url": user.avatar_url, "role": user.role, "is_active": user.is_active,
        "quota_bytes": user.quota_bytes, "used_storage_bytes": user.used_storage_bytes,
    }


@router.get("/me")
async def get_me(user: User = Depends(get_current_user)) -> dict:
    return {
        "data": {
            **serialize_user(user),
        }
    }


@router.patch("/me")
async def update_me(payload: UpdateProfileRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> dict:
    if payload.display_name is not None:
        user.display_name = payload.display_name.strip()
    await db.commit()
    await db.refresh(user)
    return {"data": serialize_user(user)}


@router.post("/me/avatar")
@router.put("/me/avatar")
async def upload_avatar(
    request: Request,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    extension = ALLOWED_AVATAR_TYPES.get((file.content_type or "").lower())
    if not extension and file.filename:
        suffix = Path(file.filename).suffix.lower()
        if suffix in {".jpg", ".jpeg"}:
            extension = ".jpg"
        elif suffix in {".png", ".webp", ".heic", ".heif"}:
            extension = suffix
    if not extension:
        extension = ".jpg"

    content = await file.read(MAX_AVATAR_BYTES + 1)
    if len(content) > MAX_AVATAR_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Avatar không được vượt quá 5 MB.")
    AVATAR_DIR.mkdir(parents=True, exist_ok=True)
    for old_file in AVATAR_DIR.glob(f"{user.id}.*"):
        old_file.unlink()
    filename = f"{user.id}{extension}"
    (AVATAR_DIR / filename).write_bytes(content)
    timestamp = int(datetime.now(UTC).timestamp())
    user.avatar_url = f"{str(request.base_url).rstrip('/')}/uploads/avatars/{filename}?t={timestamp}"
    await db.commit()
    await db.refresh(user)
    return {"data": serialize_user(user)}


@router.delete("/me/avatar")
async def delete_avatar(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> dict:
    for old_file in AVATAR_DIR.glob(f"{user.id}.*"):
        old_file.unlink()
    user.avatar_url = None
    await db.commit()
    await db.refresh(user)
    return {"data": serialize_user(user)}


@router.patch("/me/password")
async def change_password(payload: ChangePasswordRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> dict:
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mật khẩu hiện tại không đúng.")
    user.password_hash = hash_password(payload.new_password)
    await db.execute(update(RefreshToken).where(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None)).values(revoked_at=datetime.now(UTC)))
    await db.flush()
    return await issue_token_pair(user, db)


@router.get("/me/storage")
async def get_storage(user: User = Depends(get_current_user)) -> dict:
    return {
        "data": {
            "quota_bytes": user.quota_bytes,
            "used_storage_bytes": user.used_storage_bytes,
            "available_bytes": max(0, user.quota_bytes - user.used_storage_bytes),
        }
    }
