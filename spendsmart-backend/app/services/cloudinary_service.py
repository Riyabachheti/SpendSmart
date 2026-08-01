"""Cloudinary integration for receipt images."""

import cloudinary
import cloudinary.uploader

from app.core.config import settings

cloudinary.config(
    cloud_name=settings.cloudinary_cloud_name,
    api_key=settings.cloudinary_api_key,
    api_secret=settings.cloudinary_api_secret,
    secure=True,
)


def upload_receipt_image(file_bytes: bytes, user_id: int) -> str:
    """Upload a receipt to a user-scoped folder and return its secure URL."""
    result = cloudinary.uploader.upload(
        file_bytes,
        folder=f"spendsmart/receipts/{user_id}",
        resource_type="image",
    )
    return result["secure_url"]
