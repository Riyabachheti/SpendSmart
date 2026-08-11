from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import settings

engine = create_engine(settings.database_url, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency — yields a DB session per request, closes it after."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
#get_db is a custom FastAPI dependency. It creates a SQLAlchemy session using SessionLocal, provides it to an endpoint with yield, and closes it in finally. SessionLocal is configured with the database engine, while Base is the parent class used to define Python models as database tables.
