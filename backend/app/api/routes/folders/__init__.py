"""Compose the authenticated folder-management routes."""

from fastapi import APIRouter

from app.api.routes.folders import create, delete, list as list_routes

router = APIRouter(tags=["folders"])
router.include_router(list_routes.router, prefix="/folders")
router.include_router(create.router, prefix="/folders")
router.include_router(delete.router, prefix="/folders")
