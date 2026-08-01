from sqlalchemy import Column, ForeignKey, Index, Integer, Numeric, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.database import Base


class Budget(Base):
    __tablename__ = "budgets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # NULL denotes an overall budget; otherwise it is category-specific.
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="CASCADE"), nullable=True, index=True)

    amount = Column(Numeric(10, 2), nullable=False)
    month = Column(Integer, nullable=False)  # 1-12
    year = Column(Integer, nullable=False)

    # The partial index covers overall budgets, whose category_id is NULL.
    __table_args__ = (
        UniqueConstraint("user_id", "category_id", "month", "year", name="uq_budget_user_category_period"),
        Index(
            "uq_budgets_user_overall_period",
            "user_id",
            "month",
            "year",
            unique=True,
            postgresql_where=category_id.is_(None),
            sqlite_where=category_id.is_(None),
        ),
        Index(
            "ix_budgets_user_year_month",
            "user_id",
            "year",
            "month",
        ),
    )

    user = relationship("User", back_populates="budgets")
    category = relationship("Category")
