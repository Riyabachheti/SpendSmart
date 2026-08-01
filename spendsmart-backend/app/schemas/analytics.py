from decimal import Decimal

from pydantic import BaseModel


class CategorySpend(BaseModel):
    category_id: int | None
    category_name: str
    category_icon: str | None
    amount: Decimal
    expense_count: int


class SpendingSummary(BaseModel):
    month: int
    year: int
    currency: str
    total_spent: Decimal
    expense_count: int
    by_category: list[CategorySpend]


class TrendPoint(BaseModel):
    month: int
    year: int
    total_spent: Decimal
    expense_count: int


class SpendingTrend(BaseModel):
    currency: str
    months: list[TrendPoint]


class BudgetStatusItem(BaseModel):
    budget_id: int
    category_id: int | None
    category_name: str
    category_icon: str | None
    budget_amount: Decimal
    actual_amount: Decimal
    remaining_amount: Decimal
    percent_used: Decimal | None
    is_over_budget: bool


class BudgetStatusResponse(BaseModel):
    month: int
    year: int
    currency: str
    overall: BudgetStatusItem | None
    categories: list[BudgetStatusItem]

