"""Reusable FastAPI dependencies for authentication and resource ownership."""

from fastapi import Depends, HTTPException, Path, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_token
from app.models.budget import Budget
from app.models.category import Category
from app.models.expense import Expense
from app.models.user import User

# Login accepts JSON rather than an OAuth2 form, so this API exposes a plain
# HTTP bearer scheme in OpenAPI instead of claiming to implement OAuth2's
# password flow. Swagger's Authorize dialog accepts the access token directly.
bearer_scheme = HTTPBearer(auto_error=False)

_CREDENTIALS_ERROR = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials.",
    headers={"WWW-Authenticate": "Bearer"},
)


class TokenValidationError(Exception):
    """Raised when a token cannot resolve to a user of the expected type."""


def resolve_user_from_token(token: str, expected_type: str, db: Session) -> User:
    """Validate a JWT type and resolve its subject to a user."""
    try:
        payload = decode_token(token)
    except JWTError as exc:
        raise TokenValidationError("token signature invalid or expired") from exc

    if payload.get("type") != expected_type:
        raise TokenValidationError(f"expected a '{expected_type}' token")

    try:
        user_id = int(payload["sub"])
    except (KeyError, TypeError, ValueError):
        raise TokenValidationError("token missing 'sub' claim") from None

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        # The account may have been deleted after the token was issued.
        raise TokenValidationError("token subject does not exist")

    return user


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Resolve an access-token bearer credential or return a generic 401."""
    if credentials is None:
        raise _CREDENTIALS_ERROR
    try:
        return resolve_user_from_token(
            credentials.credentials,
            expected_type="access",
            db=db,
        )
    except TokenValidationError:
        raise _CREDENTIALS_ERROR from None


def require_visible_category(
    category_id: int,
    current_user: User,
    db: Session,
) -> Category:
    """Resolve a system category or one owned by the current user."""
    category = (
        db.query(Category)
        .filter(
            Category.id == category_id,
            or_(
                Category.user_id.is_(None),
                Category.user_id == current_user.id,
            ),
        )
        .first()
    )
    if category is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid category_id.",
        )
    return category


# Ownership checks return 404 for missing and foreign records alike, preventing
# resource-id enumeration while guarding against IDOR access.

_NOT_FOUND_EXPENSE = HTTPException(status_code=404, detail="Expense not found.")
_NOT_FOUND_BUDGET = HTTPException(status_code=404, detail="Budget not found.")
_NOT_FOUND_CATEGORY = HTTPException(status_code=404, detail="Category not found.")


def get_owned_expense(
    expense_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Expense:
    """Resolve an expense owned by the current user."""
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if expense is None or expense.user_id != current_user.id:
        raise _NOT_FOUND_EXPENSE
    return expense


def get_owned_budget(
    budget_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Budget:
    """Resolve a budget owned by the current user."""
    budget = db.query(Budget).filter(Budget.id == budget_id).first()
    if budget is None or budget.user_id != current_user.id:
        raise _NOT_FOUND_BUDGET
    return budget


def get_owned_category(
    category_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Category:
    """Resolve an owned custom category; system categories are never owned."""
    category = db.query(Category).filter(Category.id == category_id).first()
    if category is None or category.user_id != current_user.id:
        raise _NOT_FOUND_CATEGORY
    return category
