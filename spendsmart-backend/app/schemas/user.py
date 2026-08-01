"""Authentication request and response schemas."""

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, BeforeValidator, EmailStr, Field, field_validator


def _normalize_email(value: object) -> str:
    return str(value).strip().lower()


NormalizedEmail = Annotated[EmailStr, BeforeValidator(_normalize_email)]


class UserSignup(BaseModel):
    """Request body for POST /auth/signup."""

    email: NormalizedEmail
    # The Field bounds characters for predictable request size. The validator
    # below separately enforces bcrypt's 72-byte UTF-8 ceiling.
    password: str = Field(min_length=8, max_length=72)
    full_name: str | None = None

    @field_validator("password")
    @classmethod
    def enforce_bcrypt_byte_limit(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("password must not exceed 72 UTF-8 bytes")
        return value


class UserLogin(BaseModel):
    """Request body for POST /auth/login."""

    email: NormalizedEmail
    password: str


class Token(BaseModel):
    """Access-token response for login and refresh."""

    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    """Public user fields; password hashes are never serialized."""

    id: int
    email: NormalizedEmail
    full_name: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
