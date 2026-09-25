import os
import tempfile

import pytest


@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setenv("SECRET_KEY","test-secret-key-123456789")
    monkeypatch.setenv("JWT_SECRET_KEY","test-jwt-secret-123456789")
    with tempfile.TemporaryDirectory() as tmp:
        from aegis_core import initialize_sentinel_platform
        app=initialize_sentinel_platform({
            "TESTING":True,
            "SECRET_KEY":"test-secret-key-123456789",
            "DATABASE_LOCATION":os.path.join(tmp,"test.db"),
        })
        with app.test_client() as client:
            yield client


def test_public_routes(client):
    assert client.get("/").status_code == 200
    assert client.get("/sign-in").status_code == 200
    assert client.get("/sign-up").status_code == 200
    assert client.get("/forgot-password").status_code == 200


def test_signup_login_and_protected_dashboard(client):
    response=client.post("/sign-up",data={
        "display_name":"Test Analyst",
        "work_email":"analyst@example.test",
        "credential":"StrongPass123",
        "confirm_credential":"StrongPass123",
    },follow_redirects=False)
    assert response.status_code == 302

    response=client.post("/sign-in",data={
        "work_email":"analyst@example.test",
        "credential":"StrongPass123",
    },follow_redirects=False)
    assert response.status_code == 302
    assert response.headers["Location"].endswith("/dashboard")

    assert client.get("/dashboard").status_code == 200
    assert client.get("/api/dashboard").status_code == 200


def test_admin_requires_commander(client):
    client.post("/sign-up",data={
        "display_name":"Analyst",
        "work_email":"analyst2@example.test",
        "credential":"StrongPass123",
        "confirm_credential":"StrongPass123",
    })
    client.post("/sign-in",data={
        "work_email":"analyst2@example.test",
        "credential":"StrongPass123",
    })
    assert client.get("/admin").status_code == 302


def test_mitre_catalog_is_real():
    from aegis_core.analytics.mitre_matrix import lookup_technique
    technique=lookup_technique("T1110")
    assert technique is not None
    assert technique.technique_id == "T1110"
