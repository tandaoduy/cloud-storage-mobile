"""Compose the authenticated file-management routes."""

from fastapi import APIRouter

from app.api.routes.files import delete, list as list_routes, rename, retrieve, star, trash, upload

router = APIRouter(tags=["files"])
router.include_router(list_routes.router, prefix="/files")
router.include_router(upload.router, prefix="/files")
router.include_router(trash.router, prefix="/files")
router.include_router(retrieve.router, prefix="/files")
router.include_router(rename.router, prefix="/files")
router.include_router(star.router, prefix="/files")
router.include_router(delete.router, prefix="/files")
