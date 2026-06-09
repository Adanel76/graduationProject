from datetime import date, timedelta
import csv
import io
import importlib

from conftest import auth_headers, make_tour_payload


def test_client_cannot_create_tour_but_manager_can(app_client, seed_core_data):
    client_headers = auth_headers(app_client, seed_core_data["emails"]["client"])
    manager_headers = auth_headers(app_client, seed_core_data["emails"]["manager"])

    payload = make_tour_payload(title="Проверка прав доступа")

    denied = app_client.post("/tours/", json=payload, headers=client_headers)
    assert denied.status_code == 403

    created = app_client.post("/tours/", json=payload, headers=manager_headers)
    assert created.status_code == 201
    assert created.json()["title"] == payload["title"]
    assert created.json()["available_seats"] == payload["max_people"]


def test_tour_filters_active_archived_and_export_csv(app_client, seed_core_data, db_session):
    models = importlib.import_module("app.models")
    today = date.today()

    archived = models.Tour(
        title="Архивный тур",
        description="Уже прошёл",
        price=45000,
        duration=4,
        start_date=today - timedelta(days=20),
        end_date=today - timedelta(days=15),
        country="Россия",
        city="Москва",
        max_people=8,
    )
    db_session.add(archived)
    db_session.commit()
    db_session.refresh(archived)

    headers = auth_headers(app_client, seed_core_data["emails"]["manager"])

    active_response = app_client.get("/tours/?include_archived=false&limit=100", headers=headers)
    assert active_response.status_code == 200
    active_titles = {item["title"] for item in active_response.json()}
    assert seed_core_data["tour"].title in active_titles
    assert archived.title not in active_titles

    with_archive_response = app_client.get("/tours/?include_archived=true&limit=100", headers=headers)
    assert with_archive_response.status_code == 200
    with_archive_titles = {item["title"] for item in with_archive_response.json()}
    assert archived.title in with_archive_titles

    export_response = app_client.get("/tours/export-csv?include_archived=true", headers=headers)
    assert export_response.status_code == 200
    assert "text/csv" in export_response.headers["content-type"]
    assert "Тестовый тур" in export_response.text or seed_core_data["tour"].title in export_response.text

    single_export = app_client.get(f"/tours/{seed_core_data['tour'].id}/export-csv", headers=headers)
    assert single_export.status_code == 200
    assert seed_core_data["tour"].title in single_export.text


def test_import_tours_from_csv_and_template_download(app_client, seed_core_data):
    headers = auth_headers(app_client, seed_core_data["emails"]["manager"])

    template_response = app_client.get("/tours/csv-template", headers=headers)
    assert template_response.status_code == 200
    assert "text/csv" in template_response.headers["content-type"]

    future_start = date.today() + timedelta(days=90)
    future_end = future_start + timedelta(days=6)

    csv_content = io.StringIO()
    writer = csv.DictWriter(
        csv_content,
        fieldnames=[
            "title", "description", "price", "duration", "start_date", "end_date",
            "country", "city", "max_people", "program", "accommodation", "meals",
            "activities", "resort_info", "hotel_name", "hotel_address",
            "hotel_map_lat", "hotel_map_lng",
        ],
    )
    writer.writeheader()
    writer.writerow({
        "title": "Импортированный CSV тур",
        "description": "Тур создан из CSV",
        "price": "99000",
        "duration": "6",
        "start_date": future_start.isoformat(),
        "end_date": future_end.isoformat(),
        "country": "Грузия",
        "city": "Тбилиси",
        "max_people": "12",
        "program": "Маршрут",
        "accommodation": "Отель",
        "meals": "Завтраки",
        "activities": "Экскурсии",
        "resort_info": "Информация",
        "hotel_name": "CSV Hotel",
        "hotel_address": "Tbilisi Center",
        "hotel_map_lat": "41.7151",
        "hotel_map_lng": "44.8271",
    })

    upload_response = app_client.post(
        "/tours/import-csv",
        files={"file": ("tours.csv", csv_content.getvalue().encode("utf-8"), "text/csv")},
        headers=headers,
    )

    assert upload_response.status_code == 200
    payload = upload_response.json()
    assert payload["created"] == 1
    assert payload["errors"] == []
    assert len(payload["created_ids"]) == 1

    created_tour = app_client.get(f"/tours/{payload['created_ids'][0]}", headers=headers)
    assert created_tour.status_code == 200
    assert created_tour.json()["title"] == "Импортированный CSV тур"
