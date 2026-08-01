from datetime import date
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session, sessionmaker

from app.core.security import create_access_token
from app.models.budget import Budget
from app.models.category import Category
from app.models.expense import Expense, ExpenseSource, OCRStatus
from app.models.user import User


def auth_headers(user_id: int) -> dict[str, str]:
    token = create_access_token({"sub": str(user_id)})
    return {"Authorization": f"Bearer {token}"}


def create_user(db: Session, email: str) -> User:
    user = User(email=email, hashed_password="not-used-by-these-tests")
    db.add(user)
    db.flush()
    return user


def create_expense(
    db: Session,
    *,
    user_id: int,
    category_id: int | None,
    source: ExpenseSource = ExpenseSource.manual,
    is_verified: bool = True,
    ocr_status: OCRStatus | None = None,
) -> Expense:
    expense = Expense(
        user_id=user_id,
        category_id=category_id,
        amount=Decimal("100.00"),
        currency="INR",
        expense_date=date(2026, 7, 31),
        source=source,
        is_verified=is_verified,
        ocr_status=ocr_status,
    )
    db.add(expense)
    db.flush()
    return expense


@pytest.fixture
def tenant_data(session_factory: sessionmaker[Session]) -> dict[str, int]:
    db = session_factory()
    try:
        owner = create_user(db, "owner@example.com")
        other = create_user(db, "other@example.com")
        system_category = Category(name="Food", user_id=None)
        owner_category = Category(name="Owner category", user_id=owner.id)
        other_category = Category(name="Other category", user_id=other.id)
        db.add_all([system_category, owner_category, other_category])
        db.flush()
        manual_expense = create_expense(
            db,
            user_id=owner.id,
            category_id=owner_category.id,
        )
        pending_ocr_expense = create_expense(
            db,
            user_id=owner.id,
            category_id=owner_category.id,
            source=ExpenseSource.ocr,
            is_verified=False,
            ocr_status=OCRStatus.pending,
        )
        completed_ocr_expense = create_expense(
            db,
            user_id=owner.id,
            category_id=owner_category.id,
            source=ExpenseSource.ocr,
            is_verified=False,
            ocr_status=OCRStatus.completed,
        )
        db.commit()
        return {
            "owner_id": owner.id,
            "other_id": other.id,
            "system_category_id": system_category.id,
            "owner_category_id": owner_category.id,
            "other_category_id": other_category.id,
            "manual_expense_id": manual_expense.id,
            "pending_ocr_expense_id": pending_ocr_expense.id,
            "completed_ocr_expense_id": completed_ocr_expense.id,
        }
    finally:
        db.close()


