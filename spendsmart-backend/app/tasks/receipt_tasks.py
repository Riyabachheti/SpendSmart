"""Celery tasks for asynchronous receipt processing."""

import requests
from sqlalchemy.orm import Session

from app.core.celery_app import celery_app
from app.core.database import SessionLocal
from app.models.expense import Expense, ExpenseSource, OCRStatus
from app.services.ocr_service import extract_text_from_image
from app.services.receipt_parser import parse_receipt


@celery_app.task(
    name="process_receipt",
    bind=True,
    max_retries=2,
    soft_time_limit=60,
    time_limit=75,
)
def process_receipt(self, expense_id: int) -> None:
    """Download, parse, and persist fields for a pending OCR expense."""
    db = SessionLocal()
    try:
        # Claim with one conditional UPDATE. Concurrent duplicate deliveries
        # cannot both move the same row from pending to processing.
        claimed = (
            db.query(Expense)
            .filter(
                Expense.id == expense_id,
                Expense.source == ExpenseSource.ocr,
                Expense.is_verified.is_(False),
                Expense.ocr_status == OCRStatus.pending,
            )
            .update(
                {Expense.ocr_status: OCRStatus.processing},
                synchronize_session=False,
            )
        )
        db.commit()
        if claimed != 1:
            return

        expense = db.get(Expense, expense_id)
        if expense is None:
            return

        image_response = requests.get(expense.receipt_url, timeout=(5, 30))
        image_response.raise_for_status()

        raw_text = extract_text_from_image(image_response.content)
        parsed = parse_receipt(raw_text)

        # Re-read state after the slow external/OCR work. If another actor
        # changed or deleted the row, do not overwrite newer user data.
        db.expire_all()
        expense = db.get(Expense, expense_id)
        if (
            expense is None
            or expense.is_verified
            or expense.ocr_status != OCRStatus.processing
        ):
            return

        expense.ocr_raw_text = raw_text
        if parsed["amount"] is not None:
            expense.amount = parsed["amount"]
        if parsed["expense_date"] is not None:
            expense.expense_date = parsed["expense_date"]
        if parsed["merchant_name"] is not None:
            expense.merchant_name = parsed["merchant_name"]

        expense.ocr_status = OCRStatus.completed
        db.commit()

    except requests.RequestException as exc:
        db.rollback()
        if self.request.retries < self.max_retries:
            _transition_processing_status(db, expense_id, OCRStatus.pending)
            raise self.retry(
                exc=exc,
                countdown=2 ** (self.request.retries + 1),
            ) from exc
        _transition_processing_status(db, expense_id, OCRStatus.failed)
        raise
    except Exception:
        db.rollback()
        _transition_processing_status(db, expense_id, OCRStatus.failed)
        raise
    finally:
        db.close()


def _transition_processing_status(
    db: Session,
    expense_id: int,
    target_status: OCRStatus,
) -> None:
    (
        db.query(Expense)
        .filter(
            Expense.id == expense_id,
            Expense.is_verified.is_(False),
            Expense.ocr_status == OCRStatus.processing,
        )
        .update(
            {Expense.ocr_status: target_status},
            synchronize_session=False,
        )
    )
    db.commit()
