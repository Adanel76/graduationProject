import importlib

from conftest import auth_headers


def test_health_endpoint(app_client):
    response = app_client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_manager_can_access_users_and_bookings(app_client, seed_core_data, db_session):
    models = importlib.import_module("app.models")
    client = seed_core_data["client"]
    tour = seed_core_data["tour"]

    booking = models.Booking(
        user_id=client.id,
        tour_id=tour.id,
        people_count=2,
        total_price=20000,
        status="pending",
        payment_status="pending",
    )
    db_session.add(booking)
    db_session.commit()

    headers = auth_headers(app_client, seed_core_data["emails"]["manager"])
    users_response = app_client.get("/users/", headers=headers)
    bookings_response = app_client.get("/bookings/", headers=headers)

    assert users_response.status_code == 200
    assert bookings_response.status_code == 200
    assert any(item["email"] == client.email for item in users_response.json())
    booking_payload = next(item for item in bookings_response.json() if item["id"] == booking.id)
    assert booking_payload["user_email"] == client.email
    assert booking_payload["user_phone"] == client.phone


def test_manager_can_update_booking_status(app_client, seed_core_data, db_session):
    models = importlib.import_module("app.models")
    client = seed_core_data["client"]
    tour = seed_core_data["tour"]

    booking = models.Booking(
        user_id=client.id,
        tour_id=tour.id,
        people_count=1,
        total_price=10000,
        status="pending",
        payment_status="pending",
    )
    db_session.add(booking)
    db_session.commit()
    db_session.refresh(booking)

    headers = auth_headers(app_client, seed_core_data["emails"]["manager"])
    response = app_client.patch(
        f"/bookings/{booking.id}/status",
        json={"status": "confirmed"},
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json()["status"] == "confirmed"


def test_review_requires_confirmed_booking(app_client, seed_core_data):
    headers = auth_headers(app_client, seed_core_data["emails"]["client"])
    response = app_client.post(
        "/reviews/",
        json={"tour_id": seed_core_data["tour"].id, "rating": 5, "comment": "ok"},
        headers=headers,
    )
    assert response.status_code == 403


def test_notification_sets_read_at(app_client, seed_core_data, db_session):
    models = importlib.import_module("app.models")
    notification = models.Notification(
        user_id=seed_core_data["client"].id,
        title="Test",
        message="Message",
        is_read=False,
    )
    db_session.add(notification)
    db_session.commit()
    db_session.refresh(notification)

    headers = auth_headers(app_client, seed_core_data["emails"]["client"])
    response = app_client.patch(f"/notifications/{notification.id}/read", headers=headers)

    assert response.status_code == 200
    assert response.json()["is_read"] is True
    assert response.json()["read_at"] is not None


def test_reports_access_is_restricted(app_client, seed_core_data):
    client_headers = auth_headers(app_client, seed_core_data["emails"]["client"])
    manager_headers = auth_headers(app_client, seed_core_data["emails"]["manager"])

    denied = app_client.get("/reports/users/csv", headers=client_headers)
    allowed = app_client.get("/reports/users/csv", headers=manager_headers)

    assert denied.status_code == 403
    assert allowed.status_code == 200
    assert "text/csv" in allowed.headers["content-type"]


def test_favorites_image_format_is_compatible(app_client, seed_core_data, db_session):
    models = importlib.import_module("app.models")

    tour = seed_core_data["tour"]
    tour.image_data = b"abc"
    tour.image_type = "image/png"
    db_session.add(models.Favorite(user_id=seed_core_data["client"].id, tour_id=tour.id))
    db_session.commit()

    headers = auth_headers(app_client, seed_core_data["emails"]["client"])
    response = app_client.get("/favorites/", headers=headers)

    assert response.status_code == 200
    payload = response.json()
    assert isinstance(payload, list)
    assert len(payload) >= 1


def test_client_can_create_and_submit_custom_tour_plan(app_client, seed_core_data):
    headers = auth_headers(app_client, seed_core_data["emails"]["client"])
    tour = seed_core_data["tour"]
    payload = {
        "title": "Семейный маршрут в Сочи",
        "country": "Россия",
        "people_count": 2,
        "budget": 180000,
        "pace": "balanced",
        "interest": "family",
        "package_type": "all_inclusive",
        "services": {
            "meal_plan": "all_inclusive",
            "hotel_level": "premium",
            "transfer": "individual",
            "insurance": True,
            "guide": True,
            "excursions": True,
            "priority_support": True,
        },
        "route": [
            {
                "order": 1,
                "city": tour.city,
                "tour_id": tour.id,
                "tour_title": tour.title,
                "tour_duration": 3,
                "tour_price": 10000,
                "tour_start_date": tour.start_date.isoformat(),
                "tour_end_date": tour.end_date.isoformat(),
                "customization": "Больше свободного времени и тихий номер",
            }
        ],
        "activities": [
            {
                "title": "Обзорная экскурсия",
                "city": tour.city,
                "activity_type": "Экскурсия",
                "description": "Маршрут по главным достопримечательностям.",
                "source": "tour",
                "source_id": str(tour.id),
                "start_date": tour.start_date.isoformat(),
                "end_date": tour.end_date.isoformat(),
            }
        ],
        "program": [
            {
                "day": 1,
                "city": tour.city,
                "title": "Заезд и знакомство",
                "description": "Трансфер, размещение и прогулка.",
            }
        ],
        "special_requests": "Детское меню",
        "status": "submitted",
    }

    response = app_client.post("/tour-plans/", json=payload, headers=headers)
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["status"] == "submitted"
    assert data["package_type"] == "all_inclusive"
    assert data["base_price"] == 12000
    assert data["services_price"] > 0
    assert data["estimated_total"] == data["base_price"] + data["services_price"]
    assert data["route"][0]["tour_duration"] == 3
    assert data["route"][0]["tour_price"] == 10000
    assert data["route"][0]["tour_start_date"] == tour.start_date.isoformat()
    assert data["route"][0]["customization"] == "Больше свободного времени и тихий номер"
    assert data["activities"][0]["description"] == "Маршрут по главным достопримечательностям."
    assert data["activities"][0]["source"] == "tour"
    assert data["activities"][0]["start_date"].startswith(tour.start_date.isoformat())
    assert data["activities"][0]["end_date"].startswith(tour.end_date.isoformat())
    assert data["user_phone"] == seed_core_data["client"].phone

    plans_response = app_client.get("/tour-plans/", headers=headers)
    assert plans_response.status_code == 200
    assert any(item["id"] == data["id"] for item in plans_response.json())


def test_client_cannot_read_another_users_custom_plan(app_client, seed_core_data, db_session):
    models = importlib.import_module("app.models")
    plan = models.CustomTourPlan(
        user_id=seed_core_data["admin"].id,
        title="Чужой план",
        country="Россия",
        people_count=1,
        pace="balanced",
        interest="culture",
        package_type="standard",
        services_json="{}",
        route_json="[]",
        activities_json="[]",
        program_json="[]",
        base_price=0,
        services_price=0,
        estimated_total=0,
        status="draft",
    )
    db_session.add(plan)
    db_session.commit()
    db_session.refresh(plan)

    headers = auth_headers(app_client, seed_core_data["emails"]["client"])
    response = app_client.get(f"/tour-plans/{plan.id}", headers=headers)
    assert response.status_code == 403


def test_demo_media_urls_are_unique_for_all_seeded_cards():
    demo_seed = importlib.import_module("app.demo_seed")
    urls = [demo_seed.unique_media_image(index) for index in range(140)]

    assert len(urls) == len(set(urls))


def test_semantic_media_catalog_uses_city_specific_images():
    demo_seed = importlib.import_module("app.demo_seed")

    assert demo_seed.city_media_image("Москва") != demo_seed.city_media_image("Каир")
    assert "Pyramids" in demo_seed.CITY_IMAGE_SOURCE_SETS["Каир"][1]
    assert "Hermitage" in demo_seed.CITY_IMAGE_SOURCE_SETS["Санкт-Петербург"][1]
    assert len(demo_seed.city_media_images("Сочи")) >= 4
