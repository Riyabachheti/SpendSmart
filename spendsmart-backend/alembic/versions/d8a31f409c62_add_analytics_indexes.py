"""add analytics and overall-budget indexes

Revision ID: d8a31f409c62
Revises: b7f0c2a4d9e1
Create Date: 2026-07-31

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "d8a31f409c62"
down_revision: str | Sequence[str] | None = "b7f0c2a4d9e1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index(
        "ix_expenses_user_id_expense_date",
        "expenses",
        ["user_id", "expense_date"],
        unique=False,
    )
    op.create_index(
        "ix_budgets_user_year_month",
        "budgets",
        ["user_id", "year", "month"],
        unique=False,
    )
    op.create_index(
        "uq_budgets_user_overall_period",
        "budgets",
        ["user_id", "month", "year"],
        unique=True,
        postgresql_where=sa.text("category_id IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_budgets_user_overall_period", table_name="budgets")
    op.drop_index("ix_budgets_user_year_month", table_name="budgets")
    op.drop_index("ix_expenses_user_id_expense_date", table_name="expenses")
