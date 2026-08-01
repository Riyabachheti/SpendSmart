from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.analytics import router as analytics_router
from app.api.auth import router as auth_router
from app.api.budgets import router as budgets_router
from app.api.categories import router as categories_router
from app.api.expenses import router as expenses_router
from app.core.config import settings
from app.core.database import get_db

app = FastAPI(title="SpendSmart API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth_router)
app.include_router(analytics_router)
app.include_router(categories_router)
app.include_router(expenses_router)
app.include_router(budgets_router)


@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {e!s}"
    return {"status": "ok", "database": db_status}


@app.get("/")
def root():
    return {"message": "SpendSmart API is running"}
