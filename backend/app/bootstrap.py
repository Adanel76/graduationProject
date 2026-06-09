from sqlalchemy import inspect, text

from . import models
from .config import settings
from .database import SessionLocal, engine
from .seed import seed_demo_data, seed_reference_data


def _sql_type(sqlite_type: str, postgres_type: str | None = None) -> str:
    """Return a portable column type for local SQLite and PostgreSQL.

    PostgreSQL does not support SQLite's DATETIME name in raw ALTER TABLE
    statements, so schema patches must use TIMESTAMP there.
    """
    if engine.dialect.name == "postgresql":
        return postgres_type or sqlite_type
    return sqlite_type


def ensure_schema_updates():
    """Small idempotent schema updates for local PostgreSQL development."""
    inspector = inspect(engine)

    table_names = inspector.get_table_names()

    statements = []

    if "users" in table_names:
        user_columns = {column["name"] for column in inspector.get_columns("users")}
        if "avatar_data" not in user_columns:
            statements.append("ALTER TABLE users ADD COLUMN avatar_data TEXT")
        if "avatar_type" not in user_columns:
            statements.append("ALTER TABLE users ADD COLUMN avatar_type VARCHAR(80)")
        if "last_seen_at" not in user_columns:
            statements.append(f"ALTER TABLE users ADD COLUMN last_seen_at {_sql_type('DATETIME', 'TIMESTAMP')}")

    if "tours" not in table_names:
        if statements:
            with engine.begin() as connection:
                for statement in statements:
                    connection.execute(text(statement))
        return

    columns = {column["name"] for column in inspector.get_columns("tours")}

    if "meals_features" not in columns:
        statements.append("ALTER TABLE tours ADD COLUMN meals_features TEXT")
    if "activities_features" not in columns:
        statements.append("ALTER TABLE tours ADD COLUMN activities_features TEXT")
    if "resort_features" not in columns:
        statements.append("ALTER TABLE tours ADD COLUMN resort_features TEXT")
    if "hotel_name" not in columns:
        statements.append("ALTER TABLE tours ADD COLUMN hotel_name VARCHAR(255)")
    if "hotel_address" not in columns:
        statements.append("ALTER TABLE tours ADD COLUMN hotel_address TEXT")
    if "hotel_description" not in columns:
        statements.append("ALTER TABLE tours ADD COLUMN hotel_description TEXT")
    if "hotel_features" not in columns:
        statements.append("ALTER TABLE tours ADD COLUMN hotel_features TEXT")
    if "hotel_map_lat" not in columns:
        statements.append("ALTER TABLE tours ADD COLUMN hotel_map_lat DOUBLE PRECISION")
    if "hotel_map_lng" not in columns:
        statements.append("ALTER TABLE tours ADD COLUMN hotel_map_lng DOUBLE PRECISION")
    if "hotel_map_zoom" not in columns:
        statements.append("ALTER TABLE tours ADD COLUMN hotel_map_zoom INTEGER DEFAULT 15")
    if "map_lat" not in columns:
        statements.append("ALTER TABLE tours ADD COLUMN map_lat DOUBLE PRECISION")
    if "map_lng" not in columns:
        statements.append("ALTER TABLE tours ADD COLUMN map_lng DOUBLE PRECISION")
    if "map_zoom" not in columns:
        statements.append("ALTER TABLE tours ADD COLUMN map_zoom INTEGER DEFAULT 12")

    if not statements:
        return

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


def bootstrap_application():
    if settings.auto_create_tables:
        models.Base.metadata.create_all(bind=engine)
        ensure_schema_updates()

    db = SessionLocal()
    try:
        if settings.auto_seed_reference_data:
            seed_reference_data(db)
        if settings.auto_seed_demo_data:
            seed_demo_data(db)
    finally:
        db.close()
