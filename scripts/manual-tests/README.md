# Manual integration tests

These scripts exercise a locally running SpendSmart stack through its HTTP API.
They are intended for development smoke testing and may create or modify records
in the configured development database.

## Prerequisites

- The FastAPI service is available at `http://localhost:8000`.
- PostgreSQL is running and the development database has been migrated.
- Redis and a Celery worker are running for receipt-processing scenarios.
- The test accounts and credentials referenced by each script are safe to use
  in the local development environment.
- `curl`, Python 3, and `jq` are installed where required.

Run a scenario from any working directory, for example:

```bash
./scripts/manual-tests/receipt_upload_test.sh
```

Automated backend coverage remains in `spendsmart-backend/tests/`; these scripts
are only for end-to-end checks against live local services.
