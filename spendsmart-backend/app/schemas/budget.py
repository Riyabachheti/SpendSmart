"""Budget request and response schemas."""

from pydantic import BaseModel, Field, model_validator

from app.schemas.common import MoneyAmount


class BudgetCreate(BaseModel):
    """Fields accepted when creating a monthly budget."""

    amount: MoneyAmount
    category_id: int | None = None
    month: int = Field(ge=1, le=12)
    year: int = Field(ge=2000, le=2100)


class BudgetUpdate(BaseModel):
    """Mutable fields for an existing budget."""

    amount: MoneyAmount | None = None

    @model_validator(mode="before")
    @classmethod
    def amount_cannot_be_null(cls, value):
        if isinstance(value, dict) and "amount" in value and value["amount"] is None:
            raise ValueError("amount cannot be null")
        return value


class BudgetOut(BaseModel):
    """Response body whenever a budget is returned to the client."""

    id: int
    user_id: int
    category_id: int | None = None
    amount: MoneyAmount
    month: int
    year: int

    model_config = {"from_attributes": True}
