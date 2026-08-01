"""Receipt-image validation and Tesseract integration."""

import io
import warnings

import pytesseract
from PIL import Image

from app.core.config import settings

pytesseract.pytesseract.tesseract_cmd = settings.tesseract_cmd


class InvalidReceiptImage(ValueError):
    """Uploaded bytes are not a supported, safely-sized receipt image."""


def validate_receipt_image(image_bytes: bytes) -> None:
    if not image_bytes:
        raise InvalidReceiptImage("empty image")

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(image_bytes)) as image:
                if image.format not in {"JPEG", "PNG", "WEBP"}:
                    raise InvalidReceiptImage("unsupported image format")
                width, height = image.size
                if width <= 0 or height <= 0:
                    raise InvalidReceiptImage("invalid image dimensions")
                if width * height > settings.receipt_max_pixels:
                    raise InvalidReceiptImage("image dimensions are too large")
                image.verify()
    except (
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
        InvalidReceiptImage,
        OSError,
        SyntaxError,
    ) as exc:
        if isinstance(exc, InvalidReceiptImage):
            raise
        raise InvalidReceiptImage("invalid image data") from exc


def extract_text_from_image(image_bytes: bytes) -> str:
    """Decode an image and return normalized text from Tesseract."""
    image = Image.open(io.BytesIO(image_bytes))
    raw_text = pytesseract.image_to_string(
        image,
        timeout=settings.ocr_timeout_seconds,
    )
    return raw_text.strip()
