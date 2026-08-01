#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$PROJECT_ROOT/spendsmart-backend"
.venv/bin/python << 'PYEOF'
from datetime import date
from decimal import Decimal
from app.core.database import SessionLocal
from app.models.expense import Expense, ExpenseSource, OCRStatus
from app.tasks.receipt_tasks import process_receipt

db = SessionLocal()
test_expense = Expense(
    user_id=3,
    amount=Decimal("0.00"),
    currency="INR",
    expense_date=date.today(),
    source=ExpenseSource.ocr,
    is_verified=False,
    ocr_status=OCRStatus.pending,
    receipt_url="https://res.cloudinary.com/this-does-not-exist/image/upload/nonexistent.jpg",
)
db.add(test_expense)
db.commit()
db.refresh(test_expense)
print("Created expense id:", test_expense.id)
db.close()

process_receipt.delay(test_expense.id)
print("Task enqueued — check the celery worker terminal for the actual exception")
PYEOF
