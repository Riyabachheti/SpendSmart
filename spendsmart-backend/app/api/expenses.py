"""Expense CRUD and receipt-processing endpoints."""

import logging
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_owned_expense, require_visible_category
from app.core.config import settings
from app.core.database import get_db
from app.models.expense import Expense, ExpenseSource, OCRStatus
from app.models.user import User
from app.schemas.expense import (
    ExpenseCreate,
    ExpenseOut,
    ExpensePage,
    ExpenseUpdate,
    ReceiptUploadResponse,
)
from app.services.cloudinary_service import upload_receipt_image
from app.services.ocr_service import InvalidReceiptImage, validate_receipt_image
from app.tasks.receipt_tasks import process_receipt

router = APIRouter(prefix="/expenses", tags=["expenses"])
logger = logging.getLogger(__name__)
ALLOWED_RECEIPT_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
}


@router.post("", response_model=ExpenseOut, status_code=status.HTTP_201_CREATED)
def create_expense(
    payload: ExpenseCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Expense:
    """Create a manual expense owned by the current user."""
    if payload.category_id is not None:
        require_visible_category(payload.category_id, current_user, db)

    new_expense = Expense(
        user_id=current_user.id,
        category_id=payload.category_id,
        amount=payload.amount,
        currency=payload.currency,
        merchant_name=payload.merchant_name,
        expense_date=payload.expense_date,
        description=payload.description,
        source=ExpenseSource.manual,
    )
    db.add(new_expense)
    db.commit()
    db.refresh(new_expense)

    return new_expense


@router.get("", response_model=ExpensePage)
def list_expenses(
    category_id: int | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    source: ExpenseSource | None = None,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ExpensePage:
    """List owned expenses with optional filters and bounded pagination."""
    query = db.query(Expense).filter(Expense.user_id == current_user.id)

    if category_id is not None:
        query = query.filter(Expense.category_id == category_id)
    if start_date is not None:
        query = query.filter(Expense.expense_date >= start_date)
    if end_date is not None:
        query = query.filter(Expense.expense_date <= end_date)
    if source is not None:
        query = query.filter(Expense.source == source)

    total = query.order_by(None).count()
    items = (
        query.order_by(Expense.expense_date.desc())
        .order_by(Expense.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return ExpensePage(
        items=items,
        total=total,
        skip=skip,
        limit=limit,
        has_more=skip + len(items) < total,
    )


# Keep static routes above /{expense_id}; Starlette resolves them in declaration order.
@router.get("/pending-review", response_model=list[ExpenseOut])
def list_pending_review(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Expense]:
    """List completed OCR expenses awaiting user confirmation."""
    return (
        db.query(Expense)
        .filter(
            Expense.user_id == current_user.id,
            Expense.source == ExpenseSource.ocr,
            Expense.ocr_status == OCRStatus.completed,
            Expense.is_verified.is_(False),
        )
        .order_by(Expense.created_at.desc())
        .all()
    )


@router.get("/{expense_id}", response_model=ExpenseOut)
def get_expense(expense: Expense = Depends(get_owned_expense)) -> Expense:
    """Fetch an owned expense."""
    return expense


@router.patch("/{expense_id}", response_model=ExpenseOut)
def update_expense(
    payload: ExpenseUpdate,
    expense: Expense = Depends(get_owned_expense),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Expense:
    """Apply supplied fields to an owned expense."""
    if (
        expense.source == ExpenseSource.ocr
        and expense.ocr_status in {OCRStatus.pending, OCRStatus.processing}
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Wait for OCR processing to finish before editing.",
        )

    updates = payload.model_dump(exclude_unset=True)
    category_id = updates.get("category_id")
    if category_id is not None:
        require_visible_category(category_id, current_user, db)

    for field, value in updates.items():
        setattr(expense, field, value)

    db.commit()
    db.refresh(expense)

    return expense


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense(
    expense: Expense = Depends(get_owned_expense),
    db: Session = Depends(get_db),
) -> None:
    """Delete an owned expense."""
    db.delete(expense)
    db.commit()


@router.post("/receipts", response_model=ReceiptUploadResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_receipt(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReceiptUploadResponse:
    """Store a receipt, create a pending expense, and enqueue OCR."""
    if file.content_type not in ALLOWED_RECEIPT_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Receipt must be a JPEG, PNG, or WebP image.",
        )

    file_bytes = await file.read(settings.receipt_max_upload_bytes + 1)
    if len(file_bytes) > settings.receipt_max_upload_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail="Receipt image exceeds the configured upload limit.",
        )

    try:
        validate_receipt_image(file_bytes)
    except InvalidReceiptImage:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file is not a valid receipt image.",
        ) from None

    try:
        receipt_url = upload_receipt_image(file_bytes, user_id=current_user.id)
    except Exception:
        logger.exception("Receipt upload provider failed", extra={"user_id": current_user.id})
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Receipt storage is temporarily unavailable.",
        ) from None

    # Satisfy non-null fields until OCR provides reviewed values.
    new_expense = Expense(
        user_id=current_user.id,
        amount=Decimal("0.00"),
        currency="INR",
        expense_date=date.today(),
        category_id=None,
        source=ExpenseSource.ocr,
        is_verified=False,
        ocr_status=OCRStatus.pending,
        receipt_url=receipt_url,
    )
    db.add(new_expense)
    db.commit()
    db.refresh(new_expense)

    _enqueue_receipt_or_fail(new_expense, db)

    return ReceiptUploadResponse(expense_id=new_expense.id, ocr_status=new_expense.ocr_status.value)


@router.post(
    "/{expense_id}/retry-ocr",
    response_model=ReceiptUploadResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def retry_receipt_ocr(
    expense: Expense = Depends(get_owned_expense),
    db: Session = Depends(get_db),
) -> ReceiptUploadResponse:
    if expense.source != ExpenseSource.ocr or expense.is_verified:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only unverified OCR expenses can be retried.",
        )
    if expense.ocr_status != OCRStatus.failed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only failed OCR processing can be retried.",
        )

    expense.ocr_status = OCRStatus.pending
    db.commit()
    _enqueue_receipt_or_fail(expense, db)
    return ReceiptUploadResponse(
        expense_id=expense.id,
        ocr_status=expense.ocr_status.value,
    )


def _enqueue_receipt_or_fail(expense: Expense, db: Session) -> None:
    try:
        process_receipt.delay(expense.id)
    except Exception:
        logger.exception(
            "Could not publish OCR task",
            extra={"expense_id": expense.id, "user_id": expense.user_id},
        )
        expense.ocr_status = OCRStatus.failed
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "message": "OCR queue is temporarily unavailable.",
                "expense_id": expense.id,
            },
        ) from None


@router.post("/{expense_id}/confirm", response_model=ExpenseOut)
def confirm_expense(
    expense: Expense = Depends(get_owned_expense),
    db: Session = Depends(get_db),
) -> Expense:
    """Confirm a completed OCR expense after the user reviews required fields."""
    if expense.source != ExpenseSource.ocr:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only OCR expenses can be confirmed.",
        )

    if expense.is_verified:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Expense has already been confirmed.",
        )

    if expense.ocr_status != OCRStatus.completed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="OCR processing must complete before confirmation.",
        )

    if expense.category_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assign a category before confirming this expense.",
        )

    # Zero is the OCR placeholder and must be corrected before confirmation.
    if expense.source == ExpenseSource.ocr and expense.amount == Decimal("0.00"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Enter the correct amount before confirming this expense.",
        )

    expense.is_verified = True
    db.commit()
    db.refresh(expense)

    return expense
