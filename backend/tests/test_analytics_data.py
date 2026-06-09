from datetime import datetime, timedelta
import importlib

from conftest import auth_headers


def test_analytics_dashboard_contains_ml_and_quality_blocks(app_client, seed_core_data, db_session):
    models = importlib.import_module("app.models")
    client = seed_core_data["client"]
    tour = seed_core_data["tour"]

    for index in range(12):
        booking = models.Booking(
            user_id=client.id,
            tour_id=tour.id,
            people_count=1 + (index % 3),
            total_price=10000 * (1 + (index % 3)),
            status="confirmed" if index % 4 else "cancelled",
            payment_status="paid" if index % 4 else "refunded",
            payment_method="card",
            booking_date=datetime.utcnow() - timedelta(days=index),
        )
        db_session.add(booking)

    db_session.commit()

    headers = auth_headers(app_client, seed_core_data["emails"]["analyst"])
    response = app_client.get("/analytics/dashboard", headers=headers)

    assert response.status_code == 200
    payload = response.json()
    assert payload["overview"]["total_bookings"] >= 12
    assert "ml_assistant" in payload
    assert payload["ml_assistant"]["model_type"].startswith("supervised_regression")
    assert payload["ml_assistant"]["model_version"] == "metricbot-local-v2"
    assert isinstance(payload["ml_assistant"]["accuracy_metrics"], list)
    assert isinstance(payload["ml_assistant"]["feature_importance"], list)
    assert isinstance(payload["data_quality"], list)
    assert isinstance(payload["conversion_funnel"], list)
    assert isinstance(payload["weekday_demand"], list)


def test_analytics_overview_is_lightweight_and_available_to_staff(app_client, seed_core_data):
    for role in ("admin", "manager", "analyst"):
        headers = auth_headers(app_client, seed_core_data["emails"][role])
        response = app_client.get("/analytics/overview", headers=headers)

        assert response.status_code == 200
        payload = response.json()
        assert payload["total_users"] >= 4
        assert payload["total_tours"] >= 1
        assert "total_bookings" in payload
        assert "reviews_count" in payload

    client_headers = auth_headers(app_client, seed_core_data["emails"]["client"])
    denied = app_client.get("/analytics/overview", headers=client_headers)
    assert denied.status_code == 403


def test_ml_assistant_training_endpoint_is_staff_only(app_client, seed_core_data, db_session):
    client_headers = auth_headers(app_client, seed_core_data["emails"]["client"])
    analyst_headers = auth_headers(app_client, seed_core_data["emails"]["analyst"])

    denied = app_client.post("/analytics/ml-assistant/train", headers=client_headers)
    assert denied.status_code == 403

    allowed = app_client.post("/analytics/ml-assistant/train", headers=analyst_headers)
    assert allowed.status_code == 200
    assert allowed.json()["model_type"].startswith("supervised_regression")
    assert allowed.json()["model_version"] == "metricbot-local-v2"


def test_csv_data_control_upload_preview_download_delete(app_client, seed_core_data):
    analyst_headers = auth_headers(app_client, seed_core_data["emails"]["analyst"])
    client_headers = auth_headers(app_client, seed_core_data["emails"]["client"])

    denied = app_client.get("/data-control/csv", headers=client_headers)
    assert denied.status_code == 403

    upload = app_client.post(
        "/data-control/csv",
        params={"dataset_type": "bookings"},
        files={"file": ("metrics.csv", b"date,value\n2026-01-01,10\n2026-01-02,15\n", "text/csv")},
        headers=analyst_headers,
    )
    assert upload.status_code == 200
    dataset_id = upload.json()["meta"]["id"]
    assert upload.json()["meta"]["rows_count"] == 2
    assert upload.json()["sample_rows"][0]["date"] == "2026-01-01"

    preview = app_client.get(f"/data-control/csv/{dataset_id}/preview", headers=analyst_headers)
    assert preview.status_code == 200
    assert preview.json()["meta"]["columns"] == ["date", "value"]

    download = app_client.get(f"/data-control/csv/{dataset_id}/download", headers=analyst_headers)
    assert download.status_code == 200
    assert "date,value" in download.text

    delete = app_client.delete(f"/data-control/csv/{dataset_id}", headers=analyst_headers)
    assert delete.status_code == 200
    assert delete.json()["message"] == "CSV-набор удалён"
