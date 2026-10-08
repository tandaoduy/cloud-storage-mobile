"""Shared helpers for folder API routes."""

from app.models.folder import Folder


def serialize_folder(folder: Folder) -> dict:
    """Convert a folder model into its API response representation."""
    return {
        "id": str(folder.id),
        "name": folder.name,
        "parent_id": str(folder.parent_id) if folder.parent_id else None,
        "created_at": folder.created_at.isoformat(),
        "updated_at": folder.updated_at.isoformat(),
    }
