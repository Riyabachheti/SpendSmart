# SpendSmart frontend

SpendSmart is a editorial expense tracker for recording everyday spending,
reviewing receipt scans, organizing categories, and setting monthly budgets.

## Requirements

- Node.js 20 or newer (verified with Node.js 24)
- npm 11 or newer
- The SpendSmart API, PostgreSQL, and Redis
- A Celery worker and Tesseract for live receipt OCR

The frontend is a React 19 and TypeScript application built with Vite. React
Router handles navigation and TanStack Query owns server-state caching.

## Local setup

Install the frontend dependencies:

```bash
cd spendsmart-frontend
npm install
```

Copy the example environment file if `.env` does not already exist:

```bash
cp .env.example .env
```

The frontend expects this variable:

```dotenv
VITE_API_BASE_URL=http://localhost:8000
```

Start the API from `spendsmart-backend`:

```bash
.venv/bin/python -m uvicorn app.main:app --reload
```

For receipt processing, also start Redis and the Celery worker:

```bash
.venv/bin/python -m celery -A app.core.celery_app.celery_app worker --pool=solo --loglevel=INFO
```

Then start the frontend:

```bash
npm run dev
```

Use `http://localhost:5173` during local development so the origin matches the
backend CORS and refresh-cookie configuration.

## Authentication boundary

- The access token exists only in JavaScript memory.
- The refresh token is an HttpOnly cookie owned by the API.
- Axios sends credentialed requests and allows only one refresh request at a
  time.
- Logout, session expiry, and account changes clear private TanStack Query data.
- Access and refresh tokens must not be placed in `localStorage` or
  `sessionStorage`.

The complete endpoint contract is in
`../spendsmart-backend/docs/FRONTEND_API_CONTRACT.md`.

## Verification

Run the frontend release gates:

```bash
npx tsc -b
npm run lint
npm run build
npm audit
```

Run the isolated backend tests without changing backend data:

```bash
cd ../spendsmart-backend
.venv/bin/python -m pytest
.venv/bin/ruff check app tests
```

The backend test suite uses an in-memory SQLite database and does not connect to
the development database.

## Security notes

React Router is deliberately pinned while an RSC-only advisory lacks a patched
stable release. SpendSmart is a client-rendered SPA and does not enable React
Server Components or router server actions. Do not run `npm audit fix --force`:
the proposed downgrade restores older client-facing router vulnerabilities.

See [docs/SECURITY_EXCEPTIONS.md](docs/SECURITY_EXCEPTIONS.md) for the temporary
exception, compensating controls, and review deadline.

## Production checklist

- Serve the generated `dist/` directory behind HTTPS with SPA fallback routing.
- Set the production API URL at build time.
- Restrict backend CORS to the deployed frontend origin.
- Enable secure refresh cookies.
- Run PostgreSQL, Redis, Celery, Tesseract, and Cloudinary configuration.
- Run the verification commands and a real receipt OCR flow in staging before
  release.
