"""Password hashing and JWT helpers used by authentication endpoints."""

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

import jwt
from pwdlib import PasswordHash

from app.core.config import get_settings

password_hash = PasswordHash.recommended()


def hash_password(password: str) -> str:
    """Return an Argon2 hash for a plaintext password."""
    return password_hash.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against its stored Argon2 hash."""
    return password_hash.verify(password, hashed_password)


def create_access_token(user_id: str, role: str) -> str:
    """Create a short-lived signed JWT containing the user identity and role."""
    settings = get_settings()
    expires_at = datetime.now(UTC) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {"sub": user_id, "role": role, "exp": expires_at}
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


def create_refresh_token() -> str:
    """Create a cryptographically secure opaque refresh token."""
    return secrets.token_urlsafe(48)


def hash_refresh_token(token: str) -> str:
    """Hash a refresh token before it is stored in the database."""
    return hashlib.sha256(token.encode()).hexdigest()
