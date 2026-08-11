# SpendSmart

SpendSmart is a full-stack expense tracker for recording everyday spending,
reviewing scanned receipts, setting monthly budgets, and understanding spending
patterns. Receipt processing can run through a background worker or inline,
depending on the environment, and extracted values must be reviewed before they
become verified expenses.

## Why I built it

Managing money as a student can be difficult when frequent small and impulsive
purchases make it unclear where the monthly budget went.

I created SpendSmart after noticing this pattern in my own college life. I
wanted a simple way to record expenses, understand my spending habits, and make
more deliberate financial decisions. What began as a personal solution became
a full-stack project combining expense analytics, budgeting, and receipt
scanning.

**Live demo:** [spendsmart.grayriver-0e56e56b.centralindia.azurecontainerapps.io](https://spendsmart.grayriver-0e56e56b.centralindia.azurecontainerapps.io)

## Preview

### Dashboard

![SpendSmart analytics dashboard](docs/screenshots/dashboard.png)

### Receipt OCR review

![Reviewing details extracted from a receipt](docs/screenshots/receipt-review.png)

### Landing page

![SpendSmart landing page](docs/screenshots/landing.png)

## Features

- Secure registration and login with short-lived access tokens and rotating
  HttpOnly refresh cookies
- Expense creation, editing, filtering, pagination, and deletion
- Shared default categories and user-defined custom categories
- Overall and category-specific monthly budgets
- Category breakdowns, spending trends, and budget-versus-actual analytics
- Receipt upload, Tesseract OCR, and a review step before expense creation
- Responsive interface with accessible charts and light/dark themes

## Technology

| Area | Tools |
| --- | --- |
| Frontend | React, TypeScript, Vite, Tailwind CSS, TanStack Query, Recharts |
| Backend | FastAPI, Pydantic, SQLAlchemy, Alembic |
| Data | PostgreSQL, Redis |
| Receipt processing | Celery, Tesseract, Pillow, Cloudinary |
| Testing | Pytest, Vitest, Testing Library, MSW, Ruff, Oxlint |
| Deployment | Docker, GitHub Actions, GitHub Container Registry, Azure Container Apps |

## Local setup

### Requirements

- Python 3.13
- Node.js 20 or newer
- PostgreSQL
- Redis
- Tesseract OCR
- A Cloudinary account for receipt uploads

### Backend

```bash
cd spendsmart-backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
```

Create the PostgreSQL database, then update `.env` with its connection string,
a secret key, and your Cloudinary settings. Apply the migrations and seed the
default categories:

```bash
alembic upgrade head
python -m scripts.seed_categories
```

Start the API:

```bash
python -m uvicorn app.main:app --reload
```

For receipt processing, run Redis and start a Celery worker in another terminal:

```bash
.venv/bin/python -m celery -A app.core.celery_app.celery_app worker --pool=solo --loglevel=INFO
```

The API is available at `http://localhost:8000/api`, with interactive
documentation at `http://localhost:8000/api/docs`.

### Frontend

```bash
cd spendsmart-frontend
npm ci
cp .env.example .env
npm run dev
```

Open `http://localhost:5173`.

## Azure deployment

The live demo uses a single, same-origin Docker container on Azure Container
Apps. It serves the compiled React application and exposes FastAPI under
`/api`; Neon stores production data and Cloudinary stores receipt images. OCR
runs inline in this deployment, so it does not require a separate Celery worker
or Redis service.

GitHub Actions builds the container image from `Dockerfile` and publishes it to
GitHub Container Registry as `ghcr.io/riyabachheti/spendsmart`. Azure pulls the
public image from that registry, avoiding a continuously billed Azure Container
Registry for this student deployment. The app scales from zero to one replica
to limit credit usage, so the first request after an idle period can be slower.

After a new image is built, deploy its immutable commit tag rather than reusing
`latest`:

```bash
az containerapp update \
  --name spendsmart \
  --resource-group spendsmart-rg \
  --image ghcr.io/riyabachheti/spendsmart:<commit-sha>
```

Runtime credentials are configured as Azure Container Apps secrets and are
never stored in this repository.

## Tests and checks

Backend:

```bash
cd spendsmart-backend
.venv/bin/python -m pytest
.venv/bin/python -m ruff check app tests scripts
```

Frontend:

```bash
cd spendsmart-frontend
npm test
npm run lint
npm run build
```

The backend tests use an isolated SQLite database and do not connect to the
development database.

## Known limitations

- OCR results depend on receipt layout and image quality, so every scanned
  receipt requires user review.
- Budget-status analytics currently use INR only.
- Local asynchronous receipt processing requires Redis and a Celery worker;
  the Azure demo runs OCR inline and may process large images slowly.
- The Azure demo can have a cold start after scaling to zero, and its Neon,
  Cloudinary, and Azure usage is limited by student or free-tier allowances.
- The frontend is a client-rendered application and does not provide offline
  support or bank-account synchronization.

The current React Router advisory assessment and compensating controls are
documented in
[spendsmart-frontend/docs/SECURITY_EXCEPTIONS.md](spendsmart-frontend/docs/SECURITY_EXCEPTIONS.md).
