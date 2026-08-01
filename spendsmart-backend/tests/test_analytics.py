from datetime import date
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session, sessionmaker

from app.core.security import create_access_token
from app.models.budget import Budget
from app.models.category import Category
from app.models.expense import Expense, ExpenseSource
from app.models.user import User


def auth_headers(user_id: int) -> dict[str, str]:
    token = create_access_token({"sub": str(user_id)})
    return {"Authorization": f"Bearer {token}"}


def add_expense(
    db: Session,
    *,
    user_id: int,
    amount: str,
    expense_date: date,
    category_id: int | None,
    currency: str = "INR",
    is_verified: bool = True,
) -> None:
    db.add(
        Expense(
            user_id=user_id,
            category_id=category_id,
            amount=Decimal(amount),
            currency=currency,
            expense_date=expense_date,
            source=ExpenseSource.manual,
            is_verified=is_verified,
        )
    )


@pytest.fixture
def analytics_data(session_factory: sessionmaker[Session]) -> dict[str, int]:
    db = session_factory()
    try:
        owner = User(email="analytics-owner@example.com", hashed_password="unused")
        other = User(email="analytics-other@example.com", hashed_password="unused")
        db.add_all([owner, other])
        db.flush()
        food = Category(name="Food", user_id=None, icon="food")
        travel = Category(name="Travel", user_id=owner.id, icon="travel")
        db.add_all([food, travel])
        db.flush()

        add_expense(
            db,
            user_id=owner.id,
            amount="100.00",
            expense_date=date(2026, 7, 5),
            category_id=food.id,
        )
        add_expense(
            db,
            user_id=owner.id,
            amount="50.00",
            expense_date=date(2026, 7, 15),
            category_id=travel.id,
        )
        add_expense(
            db,
            user_id=owner.id,
            amount="10.00",
            expense_date=date(2026, 7, 20),
            category_id=None,
        )
        add_expense(
            db,
            user_id=owner.id,
            amount="999.00",
            expense_date=date(2026, 7, 21),
            category_id=food.id,
            is_verified=False,
        )
        add_expense(
            db,
            user_id=owner.id,
            amount="20.00",
            expense_date=date(2026, 7, 22),
            category_id=food.id,
            currency="USD",
        )
        add_expense(
            db,
            user_id=owner.id,
            amount="40.00",
            expense_date=date(2026, 6, 8),
            category_id=food.id,
        )
        add_expense(
            db,
            user_id=other.id,
            amount="500.00",
            expense_date=date(2026, 7, 8),
            category_id=food.id,
        )
        db.add_all(
            [
                Budget(
                    user_id=owner.id,
                    category_id=None,
                    amount=Decimal("300.00"),
                    month=7,
                    year=2026,
                ),
                Budget(
                    user_id=owner.id,
                    category_id=food.id,
                    amount=Decimal("150.00"),
                    month=7,
                    year=2026,
                ),
                Budget(
                    user_id=owner.id,
                    category_id=travel.id,
                    amount=Decimal("40.00"),
                    month=7,
                    year=2026,
                ),
            ]
        )
        db.commit()
        return {
            "owner_id": owner.id,
            "food_id": food.id,
            "travel_id": travel.id,
        }
    finally:
        db.close()


def test_summary_groups_verified_expenses_by_category(
    client: TestClient,
    analytics_data: dict[str, int],
) -> None:
    response = client.get(
        "/analytics/summary",
        params={"month": 7, "year": 2026, "currency": "INR"},
        headers=auth_headers(analytics_data["owner_id"]),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["total_spent"] == "160.00"
    assert body["expense_count"] == 3
    assert [
        (item["category_name"], item["amount"], item["expense_count"])
        for item in body["by_category"]
    ] == [
        ("Food", "100.00", 1),
        ("Travel", "50.00", 1),
        ("Uncategorized", "10.00", 1),
    ]


def test_summary_keeps_currencies_separate(
    client: TestClient,
    analytics_data: dict[str, int],
) -> None:
    response = client.get(
        "/analytics/summary",
        params={"month": 7, "year": 2026, "currency": "USD"},
        headers=auth_headers(analytics_data["owner_id"]),
    )

    assert response.status_code == 200
    assert response.json()["total_spent"] == "20.00"
    assert response.json()["expense_count"] == 1


def test_trend_fills_months_without_expenses(
    client: TestClient,
    analytics_data: dict[str, int],
) -> None:
    response = client.get(
        "/analytics/trend",
        params={
            "months": 3,
            "end_month": 7,
            "end_year": 2026,
            "currency": "INR",
        },
        headers=auth_headers(analytics_data["owner_id"]),
    )

    assert response.status_code == 200
    assert response.json()["months"] == [
        {"month": 5, "year": 2026, "total_spent": "0.00", "expense_count": 0},
        {"month": 6, "year": 2026, "total_spent": "40.00", "expense_count": 1},
        {"month": 7, "year": 2026, "total_spent": "160.00", "expense_count": 3},
    ]


def test_budget_status_calculates_overall_and_category_usage(
    client: TestClient,
    analytics_data: dict[str, int],
) -> None:
    response = client.get(
        "/analytics/budget-status",
        params={"month": 7, "year": 2026},
        headers=auth_headers(analytics_data["owner_id"]),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["currency"] == "INR"
    assert body["overall"]["budget_amount"] == "300.00"
    assert body["overall"]["actual_amount"] == "160.00"
    assert body["overall"]["remaining_amount"] == "140.00"
    assert body["overall"]["percent_used"] == "53.33"
    statuses = {item["category_name"]: item for item in body["categories"]}
    assert statuses["Food"]["actual_amount"] == "100.00"
    assert statuses["Food"]["is_over_budget"] is False
    assert statuses["Travel"]["actual_amount"] == "50.00"
    assert statuses["Travel"]["remaining_amount"] == "-10.00"
    assert statuses["Travel"]["percent_used"] == "125.00"
    assert statuses["Travel"]["is_over_budget"] is True


def test_analytics_query_validation(
    client: TestClient,
    analytics_data: dict[str, int],
) -> None:
    headers = auth_headers(analytics_data["owner_id"])
    assert (
        client.get(
            "/analytics/trend",
            params={"months": 25},
            headers=headers,
        ).status_code
        == 422
    )
    assert (
        client.get(
            "/analytics/summary",
            params={"currency": "inr"},
            headers=headers,
        ).status_code
        == 422
    )
