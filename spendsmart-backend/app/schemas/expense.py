"""Expense request and response schemas."""

from datetime import date, datetime

from pydantic import BaseModel, model_validator

from app.models.expense import ExpenseSource, OCRStatus
from app.schemas.common import CurrencyCode, MoneyAmount, NonNegativeMoneyAmount


class ExpenseCreate(BaseModel):
    """Fields accepted for a manually entered expense."""

    amount: MoneyAmount
    currency: CurrencyCode = "INR"
    category_id: int | None = None
    merchant_name: str | None = None
    expense_date: date
    description: str | None = None


class ExpenseUpdate(BaseModel):
    """Optional fields accepted when updating an expense."""

    amount: MoneyAmount | None = None
    currency: CurrencyCode | None = None
    category_id: int | None = None
    merchant_name: str | None = None
    expense_date: date | None = None
    description: str | None = None

    @model_validator(mode="before")
    @classmethod
    def required_fields_cannot_be_null(cls, value):
        if isinstance(value, dict):
            for field in ("amount", "currency", "expense_date"):
                if field in value and value[field] is None:
                    raise ValueError(f"{field} cannot be null")
        return value


class ExpenseOut(BaseModel):
    """Response body whenever an expense is returned to the client."""

    id: int
    user_id: int
    category_id: int | None = None
    amount: NonNegativeMoneyAmount
    currency: str
    merchant_name: str | None = None
    expense_date: date
    description: str | None = None
    receipt_url: str | None = None
    ocr_raw_text: str | None = None
    source: ExpenseSource
    is_verified: bool
    ocr_status: OCRStatus | None = None
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class ExpensePage(BaseModel):
    """Stable pagination envelope consumed by the expense-list UI."""

    items: list[ExpenseOut]
    total: int
    skip: int
    limit: int
    has_more: bool


class ReceiptUploadResponse(BaseModel):
    """Receipt-processing status returned by asynchronous endpoints."""

    expense_id: int
    ocr_status: str
