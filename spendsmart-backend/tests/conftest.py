import os
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

# Never let tests read or connect to the real services from .env.
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["SECRET_KEY"] = "test-only-secret-key-that-is-never-deployed"
os.environ["ALLOWED_ORIGINS"] = '["http://localhost:5173","http://testserver"]'
os.environ["REFRESH_COOKIE_SECURE"] = "false"
os.environ["CLOUDINARY_CLOUD_NAME"] = "test"
os.environ["CLOUDINARY_API_KEY"] = "test"
os.environ["CLOUDINARY_API_SECRET"] = "test"
os.environ["REDIS_URL"] = "redis://localhost:6379/15"

from app.core.database import Base, get_db
from app.main import app


@pytest.fixture
def session_factory() -> Generator[sessionmaker[Session]]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def enable_foreign_keys(dbapi_connection, _connection_record) -> None:
        dbapi_connection.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    try:
        yield factory
    finally:
        Base.metadata.drop_all(engine)
        engine.dispose()


@pytest.fixture
def client(
    session_factory: sessionmaker[Session],
) -> Generator[TestClient]:
    def override_get_db() -> Generator[Session]:
        db = session_factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
