"""
Brute-force lockout tests for /api/auth/login.
- After 5 failed attempts, returns 429 with detail 'Too many failed attempts'.
- Successful login clears any failed attempts counter.
- login_attempts collection has unique index on identifier.
"""
import os
import uuid
import pytest
import requests

BASE_URL = (
    os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    or os.environ.get("EXPO_BACKEND_URL")
    or "https://emerged-academy.preview.emergentagent.com"
).rstrip("/")


@pytest.fixture
def lockout_user():
    """A fresh user used to test lockout. Email is unique per test invocation."""
    uniq = uuid.uuid4().hex[:8]
    creds = {
        "email": f"lock_{uniq}@test.com",
        "password": "GoodPass123",
        "name": f"Lock_{uniq}",
    }
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/register", json=creds, timeout=15)
    assert r.status_code == 200, r.text
    return creds


class TestLockout:
    def test_lockout_after_5_failed_attempts(self, lockout_user):
        """5 wrong-password attempts should trigger 429 on the 6th."""
        email = lockout_user["email"]
        # 5 wrong attempts -> all 401
        for i in range(5):
            r = requests.post(
                f"{BASE_URL}/api/auth/login",
                json={"email": email, "password": f"wrong-{i}"},
                timeout=15,
            )
            assert r.status_code == 401, (
                f"attempt {i+1}: expected 401, got {r.status_code}: {r.text}"
            )
        # 6th attempt - even with correct password should be 429 (locked)
        r = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": email, "password": lockout_user["password"]},
            timeout=15,
        )
        assert r.status_code == 429, (
            f"expected 429 lockout, got {r.status_code}: {r.text}"
        )
        detail = r.json().get("detail", "")
        assert "too many failed attempts" in detail.lower(), (
            f"unexpected detail: {detail}"
        )

    def test_successful_login_clears_failure_counter(self, lockout_user):
        """4 wrong attempts then a correct login should reset the counter."""
        email = lockout_user["email"]
        # 4 wrong attempts (under threshold)
        for i in range(4):
            r = requests.post(
                f"{BASE_URL}/api/auth/login",
                json={"email": email, "password": f"wrong-{i}"},
                timeout=15,
            )
            assert r.status_code == 401

        # Successful login should clear counter
        ok = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": email, "password": lockout_user["password"]},
            timeout=15,
        )
        assert ok.status_code == 200, ok.text

        # Now do 4 more wrong attempts - should still be 401 (not 429),
        # because counter was reset.
        for i in range(4):
            r = requests.post(
                f"{BASE_URL}/api/auth/login",
                json={"email": email, "password": f"wrong-after-{i}"},
                timeout=15,
            )
            assert r.status_code == 401, (
                f"after reset, attempt {i+1}: expected 401, got {r.status_code}"
            )

    def test_lockout_does_not_affect_other_users(self, lockout_user):
        """Locking out user A should not lock user B."""
        # User A: trigger lockout
        email_a = lockout_user["email"]
        for i in range(5):
            requests.post(
                f"{BASE_URL}/api/auth/login",
                json={"email": email_a, "password": f"wrong-{i}"},
                timeout=15,
            )
        # Confirm A is locked
        r_a = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": email_a, "password": lockout_user["password"]},
            timeout=15,
        )
        assert r_a.status_code == 429

        # User B: fresh registration and login should still work
        uniq = uuid.uuid4().hex[:8]
        creds_b = {
            "email": f"other_{uniq}@test.com",
            "password": "GoodPass123",
            "name": f"Other_{uniq}",
        }
        rb = requests.post(f"{BASE_URL}/api/auth/register", json=creds_b, timeout=15)
        assert rb.status_code == 200
        login_b = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": creds_b["email"], "password": creds_b["password"]},
            timeout=15,
        )
        assert login_b.status_code == 200, login_b.text

    def test_login_attempts_index_unique_on_identifier(self):
        """Verify MongoDB has a unique index on login_attempts.identifier."""
        from pymongo import MongoClient

        mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
        db_name = os.environ.get("DB_NAME", "test_database")
        c = MongoClient(mongo_url)
        try:
            indexes = list(c[db_name].login_attempts.list_indexes())
        finally:
            c.close()
        # Find an index that includes 'identifier' as a key
        ident_idx = [
            idx
            for idx in indexes
            if "identifier" in dict(idx.get("key", {}))
        ]
        assert ident_idx, f"No index on 'identifier'. Indexes: {indexes}"
        assert any(
            idx.get("unique") is True for idx in ident_idx
        ), f"Index on identifier exists but not unique: {ident_idx}"
