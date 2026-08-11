"""Authentication routes and refresh-session lifecycle."""

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.core.security import (
    create_access_token,
    hash_password,
    verify_password,
)
from app.models.user import User
from app.schemas.user import Token, UserLogin, UserOut, UserSignup
from app.services.refresh_sessions import (
    RefreshSessionError,
    issue_refresh_session,
    revoke_all_refresh_sessions,
    revoke_refresh_session,
    rotate_refresh_session,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def signup(payload: UserSignup, db: Session = Depends(get_db)) -> User:
    """Create an account; the database constraint handles concurrent duplicates."""
    existing_user = (
        db.query(User).filter(func.lower(User.email) == payload.email).first()
    )
    if existing_user is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists.",
        )

    new_user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
    )
    db.add(new_user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists.",
        ) from None
    db.refresh(new_user)  # populates new_user.id, created_at from the DB

    return new_user


# Keep login failures identical to prevent email enumeration.
_INVALID_CREDENTIALS_ERROR = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Incorrect email or password.",
)
_DUMMY_PASSWORD_HASH = hash_password("not-a-real-user-password")


@router.post("/login", response_model=Token)
def login(
    payload: UserLogin,
    response: Response,
    db: Session = Depends(get_db),
) -> Token:
    """Return an access token and set a rotating HttpOnly refresh cookie."""
    user = db.query(User).filter(func.lower(User.email) == payload.email).first()
    if user is None:
        # Perform a real bcrypt comparison even when the account is missing,
        # reducing the timing signal available for email enumeration.
        verify_password(payload.password, _DUMMY_PASSWORD_HASH)
        raise _INVALID_CREDENTIALS_ERROR

    if not verify_password(payload.password, user.hashed_password):
        raise _INVALID_CREDENTIALS_ERROR

    token_data = {"sub": str(user.id)}
    access_token = create_access_token(token_data)
    refresh_token, _ = issue_refresh_session(db, user)
    db.commit()
    _set_refresh_cookie(response, refresh_token)

    return Token(access_token=access_token)


@router.get("/me", response_model=UserOut)
def read_current_user(current_user: User = Depends(get_current_user)) -> User:
    """Return the authenticated user's profile."""
    return current_user


@router.post("/refresh", response_model=Token)
def refresh_access_token(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> Token | Response:
    """Rotate the refresh cookie and retain the revoked token for reuse detection."""
    _require_trusted_origin(request)
    refresh_token = request.cookies.get(settings.refresh_cookie_name)
    if refresh_token is None:
        return _invalid_refresh_response()

    try:
        user, new_refresh_token = rotate_refresh_session(db, refresh_token)
    except RefreshSessionError:
        return _invalid_refresh_response()

    new_access_token = create_access_token({"sub": str(user.id)})
    _set_refresh_cookie(response, new_refresh_token)
    return Token(access_token=new_access_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> None:
    _require_trusted_origin(request)
    refresh_token = request.cookies.get(settings.refresh_cookie_name)
    if refresh_token is not None:
        revoke_refresh_session(db, refresh_token)
    _clear_refresh_cookie(response)


@router.post("/logout-all", status_code=status.HTTP_204_NO_CONTENT)
def logout_all(
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    _require_trusted_origin(request)
    revoke_all_refresh_sessions(db, current_user.id)
    _clear_refresh_cookie(response)


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.refresh_cookie_name,
        value=token,
        max_age=settings.refresh_token_expire_days * 24 * 60 * 60,
        path=settings.refresh_cookie_path,
        domain=settings.refresh_cookie_domain or None,
        secure=settings.refresh_cookie_secure,
        httponly=True,
        samesite=settings.refresh_cookie_samesite,
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.refresh_cookie_name,
        path=settings.refresh_cookie_path,
        domain=settings.refresh_cookie_domain or None,
        secure=settings.refresh_cookie_secure,
        httponly=True,
        samesite=settings.refresh_cookie_samesite,
    )


def _invalid_refresh_response() -> JSONResponse:
    response = JSONResponse(
        status_code=status.HTTP_401_UNAUTHORIZED,
        content={"detail": "Invalid or expired refresh token."},
    )
    _clear_refresh_cookie(response)
    return response


def _require_trusted_origin(request: Request) -> None:
    origin = request.headers.get("origin")
    trusted_origins = {item.rstrip("/") for item in settings.allowed_origins}
    # The deployment hostname is assigned by the hosting platform. Trust the
    # current request's own origin so same-origin refresh/logout requests work
    # without a provider-specific environment variable.
    trusted_origins.add(str(request.base_url).rstrip("/"))
    if origin is None or origin.rstrip("/") not in trusted_origins:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Untrusted request origin.",
        )
