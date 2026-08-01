"""Best-effort extraction of receipt fields from OCR text."""

import re
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

# Word boundaries exclude "subtotal"; the optional decimal supports totals
# printed without paise.
_TOTAL_LINE_PATTERN = re.compile(
    r"\b(?:total|amount due|balance due)\b[^\d\n]*(\d+(?:\.\d{1,2})?)",
    re.IGNORECASE,
)

# Without a total label, require a decimal point to avoid treating IDs,
# timestamps, or item counts as money.
_ANY_AMOUNT_PATTERN = re.compile(r"\$?\s*(\d+\.\d{2})")

# Check four-digit month-name years before two-digit years to prevent partial
# matches such as reading "2026" as "20".
_DATE_PATTERNS = [
    (re.compile(r"(\d{1,2})/(\d{1,2})/(\d{4})"), "%m/%d/%Y"),
    (re.compile(r"(\d{1,2})-(\d{1,2})-(\d{4})"), "%m-%d-%Y"),
    (re.compile(r"(\d{4})-(\d{1,2})-(\d{1,2})"), "%Y-%m-%d"),
    (re.compile(r"\d{1,2}-[A-Za-z]{3}-\d{4}", re.IGNORECASE), "%d-%b-%Y"),
    (re.compile(r"\d{1,2}-[A-Za-z]{3}-\d{2}\b", re.IGNORECASE), "%d-%b-%y"),
]


def extract_amount(raw_text: str) -> Decimal | None:
    """Extract the last labeled total, or the largest decimal amount."""
    matches = list(_TOTAL_LINE_PATTERN.finditer(raw_text))
    if matches:
        return _safe_decimal(matches[-1].group(1))

    all_amounts = _ANY_AMOUNT_PATTERN.findall(raw_text)
    if not all_amounts:
        return None

    decimals = [_safe_decimal(a) for a in all_amounts]
    decimals = [d for d in decimals if d is not None]
    return max(decimals) if decimals else None


def extract_date(raw_text: str) -> date | None:
    """Try each known date format in turn; return the first match."""
    for pattern, fmt in _DATE_PATTERNS:
        match = pattern.search(raw_text)
        if match:
            try:
                return datetime.strptime(match.group(0), fmt).date()
            except ValueError:
                continue  # e.g. matched digits that aren't a real date
    return None


def extract_merchant_name(raw_text: str) -> str | None:
    """Use the first non-empty line as the merchant-name candidate."""
    for line in raw_text.splitlines():
        stripped = line.strip()
        if stripped:
            return stripped
    return None


def _safe_decimal(value: str) -> Decimal | None:
    try:
        return Decimal(value)
    except InvalidOperation:
        return None


def parse_receipt(raw_text: str) -> dict:
    """Return parsed fields; missing values remain ``None`` for user review."""
    return {
        "amount": extract_amount(raw_text),
        "expense_date": extract_date(raw_text),
        "merchant_name": extract_merchant_name(raw_text),
    }
