"""Budget CRUD endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_owned_budget, require_visible_category
from app.core.database import get_db
from app.models.budget import Budget
from app.models.user import User
from app.schemas.budget import BudgetCreate, BudgetOut, BudgetUpdate

router = APIRouter(prefix="/budgets", tags=["budgets"])


@router.post("", response_model=BudgetOut, status_code=status.HTTP_201_CREATED)
def create_budget(
    payload: BudgetCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Budget:
    """Create a category or overall monthly budget."""
    if payload.category_id is not None:
        require_visible_category(payload.category_id, current_user, db)

    # Overall budgets use NULL category_id, so enforce one per period explicitly.
    if payload.category_id is None:
        existing_overall = (
            db.query(Budget)
            .filter(
                Budget.user_id == current_user.id,
                Budget.category_id.is_(None),
                Budget.month == payload.month,
                Budget.year == payload.year,
            )
            .first()
        )
        if existing_overall is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An overall budget already exists for this month.",
            )

    new_budget = Budget(
        user_id=current_user.id,
        category_id=payload.category_id,
        amount=payload.amount,
        month=payload.month,
        year=payload.year,
    )
    db.add(new_budget)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A budget for this category and month already exists.",
        ) from None
    db.refresh(new_budget)

    return new_budget


@router.get("", response_model=list[BudgetOut])
def list_budgets(
    month: int | None = None,
    year: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Budget]:
    """List the current user's budgets with optional period filters."""
    query = db.query(Budget).filter(Budget.user_id == current_user.id)

    if month is not None:
        query = query.filter(Budget.month == month)
    if year is not None:
        query = query.filter(Budget.year == year)

    return query.order_by(Budget.year.desc(), Budget.month.desc()).all()


@router.patch("/{budget_id}", response_model=BudgetOut)
def update_budget(
    payload: BudgetUpdate,
    budget: Budget = Depends(get_owned_budget),
    db: Session = Depends(get_db),
) -> Budget:
    """Update a budget's amount."""
    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(budget, field, value)

    db.commit()
    db.refresh(budget)

    return budget


@router.delete("/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_budget(
    budget: Budget = Depends(get_owned_budget),
    db: Session = Depends(get_db),
) -> None:
    """Delete an owned budget."""
    db.delete(budget)
    db.commit()
