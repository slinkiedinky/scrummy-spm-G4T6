import os
import sys
from datetime import datetime, timezone

import pytest

# Ensure the back-end folder is on the import path
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from app import app as flask_app  # noqa: E402
import users  # noqa: E402
from fake_firestore import FakeFirestore  # noqa: E402


@pytest.fixture
def test_client(monkeypatch):
    """Set up test client with fake Firestore"""
    fake_db = FakeFirestore()
    monkeypatch.setattr(users, "db", fake_db)

    flask_app.config.update(TESTING=True)
    with flask_app.test_client() as client:
        yield client, fake_db


class TestUserCreation:
    def test_create_user_success(self, test_client):
        """Test creating a new user"""
        client, fake_db = test_client

        payload = {
            "fullName": "John Doe",
            "email": "john@example.com",
            "role": "developer",
        }

        resp = client.post("/api/users/", json=payload)
        assert resp.status_code == 201
        data = resp.get_json()
        assert "id" in data
        assert data["message"] == "User created"

        # Verify user was stored
        user_id = data["id"]
        doc = fake_db.collection("users").document(user_id).get()
        assert doc.exists
        stored = doc.to_dict()
        assert stored["fullName"] == "John Doe"
        assert stored["email"] == "john@example.com"
        assert stored["role"] == "developer"

    def test_create_user_minimal_data(self, test_client):
        """Test creating a user with minimal data"""
        client, fake_db = test_client

        payload = {
            "email": "minimal@example.com",
        }

        resp = client.post("/api/users/", json=payload)
        assert resp.status_code == 201
        assert "id" in resp.get_json()


class TestUserRetrieval:
    def test_get_all_users(self, test_client):
        """Test retrieving all users"""
        client, fake_db = test_client

        # Add test users
        users_col = fake_db.collection("users")
        users_col.document("user-1").set({
            "fullName": "Alice Smith",
            "email": "alice@example.com",
            "role": "admin",
            "status": "active",
            "priority": "high"
        })
        users_col.document("user-2").set({
            "fullName": "Bob Jones",
            "email": "bob@example.com",
            "role": "developer",
            "status": "new",
            "priority": "medium"
        })

        resp = client.get("/api/users/")
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data) == 2

        # Check normalization
        user_ids = {user["id"] for user in data}
        assert "user-1" in user_ids
        assert "user-2" in user_ids

        # Check fields are normalized
        for user in data:
            assert "status" in user
            assert "priority" in user
            assert "collaboratorsIds" in user
            assert "tags" in user

    def test_get_single_user_success(self, test_client):
        """Test retrieving a specific user"""
        client, fake_db = test_client

        fake_db.collection("users").document("user-123").set({
            "fullName": "Test User",
            "email": "test@example.com",
            "role": "tester",
            "status": "active",
            "priority": "medium"
        })

        resp = client.get("/api/users/user-123")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["id"] == "user-123"
        assert data["fullName"] == "Test User"
        assert data["email"] == "test@example.com"
        assert data["status"] == "active"

    def test_get_single_user_not_found(self, test_client):
        """Test retrieving a non-existent user"""
        client, fake_db = test_client

        resp = client.get("/api/users/non-existent")
        assert resp.status_code == 404
        assert resp.get_json()["error"] == "Not found"


class TestUserUpdate:
    def test_update_user_success(self, test_client):
        """Test updating an existing user"""
        client, fake_db = test_client

        # Create user first
        user_ref = fake_db.collection("users").document("user-update")
        user_ref.set({
            "fullName": "Original Name",
            "email": "original@example.com",
            "role": "developer",
        })

        # Update user
        patch = {
            "fullName": "Updated Name",
            "role": "admin",
        }
        resp = client.put("/api/users/user-update", json=patch)
        assert resp.status_code == 200
        assert resp.get_json()["message"] == "User updated"

        # Verify update
        updated = user_ref.get().to_dict()
        assert updated["fullName"] == "Updated Name"
        assert updated["role"] == "admin"
        assert updated["email"] == "original@example.com"  # unchanged

    def test_update_user_partial(self, test_client):
        """Test partial update of user"""
        client, fake_db = test_client

        user_ref = fake_db.collection("users").document("user-partial")
        user_ref.set({
            "fullName": "Test User",
            "email": "test@example.com",
            "role": "developer",
            "status": "active",
        })

        # Update only role
        resp = client.put("/api/users/user-partial", json={"role": "manager"})
        assert resp.status_code == 200

        updated = user_ref.get().to_dict()
        assert updated["role"] == "manager"
        assert updated["fullName"] == "Test User"
        assert updated["status"] == "active"


