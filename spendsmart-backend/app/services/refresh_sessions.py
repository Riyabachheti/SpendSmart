import logging
from datetime import UTC, datetime
from hashlib import sha256
from uuid import uuid4

from jose import JWTError
from sqlalchemy.orm import Session

from app.core.security import create_refresh_token, decode_token
from app.models.refresh_session import RefreshSession
from app.models.user import User

logger = logging.getLogger(__name__)


class RefreshSessionError(Exception):
    """The refresh token cannot be used to create a new session."""


class RefreshTokenReuseDetected(RefreshSessionError):
    """A token that had already been rotated was presented again."""


def hash_refresh_token(token: str) -> str:
    """Store only a one-way fingerprint, never a usable bearer token."""
    return sha256(token.encode("utf-8")).hexdigest()


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def issue_refresh_session(
    db: Session,
    user: User,
    *,
    family_id: str | None = None,
) -> tuple[str, RefreshSession]:
    token = create_refresh_token({"sub": str(user.id)})
    payload = decode_token(token)
    expires_at = datetime.fromtimestamp(payload["exp"], tz=UTC)

    session = RefreshSession(
        user_id=user.id,
        token_hash=hash_refresh_token(token),
        family_id=family_id or str(uuid4()),
        expires_at=expires_at,
    )
    db.add(session)
    db.flush()
    return token, session


def rotate_refresh_session(db: Session, token: str) -> tuple[User, str]:
    try:
        payload = decode_token(token)
        user_id = int(payload["sub"])
    except (JWTError, KeyError, TypeError, ValueError) as exc:
        raise RefreshSessionError("invalid refresh token") from exc

    if payload.get("type") != "refresh":
        raise RefreshSessionError("wrong token type")

    token_hash = hash_refresh_token(token)
    current = (
        db.query(RefreshSession)
        .filter(RefreshSession.token_hash == token_hash)
        .with_for_update()
        .first()
    )
    if current is None or current.user_id != user_id:
        raise RefreshSessionError("refresh session not found")

    now = datetime.now(UTC)
    if current.revoked_at is not None:
        if current.replaced_by_id is not None:
            (
                db.query(RefreshSession)
                .filter(
                    RefreshSession.family_id == current.family_id,
                    RefreshSession.revoked_at.is_(None),
                )
                .update(
                    {RefreshSession.revoked_at: now},
                    synchronize_session=False,
                )
            )
            db.commit()
            logger.warning(
                "Rotated refresh token reused; active session family revoked",
                extra={
                    "user_id": current.user_id,
                    "session_family_id": current.family_id,
                },
            )
            raise RefreshTokenReuseDetected("rotated refresh token reused")
        raise RefreshSessionError("refresh session revoked")

    if _as_utc(current.expires_at) <= now:
        current.revoked_at = now
        db.commit()
        raise RefreshSessionError("refresh session expired")

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        current.revoked_at = now
        db.commit()
        raise RefreshSessionError("token subject no longer exists")

    new_token, replacement = issue_refresh_session(
        db,
        user,
        family_id=current.family_id,
    )
    current.last_used_at = now
    current.revoked_at = now
    current.replaced_by_id = replacement.id
    db.commit()
    return user, new_token


def revoke_refresh_session(db: Session, token: str) -> None:
    session = (
        db.query(RefreshSession)
        .filter(RefreshSession.token_hash == hash_refresh_token(token))
        .with_for_update()
        .first()
    )
    if session is not None and session.revoked_at is None:
        session.revoked_at = datetime.now(UTC)
    db.commit()


def revoke_all_refresh_sessions(db: Session, user_id: int) -> None:
    (
        db.query(RefreshSession)
        .filter(
            RefreshSession.user_id == user_id,
            RefreshSession.revoked_at.is_(None),
        )
        .update(
            {RefreshSession.revoked_at: datetime.now(UTC)},
            synchronize_session=False,
        )
    )
    db.commit()
