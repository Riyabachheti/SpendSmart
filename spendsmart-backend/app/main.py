import logging
from pathlib import Path

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.analytics import router as analytics_router
from app.api.auth import router as auth_router
from app.api.budgets import router as budgets_router
from app.api.categories import router as categories_router
from app.api.expenses import router as expenses_router
from app.core.config import settings
from app.core.database import get_db

logger = logging.getLogger(__name__)

# Keep the API as a standalone sub-application. Tests can exercise it directly,
# while production mounts it below /api beside the compiled React application.
api_app = FastAPI(title="SpendSmart API", version="0.1.0")

api_app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

api_app.include_router(auth_router)
api_app.include_router(analytics_router)
api_app.include_router(categories_router)
api_app.include_router(expenses_router)
api_app.include_router(budgets_router)


@api_app.get("/health")
def health_check(db: Session = Depends(get_db)):
    """Report readiness only when the external database is reachable."""
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        logger.exception("Database health check failed")
        return JSONResponse(
            status_code=503,
            content={"status": "degraded", "database": "unavailable"},
        )
    return {"status": "ok", "database": "connected"}


@api_app.get("/")
def api_root():
    return {"message": "SpendSmart API is running"}


app = FastAPI(
    title="SpendSmart",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)
app.mount("/api", api_app)

PACKAGED_FRONTEND_DIST = Path(__file__).resolve().parents[1] / "frontend-dist"
LOCAL_FRONTEND_DIST = Path(__file__).resolve().parents[2] / "spendsmart-frontend" / "dist"
FRONTEND_DIST = (
    PACKAGED_FRONTEND_DIST
    if PACKAGED_FRONTEND_DIST.is_dir()
    else LOCAL_FRONTEND_DIST
)


if FRONTEND_DIST.is_dir():

    @app.get("/{requested_path:path}", include_in_schema=False)
    def serve_frontend(requested_path: str):
        """Serve built assets and fall back to the SPA entry point for deep links."""
        candidate = (FRONTEND_DIST / requested_path).resolve()
        if candidate.is_relative_to(FRONTEND_DIST.resolve()) and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(FRONTEND_DIST / "index.html")

else:

    @app.get("/", include_in_schema=False)
    def development_root():
        return {
            "message": "SpendSmart API is running; use /api or start the Vite development server."
        }