class TestUserDeletion:
    def test_delete_user_success(self, test_client):
        """Test deleting a user"""
        client, fake_db = test_client

        # Create user
        fake_db.collection("users").document("user-delete").set({
            "fullName": "To Delete",
            "email": "delete@example.com",
        })

        # Delete user
        resp = client.delete("/api/users/user-delete")
        assert resp.status_code == 200
        assert resp.get_json()["message"] == "User deleted"

        # Verify deletion
        doc = fake_db.collection("users").document("user-delete").get()
        assert not doc.exists

    def test_delete_non_existent_user(self, test_client):
        """Test deleting a non-existent user (should succeed silently)"""
        client, fake_db = test_client

        resp = client.delete("/api/users/non-existent")
        assert resp.status_code == 200


class TestUserNormalization:
    def test_normalize_user_with_dates(self, test_client):
        """Test that dates are properly serialized"""
        client, fake_db = test_client

        fake_db.collection("users").document("user-dates").set({
            "fullName": "Date Test",
            "createdAt": datetime(2024, 1, 1, tzinfo=timezone.utc),
            "updatedAt": datetime(2024, 1, 15, tzinfo=timezone.utc),
            "status": "Active",
            "priority": "HIGH",
        })

        resp = client.get("/api/users/user-dates")
        assert resp.status_code == 200
        data = resp.get_json()

        # Dates should be ISO formatted
        assert "createdAt" in data
        assert "updatedAt" in data
        # Status and priority should be normalized to lowercase
        assert data["status"] == "active"
        assert data["priority"] == "high"

    def test_normalize_user_default_values(self, test_client):
        """Test that missing fields get default values"""
        client, fake_db = test_client

        # Create user with minimal data
        fake_db.collection("users").document("user-defaults").set({
            "fullName": "Minimal User",
        })

        resp = client.get("/api/users/user-defaults")
        assert resp.status_code == 200
        data = resp.get_json()

        # Check default values
        assert data["status"] == "new"
        assert data["priority"] == "medium"
        assert data["collaboratorsIds"] == []
        assert data["tags"] == []
        assert data["ownerId"] == ""
        assert data["description"] == ""
        assert data["title"] == ""

    def test_normalize_user_status_canonicalization(self, test_client):
        """Test that status values are normalized"""
        client, fake_db = test_client

        test_cases = [
            ("ACTIVE", "active"),
            ("Active", "active"),
            ("nEw", "new"),
            (None, "new"),
            ("", "new"),
        ]

        for i, (input_status, expected_status) in enumerate(test_cases):
            user_id = f"user-status-{i}"
            fake_db.collection("users").document(user_id).set({
                "fullName": f"User {i}",
                "status": input_status,
            })

            resp = client.get(f"/api/users/{user_id}")
            assert resp.status_code == 200
            assert resp.get_json()["status"] == expected_status

    def test_normalize_user_priority_canonicalization(self, test_client):
        """Test that priority values are normalized"""
        client, fake_db = test_client

        test_cases = [
            ("LOW", "low"),
            ("Medium", "medium"),
            ("HIGH", "high"),
            (None, "medium"),
            ("", "medium"),
        ]

        for i, (input_priority, expected_priority) in enumerate(test_cases):
            user_id = f"user-priority-{i}"
            fake_db.collection("users").document(user_id).set({
                "fullName": f"User {i}",
                "priority": input_priority,
            })

            resp = client.get(f"/api/users/{user_id}")
            assert resp.status_code == 200
            assert resp.get_json()["priority"] == expected_priority


class TestUserEdgeCases:
    def test_create_user_with_empty_json(self, test_client):
        """Test creating user with empty JSON"""
        client, fake_db = test_client

        resp = client.post("/api/users/", json={})
        assert resp.status_code == 201

    def test_update_user_with_empty_json(self, test_client):
        """Test updating user with empty JSON"""
        client, fake_db = test_client

        fake_db.collection("users").document("user-empty").set({
            "fullName": "Test",
        })

        resp = client.put("/api/users/user-empty", json={})
        assert resp.status_code == 200

    def test_get_users_empty_collection(self, test_client):
        """Test getting users when collection is empty"""
        client, fake_db = test_client

        resp = client.get("/api/users/")
        assert resp.status_code == 200
        assert resp.get_json() == []
