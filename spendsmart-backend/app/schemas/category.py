"""Category request and response schemas."""

from pydantic import BaseModel, Field, field_validator, model_validator


class CategoryCreate(BaseModel):
    """Fields accepted when creating a custom category."""

    name: str = Field(min_length=1, max_length=100)
    icon: str | None = Field(default=None, max_length=50)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("name cannot be blank")
        return stripped


class CategoryUpdate(BaseModel):
    """Fields a user may change on one of their custom categories."""

    name: str | None = Field(default=None, min_length=1, max_length=100)
    icon: str | None = Field(default=None, max_length=50)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str | None) -> str | None:
        if value is None:
            raise ValueError("name cannot be null")
        stripped = value.strip()
        if not stripped:
            raise ValueError("name cannot be blank")
        return stripped

    @model_validator(mode="after")
    def require_at_least_one_change(self):
        if not self.model_fields_set:
            raise ValueError("provide at least one field to update")
        return self


class CategoryOut(BaseModel):
    """Category response, including ownership for distinguishing defaults."""

    id: int
    name: str
    icon: str | None = None
    user_id: int | None = None

    model_config = {"from_attributes": True}
