"""System and user-defined category endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_owned_category
from app.core.database import get_db
from app.models.category import Category
from app.models.user import User
from app.schemas.category import CategoryCreate, CategoryOut, CategoryUpdate

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryOut])
def list_categories(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Category]:
    """Return system categories and the current user's custom categories."""
    return (
        db.query(Category)
        .filter(or_(Category.user_id.is_(None), Category.user_id == current_user.id))
        .order_by(Category.name)
        .all()
    )


@router.post("", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(
    payload: CategoryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Category:
    """Create a custom category owned by the current user."""
    existing = _find_name_conflict(db, payload.name, current_user.id)
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already have or can access a category with this name.",
        )

    new_category = Category(name=payload.name, icon=payload.icon, user_id=current_user.id)
    db.add(new_category)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already have or can access a category with this name.",
        ) from None
    db.refresh(new_category)

    return new_category


@router.patch("/{category_id}", response_model=CategoryOut)
def update_category(
    payload: CategoryUpdate,
    category: Category = Depends(get_owned_category),
    db: Session = Depends(get_db),
) -> Category:
    """Update a custom category; system and other-user rows resolve as 404."""
    updates = payload.model_dump(exclude_unset=True)
    new_name = updates.get("name")
    if new_name is not None:
        existing = _find_name_conflict(
            db,
            new_name,
            category.user_id,
            exclude_category_id=category.id,
        )
        if existing is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You already have or can access a category with this name.",
            )

    for field, value in updates.items():
        setattr(category, field, value)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already have or can access a category with this name.",
        ) from None
    db.refresh(category)
    return category


def _find_name_conflict(
    db: Session,
    name: str,
    user_id: int,
    *,
    exclude_category_id: int | None = None,
) -> Category | None:
    query = db.query(Category).filter(
        func.lower(Category.name) == name.lower(),
        or_(
            Category.user_id.is_(None),
            Category.user_id == user_id,
        ),
    )
    if exclude_category_id is not None:
        query = query.filter(Category.id != exclude_category_id)
    return query.first()


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(
    category: Category = Depends(get_owned_category),
    db: Session = Depends(get_db),
) -> None:
    """Delete an owned custom category; linked expenses become uncategorized."""
    db.delete(category)
    db.commit()
