from datetime import date
from decimal import Decimal
from io import BytesIO

from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.core.security import create_access_token
from app.models.expense import Expense, ExpenseSource, OCRStatus
from app.models.user import User
from app.tasks import receipt_tasks


def auth_headers(user_id: int) -> dict[str, str]:
    token = create_access_token({"sub": str(user_id)})
    return {"Authorization": f"Bearer {token}"}


def create_user(session_factory: sessionmaker[Session]) -> User:
    db = session_factory()
    try:
        user = User(email="ocr-user@example.com", hashed_password="unused")
        db.add(user)
        db.commit()
        db.refresh(user)
        db.expunge(user)
        return user
    finally:
        db.close()


def png_bytes() -> bytes:
    output = BytesIO()
    Image.new("RGB", (40, 20), color="white").save(output, format="PNG")
    return output.getvalue()


def test_receipt_upload_creates_pollable_pending_expense(
    client: TestClient,
    session_factory: sessionmaker[Session],
    monkeypatch,
) -> None:
    user = create_user(session_factory)
    queued_ids: list[int] = []
    monkeypatch.setattr(
        "app.api.expenses.upload_receipt_image",
        lambda _data, user_id: f"https://example.test/{user_id}/receipt.png",
    )
    monkeypatch.setattr(
        "app.api.expenses.process_receipt.delay",
        queued_ids.append,
    )

    response = client.post(
        "/expenses/receipts",
        headers=auth_headers(user.id),
        files={"file": ("receipt.png", png_bytes(), "image/png")},
    )

    assert response.status_code == 202
    expense_id = response.json()["expense_id"]
    assert response.json()["ocr_status"] == "pending"
    assert queued_ids == [expense_id]

    poll_response = client.get(
        f"/expenses/{expense_id}",
        headers=auth_headers(user.id),
    )
    assert poll_response.status_code == 200
    assert poll_response.json()["amount"] == "0.00"
    assert poll_response.json()["ocr_status"] == "pending"


def test_receipt_upload_rejects_unsupported_or_invalid_files(
    client: TestClient,
    session_factory: sessionmaker[Session],
) -> None:
    user = create_user(session_factory)
    headers = auth_headers(user.id)

    unsupported = client.post(
        "/expenses/receipts",
        headers=headers,
        files={"file": ("receipt.txt", b"not an image", "text/plain")},
    )
    assert unsupported.status_code == 415

    invalid_image = client.post(
        "/expenses/receipts",
        headers=headers,
        files={"file": ("receipt.png", b"not an image", "image/png")},
    )
    assert invalid_image.status_code == 400


def test_receipt_upload_enforces_size_limit_before_external_upload(
    client: TestClient,
    session_factory: sessionmaker[Session],
    monkeypatch,
) -> None:
    user = create_user(session_factory)
    monkeypatch.setattr(settings, "receipt_max_upload_bytes", 10)

    response = client.post(
        "/expenses/receipts",
        headers=auth_headers(user.id),
        files={"file": ("receipt.png", png_bytes(), "image/png")},
    )

    assert response.status_code == 413


def test_queue_failure_marks_expense_failed_and_returns_retry_id(
    client: TestClient,
    session_factory: sessionmaker[Session],
    monkeypatch,
) -> None:
    user = create_user(session_factory)
    monkeypatch.setattr(
        "app.api.expenses.upload_receipt_image",
        lambda _data, user_id: f"https://example.test/{user_id}/receipt.png",
    )

    def fail_publish(_expense_id: int) -> None:
        raise ConnectionError("broker unavailable")

    monkeypatch.setattr("app.api.expenses.process_receipt.delay", fail_publish)

    response = client.post(
        "/expenses/receipts",
        headers=auth_headers(user.id),
        files={"file": ("receipt.png", png_bytes(), "image/png")},
    )

    assert response.status_code == 503
    expense_id = response.json()["detail"]["expense_id"]
    db = session_factory()
    try:
        expense = db.get(Expense, expense_id)
        assert expense is not None
        assert expense.ocr_status == OCRStatus.failed
    finally:
        db.close()


def test_failed_ocr_can_be_requeued(
    client: TestClient,
    session_factory: sessionmaker[Session],
    monkeypatch,
) -> None:
    user = create_user(session_factory)
    db = session_factory()
    try:
        expense = Expense(
            user_id=user.id,
            amount=Decimal("0.00"),
            currency="INR",
            expense_date=date(2026, 7, 31),
            receipt_url="https://example.test/receipt.png",
            source=ExpenseSource.ocr,
            is_verified=False,
            ocr_status=OCRStatus.failed,
        )
        db.add(expense)
        db.commit()
        db.refresh(expense)
        expense_id = expense.id
    finally:
        db.close()

    queued_ids: list[int] = []
    monkeypatch.setattr(
        "app.api.expenses.process_receipt.delay",
        queued_ids.append,
    )
    response = client.post(
        f"/expenses/{expense_id}/retry-ocr",
        headers=auth_headers(user.id),
    )

    assert response.status_code == 202
    assert response.json()["ocr_status"] == "pending"
    assert queued_ids == [expense_id]


def test_worker_smoke_processes_pending_receipt(
    session_factory: sessionmaker[Session],
    monkeypatch,
) -> None:
    user = create_user(session_factory)
    db = session_factory()
    try:
        expense = Expense(
            user_id=user.id,
            amount=Decimal("0.00"),
            currency="INR",
            expense_date=date(2026, 7, 31),
            receipt_url="https://example.test/receipt.png",
            source=ExpenseSource.ocr,
            is_verified=False,
            ocr_status=OCRStatus.pending,
        )
        db.add(expense)
        db.commit()
        db.refresh(expense)
        expense_id = expense.id
    finally:
        db.close()

    class FakeResponse:
        content = png_bytes()

        @staticmethod
        def raise_for_status() -> None:
            return None

    monkeypatch.setattr(receipt_tasks, "SessionLocal", session_factory)
    monkeypatch.setattr(receipt_tasks.requests, "get", lambda *_args, **_kwargs: FakeResponse())
    monkeypatch.setattr(
        receipt_tasks,
        "extract_text_from_image",
        lambda _image: "Corner Cafe\n31-Jul-2026\nTOTAL INR 245.50",
    )

    receipt_tasks.process_receipt.run(expense_id)

    db = session_factory()
    try:
        processed = db.get(Expense, expense_id)
        assert processed is not None
        assert processed.ocr_status == OCRStatus.completed
        assert processed.amount == Decimal("245.50")
        assert processed.expense_date == date(2026, 7, 31)
        assert processed.merchant_name == "Corner Cafe"
        assert processed.ocr_raw_text.startswith("Corner Cafe")
    finally:
        db.close()
