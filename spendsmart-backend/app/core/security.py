"""Password hashing and JWT utilities."""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import bcrypt
from jose import jwt

from app.core.config import settings

# bcrypt has a hard 72-byte input limit — anything beyond that is silently
# ignored by the underlying algorithm. We enforce this explicitly rather than
# letting it fail (or worse, silently truncate) inside a third-party library.
_MAX_PASSWORD_BYTES = 72


def hash_password(plain_password: str) -> str:
    """Hash a password with bcrypt and a fresh salt."""
    password_bytes = plain_password.encode("utf-8")
    if len(password_bytes) > _MAX_PASSWORD_BYTES:
        raise ValueError(
            f"Password too long: bcrypt supports a maximum of {_MAX_PASSWORD_BYTES} bytes."
        )

    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a bcrypt hash, failing closed for malformed stored values."""
    password_bytes = plain_password.encode("utf-8")
    hashed_bytes = hashed_password.encode("utf-8")

    try:
        return bcrypt.checkpw(password_bytes, hashed_bytes)
    except (ValueError, TypeError):
        return False


ALGORITHM = "HS256"

# The following functions are responsible for creating and decoding JSON Web Tokens (JWTs) for authentication purposes.
# The `_create_token` function generates a JWT with a specified expiration time, token type, and unique identifier (jti) for session tracking.
#  The `create_access_token` and `create_refresh_token` functions create short-lived access tokens and long-lived refresh tokens, respectively.
# The `decode_token` function verifies the JWT and returns its payload, ensuring that the token is valid and has the expected audience and issuer.
def _create_token(data: dict, expires_delta: timedelta, token_type: str) -> str:
    """Create a typed JWT with a unique ID for session tracking."""
    to_encode = data.copy()
    now = datetime.now(UTC)
    expire = now + expires_delta

    to_encode.update(
        {
            "exp": expire,
            "iat": now,
            "iss": settings.jwt_issuer,
            "aud": settings.jwt_audience,
            "type": token_type,
            "jti": str(uuid4()),
        }
    )
    return jwt.encode(to_encode, settings.secret_key, algorithm=ALGORITHM)


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """Create a short-lived access token."""
    if expires_delta is None:
        expires_delta = timedelta(minutes=settings.access_token_expire_minutes)
    return _create_token(data, expires_delta, token_type="access")


def create_refresh_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """Create a long-lived refresh token, used only to obtain new access tokens."""
    if expires_delta is None:
        expires_delta = timedelta(days=settings.refresh_token_expire_days)
    return _create_token(data, expires_delta, token_type="refresh")


def decode_token(token: str) -> dict:
    """Verify a JWT; callers enforce the expected token type."""
    return jwt.decode(
        token,
        settings.secret_key,
        algorithms=[ALGORITHM],
        audience=settings.jwt_audience,
        issuer=settings.jwt_issuer,
    )
