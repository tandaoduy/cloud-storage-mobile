from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class CreateFolderRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    parent_id: UUID | None = None

    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Tên thư mục không được để trống.")
        return value
