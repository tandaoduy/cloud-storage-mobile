"""Response schemas for the file-management API."""

from datetime import datetime
from uuid import UUID

from typing import Generic, TypeVar

from pydantic import BaseModel

ResponseData = TypeVar("ResponseData")


class ApiResponse(BaseModel, Generic[ResponseData]):
    """Wrap a successful API payload in the project's standard envelope."""

    data: ResponseData


class FileMetadata(BaseModel):
    """Public metadata for a stored file."""

    id: UUID
    name: str
    mime_type: str
    size_bytes: int
    created_at: datetime


class StorageUsage(BaseModel):
    """Current storage quota and consumption for one user."""

    quota_bytes: int
    used_storage_bytes: int
    available_bytes: int


class FileMutationResponse(BaseModel):
    """Upload result with metadata and refreshed storage usage."""

    file: FileMetadata
    storage: StorageUsage


class DeleteFileResponse(BaseModel):
    """Delete result with refreshed storage usage."""

    storage: StorageUsage
