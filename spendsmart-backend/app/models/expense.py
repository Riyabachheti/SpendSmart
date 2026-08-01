import enum

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class ExpenseSource(str, enum.Enum):
    manual = "manual"
    ocr = "ocr"


class OCRStatus(str, enum.Enum):
    pending = "pending"        # task enqueued, worker hasn't started yet
    processing = "processing"  # worker is actively running OCR/parsing
    completed = "completed"    # OCR + parsing finished successfully
    failed = "failed"          # OCR or parsing failed; needs manual entry instead


class Expense(Base):
    __tablename__ = "expenses"
    __table_args__ = (
        Index(
            "ix_expenses_user_id_expense_date",
            "user_id",
            "expense_date",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # OCR expenses may be uncategorized; deleting a category preserves the expense.
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True, index=True)

    # Decimal storage avoids floating-point errors for money.
    amount = Column(Numeric(10, 2), nullable=False)
    currency = Column(String(3), nullable=False, default="INR")

    merchant_name = Column(String, nullable=True)
    expense_date = Column(Date, nullable=False, index=True)
    description = Column(Text, nullable=True)

    # OCR pipeline fields
    receipt_url = Column(String, nullable=True)
    ocr_raw_text = Column(Text, nullable=True)
    source = Column(Enum(ExpenseSource), nullable=False, default=ExpenseSource.manual)
    is_verified = Column(Boolean, nullable=False, default=True)  # False until user confirms OCR-parsed data

    # NULL for manual expenses; OCR expenses use an explicit pipeline state.
    ocr_status = Column(Enum(OCRStatus), nullable=True, default=None)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="expenses")
    category = relationship("Category", back_populates="expenses")
