"""Top-level router that registers every versioned API route group."""

from fastapi import APIRouter

from app.api.routes import admin, auth, files, folders, health, me

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(admin.router)
api_router.include_router(me.router)
api_router.include_router(folders.router)
api_router.include_router(files.router)
