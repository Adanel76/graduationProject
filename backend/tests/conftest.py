import importlib
import os
import sys
import uuid
from datetime import date, timedelta
from pathlib import Path

import pytest

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


@pytest.fixture(scope="session")
def app_client(tmp_path_factory):
    db_dir = tmp_path_factory.mktemp("db")
    db_path = db_dir / "test.db"
    storage_dir = tmp_path_factory.mktemp("storage")

    os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"
    os.environ["AUTO_CREATE_TABLES"] = "true"
    os.environ["AUTO_SEED_REFERENCE_DATA"] = "true"
    os.environ["AUTO_SEED_DEMO_DATA"] = "false"
    os.environ["EMAIL_ENABLED"] = "false"
    os.environ["SECRET_KEY"] = "test-secret"
    os.environ["APP_BASE_URL"] = "http://localhost:3000"
    os.environ["TEST_STORAGE_DIR"] = str(storage_dir)
    os.environ["CSV_STORAGE_DIR"] = str(storage_dir / "csv_datasets")

    for name in list(sys.modules):
        if name.startswith("app"):
            del sys.modules[name]

    from fastapi.testclient import TestClient

    main = importlib.import_module("app.main")
    return TestClient(main.app)


@pytest.fixture()
def db_session(app_client):
    database = importlib.import_module("app.database")
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture()
def seed_core_data(db_session):
    models = importlib.import_module("app.models")
    auth = importlib.import_module("app.auth")

    suffix = uuid.uuid4().hex[:8]
    password = "password123"

    def make_user(role, verified=True, **extra):
        email = f"{role}.{suffix}@example.com"
        user = models.User(
            email=email,
            password_hash=auth.get_password_hash(password),
            role=role,
            is_verified=verified,
            first_name=extra.get("first_name", role.title()),
            last_name=extra.get("last_name", "User"),
            phone=extra.get("phone", "+79000000000"),
        )
        db_session.add(user)
        return user

    admin = make_user("admin", first_name="Admin")
    manager = make_user("manager", first_name="Manager")
    analyst = make_user("analyst", first_name="Analyst")
    client = make_user("client", first_name="Test", last_name="Client")

    future_start = date.today() + timedelta(days=30)
    tour = models.Tour(
        title=f"Тестовый тур {suffix}",
        description="Описание тестового тура",
        price=10000,
        duration=5,
        start_date=future_start,
        end_date=future_start + timedelta(days=5),
        country="Россия",
        city="Сочи",
        max_people=10,
        hotel_name="Demo Hotel",
        hotel_address="Сочи, Морская 1",
        hotel_map_lat=43.5855,
        hotel_map_lng=39.7231,
        meals="Завтрак",
        activities="Экскурсии",
        resort_info="Курортная информация",
    )

    db_session.add(tour)
    db_session.commit()

    for obj in [admin, manager, analyst, client, tour]:
        db_session.refresh(obj)

    return {
        "password": password,
        "admin": admin,
        "manager": manager,
        "analyst": analyst,
        "client": client,
        "tour": tour,
        "emails": {
            "admin": admin.email,
            "manager": manager.email,
            "analyst": analyst.email,
            "client": client.email,
        },
    }


def auth_headers(app_client, email, password="password123"):
    response = app_client.post("/users/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def make_tour_payload(**overrides):
    future_start = date.today() + timedelta(days=45)
    payload = {
        "title": "CSV-тест тур",
        "description": "Описание тура",
        "price": 75000,
        "duration": 7,
        "start_date": future_start.isoformat(),
        "end_date": (future_start + timedelta(days=7)).isoformat(),
        "country": "Россия",
        "city": "Казань",
        "max_people": 14,
        "program": "Программа тура",
        "accommodation": "Отель 4*",
        "meals": "Завтраки",
        "activities": "Экскурсии",
        "hotel_name": "Kazan Palace",
        "hotel_address": "Казань, центр",
        "hotel_map_lat": 55.7961,
        "hotel_map_lng": 49.1064,
    }
    payload.update(overrides)
    return payload