def test_expense_update_rejects_other_users_category(
    client: TestClient,
    tenant_data: dict[str, int],
) -> None:
    response = client.patch(
        f"/expenses/{tenant_data['manual_expense_id']}",
        headers=auth_headers(tenant_data["owner_id"]),
        json={"category_id": tenant_data["other_category_id"]},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid category_id."


def test_budget_create_rejects_other_users_category(
    client: TestClient,
    tenant_data: dict[str, int],
) -> None:
    response = client.post(
        "/budgets",
        headers=auth_headers(tenant_data["owner_id"]),
        json={
            "amount": "5000.00",
            "category_id": tenant_data["other_category_id"],
            "month": 7,
            "year": 2026,
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid category_id."


@pytest.mark.parametrize("field", ["amount", "currency", "expense_date"])
def test_expense_patch_rejects_null_for_required_fields(
    client: TestClient,
    tenant_data: dict[str, int],
    field: str,
) -> None:
    response = client.patch(
        f"/expenses/{tenant_data['manual_expense_id']}",
        headers=auth_headers(tenant_data["owner_id"]),
        json={field: None},
    )

    assert response.status_code == 422


@pytest.mark.parametrize("amount", ["0", "-1.00"])
def test_manual_expense_requires_positive_amount(
    client: TestClient,
    tenant_data: dict[str, int],
    amount: str,
) -> None:
    response = client.post(
        "/expenses",
        headers=auth_headers(tenant_data["owner_id"]),
        json={"amount": amount, "expense_date": "2026-07-31"},
    )

    assert response.status_code == 422


def test_budget_requires_positive_amount(
    client: TestClient,
    tenant_data: dict[str, int],
) -> None:
    response = client.post(
        "/budgets",
        headers=auth_headers(tenant_data["owner_id"]),
        json={"amount": "-1.00", "month": 7, "year": 2026},
    )

    assert response.status_code == 422


def test_confirm_rejects_manual_expense(
    client: TestClient,
    tenant_data: dict[str, int],
) -> None:
    response = client.post(
        f"/expenses/{tenant_data['manual_expense_id']}/confirm",
        headers=auth_headers(tenant_data["owner_id"]),
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "Only OCR expenses can be confirmed."


def test_confirm_requires_completed_ocr(
    client: TestClient,
    tenant_data: dict[str, int],
) -> None:
    response = client.post(
        f"/expenses/{tenant_data['pending_ocr_expense_id']}/confirm",
        headers=auth_headers(tenant_data["owner_id"]),
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "OCR processing must complete before confirmation."


def test_completed_ocr_can_be_confirmed(
    client: TestClient,
    tenant_data: dict[str, int],
) -> None:
    response = client.post(
        f"/expenses/{tenant_data['completed_ocr_expense_id']}/confirm",
        headers=auth_headers(tenant_data["owner_id"]),
    )

    assert response.status_code == 200
    assert response.json()["is_verified"] is True


def test_processing_ocr_cannot_be_edited(
    client: TestClient,
    tenant_data: dict[str, int],
    session_factory: sessionmaker[Session],
) -> None:
    db = session_factory()
    try:
        expense = db.get(Expense, tenant_data["pending_ocr_expense_id"])
        assert expense is not None
        expense.ocr_status = OCRStatus.processing
        db.commit()
    finally:
        db.close()

    response = client.patch(
        f"/expenses/{tenant_data['pending_ocr_expense_id']}",
        headers=auth_headers(tenant_data["owner_id"]),
        json={"amount": "123.00"},
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "Wait for OCR processing to finish before editing."


def test_valid_budget_with_system_category_is_created(
    client: TestClient,
    tenant_data: dict[str, int],
    session_factory: sessionmaker[Session],
) -> None:
    response = client.post(
        "/budgets",
        headers=auth_headers(tenant_data["owner_id"]),
        json={
            "amount": "5000.00",
            "category_id": tenant_data["system_category_id"],
            "month": 7,
            "year": 2026,
        },
    )

    assert response.status_code == 201
    db = session_factory()
    try:
        budget = db.get(Budget, response.json()["id"])
        assert budget is not None
        assert budget.user_id == tenant_data["owner_id"]
    finally:
        db.close()


def test_category_update_changes_owned_category(
    client: TestClient,
    tenant_data: dict[str, int],
) -> None:
    response = client.patch(
        f"/categories/{tenant_data['owner_category_id']}",
        headers=auth_headers(tenant_data["owner_id"]),
        json={"name": "  Dining  ", "icon": "🍽️"},
    )

    assert response.status_code == 200
    assert response.json()["name"] == "Dining"
    assert response.json()["icon"] == "🍽️"


def test_category_update_rejects_system_category(
    client: TestClient,
    tenant_data: dict[str, int],
) -> None:
    response = client.patch(
        f"/categories/{tenant_data['system_category_id']}",
        headers=auth_headers(tenant_data["owner_id"]),
        json={"name": "Renamed system category"},
    )

    assert response.status_code == 404


def test_category_update_rejects_empty_patch(
    client: TestClient,
    tenant_data: dict[str, int],
) -> None:
    response = client.patch(
        f"/categories/{tenant_data['owner_category_id']}",
        headers=auth_headers(tenant_data["owner_id"]),
        json={},
    )

    assert response.status_code == 422


def test_category_create_rejects_system_name_case_insensitively(
    client: TestClient,
    tenant_data: dict[str, int],
) -> None:
    response = client.post(
        "/categories",
        headers=auth_headers(tenant_data["owner_id"]),
        json={"name": "  fOoD  "},
    )

    assert response.status_code == 400


def test_category_update_rejects_system_name_case_insensitively(
    client: TestClient,
    tenant_data: dict[str, int],
) -> None:
    response = client.patch(
        f"/categories/{tenant_data['owner_category_id']}",
        headers=auth_headers(tenant_data["owner_id"]),
        json={"name": "FOOD"},
    )

    assert response.status_code == 400


def test_different_users_can_use_same_custom_category_name(
    client: TestClient,
    tenant_data: dict[str, int],
) -> None:
    owner_response = client.post(
        "/categories",
        headers=auth_headers(tenant_data["owner_id"]),
        json={"name": "Side Project"},
    )
    other_response = client.post(
        "/categories",
        headers=auth_headers(tenant_data["other_id"]),
        json={"name": "side project"},
    )

    assert owner_response.status_code == 201
    assert other_response.status_code == 201


def test_expense_list_returns_pagination_metadata(
    client: TestClient,
    tenant_data: dict[str, int],
) -> None:
    response = client.get(
        "/expenses",
        params={"skip": 0, "limit": 2},
        headers=auth_headers(tenant_data["owner_id"]),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 3
    assert body["skip"] == 0
    assert body["limit"] == 2
    assert body["has_more"] is True
    assert len(body["items"]) == 2
    assert body["items"][0]["id"] > body["items"][1]["id"]


def test_expense_list_rejects_invalid_pagination(
    client: TestClient,
    tenant_data: dict[str, int],
) -> None:
    response = client.get(
        "/expenses",
        params={"skip": -1, "limit": 0},
        headers=auth_headers(tenant_data["owner_id"]),
    )

    assert response.status_code == 422
