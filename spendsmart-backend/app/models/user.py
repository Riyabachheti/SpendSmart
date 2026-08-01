from sqlalchemy import CheckConstraint, Column, DateTime, Index, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    __table_args__ = (
        CheckConstraint(
            "email = lower(trim(email))",
            name="ck_users_email_normalized",
        ),
        Index(
            "uq_users_email_lower",
            func.lower(email),
            unique=True,
        ),
    )

    # Relationships
    categories = relationship(
        "Category", back_populates="user", cascade="all, delete-orphan"
    )
    expenses = relationship(
        "Expense", back_populates="user", cascade="all, delete-orphan"
    )
    budgets = relationship("Budget", back_populates="user", cascade="all, delete-orphan")
    refresh_sessions = relationship(
        "RefreshSession",
        back_populates="user",
        cascade="all, delete-orphan",
    )
