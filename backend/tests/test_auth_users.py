import importlib


def test_registration_verification_login_and_current_user(app_client, db_session):
    models = importlib.import_module("app.models")

    email = "new.client@example.com"
    password = "strongPassword123"

    register_response = app_client.post(
        "/users/register",
        json={
            "email": email,
            "password": password,
            "first_name": "Новый",
            "last_name": "Клиент",
            "phone": "+79001112233",
        },
    )

    assert register_response.status_code == 201
    assert register_response.json()["email"] == email

    user = db_session.query(models.User).filter(models.User.email == email).first()
    assert user is not None
    assert user.is_verified is False
    assert user.verification_code

    login_before_verification = app_client.post(
        "/users/login",
        json={"email": email, "password": password},
    )
    assert login_before_verification.status_code == 401

    verify_response = app_client.post(
        "/users/verify-email",
        json={"email": email, "code": user.verification_code},
    )
    assert verify_response.status_code == 200

    login_response = app_client.post("/users/login", json={"email": email, "password": password})
    assert login_response.status_code == 200

    token = login_response.json()["access_token"]
    me_response = app_client.get("/users/me", headers={"Authorization": f"Bearer {token}"})
    assert me_response.status_code == 200
    assert me_response.json()["email"] == email


def test_avatar_upload_validation_and_delete(app_client, seed_core_data):
    from conftest import auth_headers

    headers = auth_headers(app_client, seed_core_data["emails"]["client"])

    invalid = app_client.put(
        "/users/me/avatar",
        json={"avatar_data": "not-base64-image", "avatar_type": "image/png"},
        headers=headers,
    )
    assert invalid.status_code == 400

    valid_avatar = "data:image/png;base64,iVBORw0KGgo="
    updated = app_client.put(
        "/users/me/avatar",
        json={"avatar_data": valid_avatar, "avatar_type": "image/png"},
        headers=headers,
    )
    assert updated.status_code == 200
    assert updated.json()["avatar_data"] == valid_avatar

    deleted = app_client.delete("/users/me/avatar", headers=headers)
    assert deleted.status_code == 200
    assert deleted.json()["avatar_data"] is None


def test_online_count_is_available_only_for_staff(app_client, seed_core_data):
    from conftest import auth_headers

    client_headers = auth_headers(app_client, seed_core_data["emails"]["client"])
    admin_headers = auth_headers(app_client, seed_core_data["emails"]["admin"])

    denied = app_client.get("/users/online-count", headers=client_headers)
    assert denied.status_code == 403

    heartbeat = app_client.post("/users/heartbeat", headers=admin_headers)
    assert heartbeat.status_code == 200

    allowed = app_client.get("/users/online-count?seconds=90", headers=admin_headers)
    assert allowed.status_code == 200
    assert allowed.json()["online_users"] >= 1


def test_admin_can_create_user_and_change_role(app_client, seed_core_data):
    from conftest import auth_headers

    headers = auth_headers(app_client, seed_core_data["emails"]["admin"])

    response = app_client.post(
        "/users/",
        json={
            "email": "created.by.admin@example.com",
            "password": "password123",
            "first_name": "Created",
            "last_name": "User",
            "phone": "+79001234567",
        },
        headers=headers,
    )
    assert response.status_code in {200, 201}
    user_id = response.json()["id"]

    role_response = app_client.patch(
        f"/users/{user_id}/role",
        json={"role": "analyst"},
        headers=headers,
    )
    assert role_response.status_code == 200
    assert role_response.json()["role"] == "analyst"
