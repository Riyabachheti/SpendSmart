from datetime import UTC, date, datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.budget import Budget
from app.models.category import Category
from app.models.expense import Expense
from app.models.user import User
from app.schemas.analytics import (
    BudgetStatusItem,
    BudgetStatusResponse,
    CategorySpend,
    SpendingSummary,
    SpendingTrend,
    TrendPoint,
)

router = APIRouter(prefix="/analytics", tags=["analytics"])
ZERO = Decimal("0.00")


def _period_bounds(month: int | None, year: int | None) -> tuple[int, int, date, date]:
    today = datetime.now(UTC).date()
    resolved_month = month or today.month
    resolved_year = year or today.year
    start = date(resolved_year, resolved_month, 1)
    if resolved_month == 12:
        end = date(resolved_year + 1, 1, 1)
    else:
        end = date(resolved_year, resolved_month + 1, 1)
    return resolved_month, resolved_year, start, end


def _shift_month(year: int, month: int, offset: int) -> tuple[int, int]:
    absolute_month = year * 12 + (month - 1) + offset
    shifted_year, zero_based_month = divmod(absolute_month, 12)
    return shifted_year, zero_based_month + 1


def _verified_expense_filters(
    user_id: int,
    currency: str,
    start: date,
    end: date,
) -> tuple:
    return (
        Expense.user_id == user_id,
        Expense.is_verified.is_(True),
        Expense.currency == currency,
        Expense.expense_date >= start,
        Expense.expense_date < end,
    )


@router.get("/summary", response_model=SpendingSummary)
def spending_summary(
    month: int | None = Query(default=None, ge=1, le=12),
    year: int | None = Query(default=None, ge=2000, le=2100),
    currency: str = Query(default="INR", min_length=3, max_length=3, pattern=r"^[A-Z]{3}$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SpendingSummary:
    resolved_month, resolved_year, start, end = _period_bounds(month, year)
    amount_sum = func.coalesce(func.sum(Expense.amount), 0).label("amount")
    expense_count = func.count(Expense.id).label("expense_count")

    rows = (
        db.query(
            Category.id.label("category_id"),
            Category.name.label("category_name"),
            Category.icon.label("category_icon"),
            amount_sum,
            expense_count,
        )
        .select_from(Expense)
        .outerjoin(
            Category,
            and_(
                Category.id == Expense.category_id,
                or_(
                    Category.user_id.is_(None),
                    Category.user_id == current_user.id,
                ),
            ),
        )
        .filter(
            *_verified_expense_filters(
                current_user.id,
                currency,
                start,
                end,
            )
        )
        .group_by(Category.id, Category.name, Category.icon)
        .order_by(amount_sum.desc(), Category.name.asc())
        .all()
    )

    categories = [
        CategorySpend(
            category_id=row.category_id,
            category_name=row.category_name or "Uncategorized",
            category_icon=row.category_icon,
            amount=row.amount,
            expense_count=row.expense_count,
        )
        for row in rows
    ]
    return SpendingSummary(
        month=resolved_month,
        year=resolved_year,
        currency=currency,
        total_spent=sum((item.amount for item in categories), start=ZERO),
        expense_count=sum(item.expense_count for item in categories),
        by_category=categories,
    )


@router.get("/trend", response_model=SpendingTrend)
def spending_trend(
    months: int = Query(default=6, ge=1, le=24),
    end_month: int | None = Query(default=None, ge=1, le=12),
    end_year: int | None = Query(default=None, ge=2000, le=2100),
    currency: str = Query(default="INR", min_length=3, max_length=3, pattern=r"^[A-Z]{3}$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SpendingTrend:
    resolved_month, resolved_year, _, period_end = _period_bounds(end_month, end_year)
    start_year, start_month = _shift_month(
        resolved_year,
        resolved_month,
        -(months - 1),
    )
    period_start = date(start_year, start_month, 1)
    year_part = func.extract("year", Expense.expense_date).label("year")
    month_part = func.extract("month", Expense.expense_date).label("month")

    rows = (
        db.query(
            year_part,
            month_part,
            func.coalesce(func.sum(Expense.amount), 0).label("amount"),
            func.count(Expense.id).label("expense_count"),
        )
        .filter(
            *_verified_expense_filters(
                current_user.id,
                currency,
                period_start,
                period_end,
            )
        )
        .group_by(year_part, month_part)
        .all()
    )
    totals = {
        (int(row.year), int(row.month)): (row.amount, row.expense_count)
        for row in rows
    }

    points: list[TrendPoint] = []
    for offset in range(months):
        point_year, point_month = _shift_month(start_year, start_month, offset)
        amount, count = totals.get((point_year, point_month), (ZERO, 0))
        points.append(
            TrendPoint(
                year=point_year,
                month=point_month,
                total_spent=amount,
                expense_count=count,
            )
        )
    return SpendingTrend(currency=currency, months=points)


def _build_budget_status(
    budget: Budget,
    category_name: str | None,
    category_icon: str | None,
    actual_amount: Decimal,
) -> BudgetStatusItem:
    budget_amount = Decimal(budget.amount)
    actual = Decimal(actual_amount)
    remaining = budget_amount - actual
    percent_used = None
    if budget_amount > ZERO:
        percent_used = ((actual / budget_amount) * Decimal("100")).quantize(
            Decimal("0.01")
        )
    return BudgetStatusItem(
        budget_id=budget.id,
        category_id=budget.category_id,
        category_name=category_name or "Overall",
        category_icon=category_icon,
        budget_amount=budget_amount,
        actual_amount=actual,
        remaining_amount=remaining,
        percent_used=percent_used,
        is_over_budget=actual > budget_amount,
    )


@router.get("/budget-status", response_model=BudgetStatusResponse)
def budget_status(
    month: int | None = Query(default=None, ge=1, le=12),
    year: int | None = Query(default=None, ge=2000, le=2100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BudgetStatusResponse:
    resolved_month, resolved_year, start, end = _period_bounds(month, year)
    currency = "INR"

    actual_rows = (
        db.query(
            Expense.category_id,
            func.coalesce(func.sum(Expense.amount), 0).label("amount"),
        )
        .filter(
            *_verified_expense_filters(
                current_user.id,
                currency,
                start,
                end,
            )
        )
        .group_by(Expense.category_id)
        .all()
    )
    actual_by_category = {
        row.category_id: Decimal(row.amount)
        for row in actual_rows
        if row.category_id is not None
    }
    overall_actual = sum(
        (Decimal(row.amount) for row in actual_rows),
        start=ZERO,
    )

    budget_rows = (
        db.query(Budget, Category.name, Category.icon)
        .outerjoin(
            Category,
            and_(
                Category.id == Budget.category_id,
                or_(
                    Category.user_id.is_(None),
                    Category.user_id == current_user.id,
                ),
            ),
        )
        .filter(
            Budget.user_id == current_user.id,
            Budget.month == resolved_month,
            Budget.year == resolved_year,
        )
        .order_by(Category.name.asc())
        .all()
    )

    overall: BudgetStatusItem | None = None
    category_items: list[BudgetStatusItem] = []
    for budget, category_name, category_icon in budget_rows:
        if budget.category_id is None:
            overall = _build_budget_status(
                budget,
                "Overall",
                None,
                overall_actual,
            )
        else:
            category_items.append(
                _build_budget_status(
                    budget,
                    category_name or "Unavailable category",
                    category_icon,
                    actual_by_category.get(budget.category_id, ZERO),
                )
            )

    return BudgetStatusResponse(
        month=resolved_month,
        year=resolved_year,
        currency=currency,
        overall=overall,
        categories=category_items,
    )
