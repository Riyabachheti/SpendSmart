# SpendSmart frontend API contract

This contract supersedes the legacy examples that placed access and refresh
tokens in `localStorage`.

## Authentication

- All Axios requests use `withCredentials: true`.
- `POST /auth/login` returns `{access_token, token_type}` and sets the refresh
  token as an HttpOnly cookie.
- Keep the access token in React memory, not `localStorage`.
- `POST /auth/refresh` has no request body. It rotates the refresh cookie and
  returns a new access token.
- Only one refresh request may run at a time. Queue other failed requests until
  it completes because replaying a rotated token revokes its session family.
- `POST /auth/logout` clears the current refresh session.
- `POST /auth/logout-all` also requires the current access token and revokes
  every refresh session for the user.

## Expenses

`GET /expenses` returns:

```json
{
  "items": [],
  "total": 0,
  "skip": 0,
  "limit": 50,
  "has_more": false
}
```

Supported filters are `category_id`, `start_date`, `end_date`, `source`,
`skip`, and `limit`. Results are ordered by expense date and ID, newest first.

## Categories

- `GET /categories`
- `POST /categories`
- `PATCH /categories/{category_id}` with any of `name` or `icon`
- `DELETE /categories/{category_id}`

System categories are readable but cannot be edited or deleted.

## Analytics

- `GET /analytics/summary?month=7&year=2026&currency=INR`
- `GET /analytics/trend?months=6&end_month=7&end_year=2026&currency=INR`
- `GET /analytics/budget-status?month=7&year=2026`

Only verified expenses are aggregated. Summary and trend never combine
different currencies. Budgets currently represent INR, so budget status
compares only INR expenses.

## OCR workflow

1. Upload JPEG, PNG, or WebP multipart data to `POST /expenses/receipts`.
2. Receive `202` with `{expense_id, ocr_status}`.
3. Poll `GET /expenses/{expense_id}` while status is `pending` or `processing`.
4. When `completed`, let the user correct fields with
   `PATCH /expenses/{expense_id}`.
5. Confirm with `POST /expenses/{expense_id}/confirm`.
6. If status is `failed`, retry with `POST /expenses/{expense_id}/retry-ocr`.

Pending OCR expenses legitimately return amount `"0.00"`. They are excluded
from analytics until the user confirms them.

Local development requires three processes:

```bash
uvicorn app.main:app --reload
python -m celery -A app.core.celery_app.celery_app worker --pool=solo --loglevel=INFO
npm run dev
```
