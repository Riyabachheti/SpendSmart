from app.core.database import SessionLocal
from app.models.category import Category

DEFAULT_CATEGORIES = [
    {"name": "Food & Dining", "icon": "utensils"},
    {"name": "Transport", "icon": "car"},
    {"name": "Rent & Housing", "icon": "home"},
    {"name": "Utilities", "icon": "bolt"},
    {"name": "Entertainment", "icon": "movie"},
    {"name": "Shopping", "icon": "bag"},
    {"name": "Healthcare", "icon": "heart"},
    {"name": "Other", "icon": "dots"},
]


def seed() -> None:
    db = SessionLocal()
    try:
        created = 0
        skipped = 0

        for entry in DEFAULT_CATEGORIES:
            # Scope idempotency to system defaults so user categories do not collide.
            existing = (
                db.query(Category)
                .filter(Category.name == entry["name"], Category.user_id.is_(None))
                .first()
            )
            if existing:
                skipped += 1
                continue

            db.add(Category(name=entry["name"], icon=entry["icon"], user_id=None))
            created += 1

        db.commit()
        print(f"Seed complete: {created} created, {skipped} already present.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
