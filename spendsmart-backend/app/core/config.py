from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str
    secret_key: str = Field(min_length=32)
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7
    jwt_issuer: str = "spendsmart-api"
    jwt_audience: str = "spendsmart-web"

    refresh_cookie_name: str = "spendsmart_refresh"
    refresh_cookie_secure: bool = False
    refresh_cookie_samesite: Literal["lax", "strict", "none"] = "lax"
    refresh_cookie_path: str = "/auth"
    refresh_cookie_domain: str | None = None
    allowed_origins: list[str] = [
        "http://localhost:5173",
        "http://localhost:8000",
    ]

    # Receipt OCR pipeline
    cloudinary_cloud_name: str
    cloudinary_api_key: str
    cloudinary_api_secret: str
    redis_url: str = "redis://localhost:6379/0"
    receipt_max_upload_bytes: int = Field(default=5 * 1024 * 1024, ge=1024)
    receipt_max_pixels: int = Field(default=20_000_000, ge=1_000_000)
    ocr_timeout_seconds: int = Field(default=30, ge=1, le=120)
    tesseract_cmd: str = "tesseract"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
