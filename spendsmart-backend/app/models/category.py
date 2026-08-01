from sqlalchemy import (
    CheckConstraint,
    Column,
    ForeignKey,
    Index,
    Integer,
    String,
    func,
)
from sqlalchemy.orm import relationship

from app.core.database import Base


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    # NULL denotes a shared system category; otherwise this is user-owned.
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    name = Column(String, nullable=False)
    icon = Column(String, nullable=True)

    # Enforce case-insensitive uniqueness within system and per-user scopes.
    __table_args__ = (
        CheckConstraint(
            "name = trim(name) AND length(name) > 0",
            name="ck_categories_name_normalized",
        ),
        Index(
            "uq_categories_system_name_lower",
            func.lower(name),
            unique=True,
            postgresql_where=user_id.is_(None),
            sqlite_where=user_id.is_(None),
        ),
        Index(
            "uq_categories_user_name_lower",
            user_id,
            func.lower(name),
            unique=True,
            postgresql_where=user_id.is_not(None),
            sqlite_where=user_id.is_not(None),
        ),
    )

    user = relationship("User", back_populates="categories")
    expenses = relationship("Expense", back_populates="category")
