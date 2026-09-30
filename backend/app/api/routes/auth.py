from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import create_access_token, create_refresh_token, hash_password, hash_refresh_token, verify_password
from app.db.database import get_db
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.schemas.auth import LoginRequest, LogoutRequest, RefreshRequest, RegisterRequest

router = APIRouter(prefix="/auth", tags=["auth"])


def serialize_user(user: User) -> dict[str, str]:
    return {"id": str(user.id), "email": user.email, "display_name": user.display_name, "role": user.role, "is_active": user.is_active}


async def issue_token_pair(user: User, db: AsyncSession) -> dict:
    settings = get_settings()
    refresh_token = create_refresh_token()
    db.add(RefreshToken(user_id=user.id, token_hash=hash_refresh_token(refresh_token), expires_at=datetime.now(UTC) + timedelta(days=settings.refresh_token_expire_days)))
    await db.commit()
    return {"data": {"access_token": create_access_token(str(user.id), user.role), "refresh_token": refresh_token, "token_type": "bearer", "expires_in": settings.access_token_expire_minutes * 60, "user": serialize_user(user)}}


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)) -> dict:
    email = str(payload.email).lower()
    if await db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email đã được sử dụng.")
    user = User(email=email, password_hash=hash_password(payload.password), display_name=payload.display_name.strip())
    db.add(user)
    await db.flush()
    return await issue_token_pair(user, db)


@router.post("/login")
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)) -> dict:
    user = await db.scalar(select(User).where(User.email == str(payload.email).lower()))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email hoặc mật khẩu không đúng.")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tài khoản đã bị khoá tạm thời.")
    return await issue_token_pair(user, db)


@router.post("/refresh")
async def refresh(payload: RefreshRequest, db: AsyncSession = Depends(get_db)) -> dict:
    token = await db.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(payload.refresh_token)))
    if not token or token.revoked_at or token.expires_at <= datetime.now(UTC):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token không hợp lệ.")
    if not token.user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tài khoản đã bị khoá tạm thời.")
    token.revoked_at = datetime.now(UTC)
    await db.flush()
    return await issue_token_pair(token.user, db)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(payload: LogoutRequest, db: AsyncSession = Depends(get_db)) -> None:
    token = await db.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(payload.refresh_token)))
    if token and not token.revoked_at:
        token.revoked_at = datetime.now(UTC)
        await db.commit()
