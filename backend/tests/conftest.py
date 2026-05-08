import os
import pytest
import requests
import uuid

BASE_URL = (
    os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    or os.environ.get("EXPO_BACKEND_URL")
    or "https://emerged-academy.preview.emergentagent.com"
).rstrip("/")


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_credentials():
    return {"email": "admin@example.com", "password": "admin123"}


@pytest.fixture(scope="session")
def fresh_user():
    """Generate a unique fresh test user for the session."""
    uniq = uuid.uuid4().hex[:8]
    return {
        "email": f"test_{uniq}@test.com",
        "password": "TestPass123",
        "name": f"Tester_{uniq}",
    }


@pytest.fixture(scope="session")
def registered_user(fresh_user):
    """Register the fresh user once and return creds + tokens."""
    s = requests.Session()
    r = s.post(
        f"{BASE_URL}/api/auth/register",
        json=fresh_user,
        timeout=15,
    )
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    return {
        "email": fresh_user["email"],
        "password": fresh_user["password"],
        "name": fresh_user["name"],
        "id": data["id"],
        "access_token": data["access_token"],
        "session": s,  # has cookies set
    }


@pytest.fixture
def bearer_headers(registered_user):
    return {
        "Authorization": f"Bearer {registered_user['access_token']}",
        "Content-Type": "application/json",
    }
