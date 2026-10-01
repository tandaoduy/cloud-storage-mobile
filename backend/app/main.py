# pyrefly: ignore [missing-import]
from pathlib import Path

from fastapi import FastAPI
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.router import api_router
from app.core.config import get_settings
from app import models  # noqa: F401 - registers SQLAlchemy models for Alembic

settings = get_settings()
app = FastAPI(title="Cloud Storage API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=[origin.strip() for origin in settings.allowed_origins.split(",")], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
Path("uploads/avatars").mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
app.include_router(api_router, prefix="/api/v1")
