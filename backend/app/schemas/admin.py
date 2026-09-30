from pydantic import BaseModel, Field


class UpdateQuotaRequest(BaseModel):
    quota_bytes: int = Field(gt=0, le=10 * 1024 * 1024 * 1024 * 1024)
