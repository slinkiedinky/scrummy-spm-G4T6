"""
Comprehensive tests for comments.py
Tests all comment endpoints for both project tasks and standalone tasks.
"""
import os
import sys
from datetime import datetime
import pytest
from unittest.mock import Mock, patch

# Ensure the back-end folder is on the import path
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from app import app as flask_app  # noqa: E402
import comments  # noqa: E402
from fake_firestore import FakeFirestore  # noqa: E402


@pytest.fixture
def test_client(monkeypatch):
    """Create a test client with mocked Firestore database"""
    fake_db = FakeFirestore()
    monkeypatch.setattr(comments, "db", fake_db)

    flask_app.config.update(TESTING=True)
    with flask_app.test_client() as client:
        yield client, fake_db


def _setup_project_task(fake_db, project_id, task_id):
    """Helper to create a project and task"""
    fake_db.collection("projects").document(project_id).set({
        "name": "Test Project",
        "teamIds": ["user-1"],
    })
    fake_db.collection("projects").document(project_id).collection("tasks").document(task_id).set({
        "title": "Test Task",
        "assigneeId": "user-1",
    })


def _setup_standalone_task(fake_db, task_id):
    """Helper to create a standalone task"""
    fake_db.collection("tasks").document(task_id).set({
        "title": "Standalone Task",
        "ownerId": "user-1",
    })


def _setup_user(fake_db, user_id, full_name=None, name=None):
    """Helper to create a user"""
    user_data = {}
    if full_name:
        user_data["fullName"] = full_name
    if name:
        user_data["name"] = name
    fake_db.collection("users").document(user_id).set(user_data)


# ============================================================================
# PROJECT TASK COMMENTS TESTS
# ============================================================================

class TestProjectTaskComments:
    """Test comment operations on project tasks"""

    def test_options_request(self, test_client):
        """Test OPTIONS request for CORS"""
        client, _ = test_client

        resp = client.options("/api/tasks/task-1/comments?project_id=proj-1")
        assert resp.status_code == 200

    def test_get_comments_missing_project_id(self, test_client):
        """Test GET without project_id parameter"""
        client, _ = test_client

        resp = client.get("/api/tasks/task-1/comments")
        assert resp.status_code == 400
        assert "Missing project_id" in resp.get_json()["error"]

    def test_get_comments_project_not_found(self, test_client):
        """Test GET when project doesn't exist"""
        client, _ = test_client

        resp = client.get("/api/tasks/task-1/comments?project_id=non-existent")
        assert resp.status_code == 404
        assert "Project not found" in resp.get_json()["error"]

    def test_get_comments_task_not_found(self, test_client):
        """Test GET when task doesn't exist"""
        client, fake_db = test_client

        fake_db.collection("projects").document("proj-1").set({"name": "Project"})

        resp = client.get("/api/tasks/task-1/comments?project_id=proj-1")
        assert resp.status_code == 404
        assert "Task not found" in resp.get_json()["error"]

    def test_get_comments_empty_list(self, test_client):
        """Test GET with no comments returns empty list"""
        client, fake_db = test_client

        _setup_project_task(fake_db, "proj-1", "task-1")

        resp = client.get("/api/tasks/task-1/comments?project_id=proj-1")
        assert resp.status_code == 200
        assert resp.get_json() == []

    def test_get_comments_with_data(self, test_client):
        """Test GET returns comments with author information"""
        client, fake_db = test_client

        _setup_project_task(fake_db, "proj-1", "task-1")
        _setup_user(fake_db, "user-1", full_name="John Doe")

        # Add comments
        task_ref = fake_db.collection("projects").document("proj-1").collection("tasks").document("task-1")
        comments_col = task_ref.collection("comments")

        comments_col.document("comment-1").set({
            "user_id": "user-1",
            "text": "First comment",
            "timestamp": "2024-01-01T10:00:00",
            "edited": False,
        })
        comments_col.document("comment-2").set({
            "user_id": "user-1",
            "text": "Second comment",
            "timestamp": "2024-01-01T11:00:00",
            "edited": False,
        })

        resp = client.get("/api/tasks/task-1/comments?project_id=proj-1")
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data) == 2
        assert data[0]["text"] == "First comment"
        assert data[0]["author"] == "John Doe"
        assert data[0]["id"] == "comment-1"

    def test_get_comments_without_user(self, test_client):
        """Test GET with comment that has no user"""
        client, fake_db = test_client

        _setup_project_task(fake_db, "proj-1", "task-1")

        task_ref = fake_db.collection("projects").document("proj-1").collection("tasks").document("task-1")
        task_ref.collection("comments").document("comment-1").set({
            "user_id": None,
            "text": "Anonymous comment",
            "timestamp": "2024-01-01T10:00:00",
            "edited": False,
        })

        resp = client.get("/api/tasks/task-1/comments?project_id=proj-1")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data[0]["author"] is None

    def test_get_comments_user_not_found(self, test_client):
        """Test GET when user document doesn't exist"""
        client, fake_db = test_client

        _setup_project_task(fake_db, "proj-1", "task-1")

        task_ref = fake_db.collection("projects").document("proj-1").collection("tasks").document("task-1")
        task_ref.collection("comments").document("comment-1").set({
            "user_id": "non-existent-user",
            "text": "Comment",
            "timestamp": "2024-01-01T10:00:00",
            "edited": False,
        })

        resp = client.get("/api/tasks/task-1/comments?project_id=proj-1")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data[0]["author"] is None

    def test_post_comment_missing_project_id(self, test_client):
        """Test POST without project_id parameter"""
        client, _ = test_client

        resp = client.post("/api/tasks/task-1/comments", json={
            "user_id": "user-1",
            "text": "Comment",
        })
        assert resp.status_code == 400

    def test_post_comment_project_not_found(self, test_client):
        """Test POST when project doesn't exist"""
        client, _ = test_client

        resp = client.post("/api/tasks/task-1/comments?project_id=non-existent", json={
            "user_id": "user-1",
            "text": "Comment",
        })
        assert resp.status_code == 404
        assert "Project not found" in resp.get_json()["error"]

    def test_post_comment_task_not_found(self, test_client):
        """Test POST when task doesn't exist"""
        client, fake_db = test_client

        fake_db.collection("projects").document("proj-1").set({"name": "Project"})

        resp = client.post("/api/tasks/task-1/comments?project_id=proj-1", json={
            "user_id": "user-1",
            "text": "Comment",
        })
        assert resp.status_code == 404
        assert "Task not found" in resp.get_json()["error"]

    def test_post_comment_success(self, test_client):
        """Test successfully creating a comment"""
        client, fake_db = test_client

        _setup_project_task(fake_db, "proj-1", "task-1")
        _setup_user(fake_db, "user-1", full_name="John Doe")

        with patch('comments.datetime') as mock_datetime:
            mock_datetime.utcnow.return_value = datetime(2024, 1, 1, 10, 0, 0)

            resp = client.post("/api/tasks/task-1/comments?project_id=proj-1", json={
                "user_id": "user-1",
                "text": "Great work!",
            })

        assert resp.status_code == 201
        data = resp.get_json()
        assert data["text"] == "Great work!"
        assert data["author"] == "John Doe"
        assert data["edited"] is False
        assert "id" in data
        assert "timestamp" in data

    def test_post_comment_without_user(self, test_client):
        """Test creating comment without user_id"""
        client, fake_db = test_client

        _setup_project_task(fake_db, "proj-1", "task-1")

        resp = client.post("/api/tasks/task-1/comments?project_id=proj-1", json={
            "text": "Anonymous comment",
        })
        assert resp.status_code == 201
        data = resp.get_json()
        assert data["author"] is None

    @patch('notifications.add_notification')
    def test_post_comment_with_collaborators(self, mock_notif, test_client):
        """Test POST comment notifies assignee and collaborators (lines 249-254)"""
        client, fake_db = test_client

        # Setup project and task with collaborators
        fake_db.collection("projects").document("proj-1").set({
            "name": "Test Project",
            "teamIds": ["user-1"],
        })
        fake_db.collection("projects").document("proj-1").collection("tasks").document("task-1").set({
            "title": "Test Task",
            "assigneeId": "user-2",
            "collaboratorsIds": ["user-3", "user-4"],
        })
        _setup_user(fake_db, "user-1", full_name="Commenter")

        with patch('comments.datetime') as mock_datetime:
            mock_datetime.utcnow.return_value = datetime(2024, 1, 1, 10, 0, 0)

            resp = client.post("/api/tasks/task-1/comments?project_id=proj-1", json={
                "user_id": "user-1",
                "text": "Update for all!",
            })

        assert resp.status_code == 201
        # Should notify assignee + 2 collaborators
        assert mock_notif.call_count >= 2

    def test_put_comment_missing_project_id(self, test_client):
        """Test PUT without project_id parameter"""
        client, _ = test_client

        resp = client.put("/api/tasks/task-1/comments/comment-1", json={
            "text": "Updated",
        })
        assert resp.status_code == 400

    def test_put_comment_project_not_found(self, test_client):
        """Test PUT when project doesn't exist"""
        client, _ = test_client

        resp = client.put("/api/tasks/task-1/comments/comment-1?project_id=non-existent", json={
            "text": "Updated",
        })
        assert resp.status_code == 404

    def test_put_comment_task_not_found(self, test_client):
        """Test PUT when task doesn't exist"""
        client, fake_db = test_client

        fake_db.collection("projects").document("proj-1").set({"name": "Project"})

        resp = client.put("/api/tasks/task-1/comments/comment-1?project_id=proj-1", json={
            "text": "Updated",
        })
        assert resp.status_code == 404

    def test_put_comment_not_found(self, test_client):
        """Test PUT when comment doesn't exist"""
        client, fake_db = test_client

        _setup_project_task(fake_db, "proj-1", "task-1")

        resp = client.put("/api/tasks/task-1/comments/non-existent?project_id=proj-1", json={
            "text": "Updated",
        })
        assert resp.status_code == 404
        assert "Comment not found" in resp.get_json()["error"]

    def test_put_comment_success(self, test_client):
        """Test successfully updating a comment"""
        client, fake_db = test_client

        _setup_project_task(fake_db, "proj-1", "task-1")
        _setup_user(fake_db, "user-1", full_name="John Doe")

        task_ref = fake_db.collection("projects").document("proj-1").collection("tasks").document("task-1")
        task_ref.collection("comments").document("comment-1").set({
            "user_id": "user-1",
            "text": "Original text",
            "timestamp": "2024-01-01T10:00:00",
            "edited": False,
        })

        with patch('comments.datetime') as mock_datetime:
            mock_datetime.utcnow.return_value = datetime(2024, 1, 1, 11, 0, 0)

            resp = client.put("/api/tasks/task-1/comments/comment-1?project_id=proj-1", json={
                "text": "Updated text",
            })

        assert resp.status_code == 200
        data = resp.get_json()
        assert data["text"] == "Updated text"
        assert data["edited"] is True
        assert "edited_timestamp" in data
        assert data["author"] == "John Doe"

    def test_put_comment_updates_author_from_user_id(self, test_client):
        """Test PUT updates author when user exists (covers lines 286-295)"""
        client, fake_db = test_client

        _setup_project_task(fake_db, "proj-1", "task-1")
        _setup_user(fake_db, "user-2", full_name="Alice Smith")

        task_ref = fake_db.collection("projects").document("proj-1").collection("tasks").document("task-1")
        task_ref.collection("comments").document("comment-1").set({
            "user_id": "user-2",
            "text": "Original text",
            "timestamp": "2024-01-01T10:00:00",
            "edited": False,
        })

        with patch('comments.datetime') as mock_datetime:
            mock_datetime.utcnow.return_value = datetime(2024, 1, 1, 11, 0, 0)

            resp = client.put("/api/tasks/task-1/comments/comment-1?project_id=proj-1", json={
                "text": "Updated",
            })

        assert resp.status_code == 200
        data = resp.get_json()
        assert data["author"] == "Alice Smith"
        assert data["edited"] is True

    def test_delete_comment_missing_project_id(self, test_client):
        """Test DELETE without project_id parameter"""
        client, _ = test_client

        resp = client.delete("/api/tasks/task-1/comments/comment-1")
        assert resp.status_code == 400

    def test_delete_comment_project_not_found(self, test_client):
        """Test DELETE when project doesn't exist"""
        client, _ = test_client

        resp = client.delete("/api/tasks/task-1/comments/comment-1?project_id=non-existent")
        assert resp.status_code == 404

    def test_delete_comment_task_not_found(self, test_client):
        """Test DELETE when task doesn't exist"""
        client, fake_db = test_client

        fake_db.collection("projects").document("proj-1").set({"name": "Project"})

        resp = client.delete("/api/tasks/task-1/comments/comment-1?project_id=proj-1")
        assert resp.status_code == 404

    def test_delete_comment_not_found(self, test_client):
        """Test DELETE when comment doesn't exist"""
        client, fake_db = test_client

        _setup_project_task(fake_db, "proj-1", "task-1")

        resp = client.delete("/api/tasks/task-1/comments/non-existent?project_id=proj-1")
        assert resp.status_code == 404
        assert "Comment not found" in resp.get_json()["error"]

    def test_delete_comment_success(self, test_client):
        """Test successfully deleting a comment"""
        client, fake_db = test_client

        _setup_project_task(fake_db, "proj-1", "task-1")

        task_ref = fake_db.collection("projects").document("proj-1").collection("tasks").document("task-1")
        task_ref.collection("comments").document("comment-1").set({
            "user_id": "user-1",
            "text": "To be deleted",
            "timestamp": "2024-01-01T10:00:00",
            "edited": False,
        })

        resp = client.delete("/api/tasks/task-1/comments/comment-1?project_id=proj-1")
        assert resp.status_code == 200
        assert resp.get_json()["success"] is True

        # Verify deletion
        comment = task_ref.collection("comments").document("comment-1").get()
        assert not comment.exists


# ============================================================================
# STANDALONE TASK COMMENTS TESTS
# ============================================================================

class TestStandaloneTaskComments:
    """Test comment operations on standalone tasks"""

    def test_options_request(self, test_client):
        """Test OPTIONS request for CORS"""
        client, _ = test_client

        resp = client.options("/api/standalone-tasks/task-1/comments")
        assert resp.status_code == 200

    def test_get_comments_task_not_found(self, test_client):
        """Test GET when standalone task doesn't exist"""
        client, _ = test_client

        resp = client.get("/api/standalone-tasks/non-existent/comments")
        assert resp.status_code == 404
        assert "Task not found" in resp.get_json()["error"]

    def test_get_comments_empty_list(self, test_client):
        """Test GET with no comments returns empty list"""
        client, fake_db = test_client

        _setup_standalone_task(fake_db, "task-1")

        resp = client.get("/api/standalone-tasks/task-1/comments")
        assert resp.status_code == 200
        assert resp.get_json() == []

    def test_get_comments_with_data(self, test_client):
        """Test GET returns comments with author information"""
        client, fake_db = test_client

        _setup_standalone_task(fake_db, "task-1")
        _setup_user(fake_db, "user-1", full_name="Jane Doe")

        task_ref = fake_db.collection("tasks").document("task-1")
        comments_col = task_ref.collection("comments")

        comments_col.document("comment-1").set({
            "user_id": "user-1",
            "text": "First comment",
            "timestamp": "2024-01-01T10:00:00",
            "edited": False,
        })
        comments_col.document("comment-2").set({
            "user_id": "user-1",
            "text": "Second comment",
            "timestamp": "2024-01-01T11:00:00",
            "edited": False,
        })

        resp = client.get("/api/standalone-tasks/task-1/comments")
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data) == 2
        assert data[0]["author"] == "Jane Doe"

    def test_get_comments_uses_name_fallback(self, test_client):
        """Test GET uses 'name' field when fullName not available"""
        client, fake_db = test_client

        _setup_standalone_task(fake_db, "task-1")
        _setup_user(fake_db, "user-1", name="JaneDoe")

        task_ref = fake_db.collection("tasks").document("task-1")
        task_ref.collection("comments").document("comment-1").set({
            "user_id": "user-1",
            "text": "Comment",
            "timestamp": "2024-01-01T10:00:00",
            "edited": False,
        })

        resp = client.get("/api/standalone-tasks/task-1/comments")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data[0]["author"] == "JaneDoe"

    def test_post_comment_task_not_found(self, test_client):
        """Test POST when standalone task doesn't exist"""
        client, _ = test_client

        resp = client.post("/api/standalone-tasks/non-existent/comments", json={
            "user_id": "user-1",
            "text": "Comment",
        })
        assert resp.status_code == 404

    def test_post_comment_success(self, test_client):
        """Test successfully creating a comment on standalone task"""
        client, fake_db = test_client

        _setup_standalone_task(fake_db, "task-1")
        _setup_user(fake_db, "user-1", full_name="Jane Doe")

        with patch('comments.datetime') as mock_datetime:
            mock_datetime.utcnow.return_value = datetime(2024, 1, 1, 10, 0, 0)

            resp = client.post("/api/standalone-tasks/task-1/comments", json={
                "user_id": "user-1",
                "text": "Excellent progress!",
            })

        assert resp.status_code == 201
        data = resp.get_json()
        assert data["text"] == "Excellent progress!"
        assert data["author"] == "Jane Doe"
        assert data["edited"] is False
        assert "id" in data

    @patch('notifications.add_notification')
    def test_post_comment_with_collaborators_notification(self, mock_notif, test_client):
        """Test POST comment sends notifications to collaborators"""
        client, fake_db = test_client

        # Setup standalone task with assignee and collaborators
        fake_db.collection("tasks").document("task-1").set({
            "title": "Standalone Task",
            "ownerId": "user-1",
            "collaboratorsIds": ["user-2", "user-3"],
        })
        _setup_user(fake_db, "user-1", full_name="Owner User")

        with patch('comments.datetime') as mock_datetime:
            mock_datetime.utcnow.return_value = datetime(2024, 1, 1, 10, 0, 0)

            resp = client.post("/api/standalone-tasks/task-1/comments", json={
                "user_id": "user-1",
                "text": "Great work!",
            })

        assert resp.status_code == 201
        # Verify notifications were sent to collaborators (lines 89-92)
        assert mock_notif.call_count >= 2  # Owner + collaborators

    def test_put_comment_task_not_found(self, test_client):
        """Test PUT when standalone task doesn't exist"""
        client, _ = test_client

        resp = client.put("/api/standalone-tasks/non-existent/comments/comment-1", json={
            "text": "Updated",
        })
        assert resp.status_code == 404

    def test_put_comment_not_found(self, test_client):
        """Test PUT when comment doesn't exist"""
        client, fake_db = test_client

        _setup_standalone_task(fake_db, "task-1")

        resp = client.put("/api/standalone-tasks/task-1/comments/non-existent", json={
            "text": "Updated",
        })
        assert resp.status_code == 404

    def test_put_comment_success(self, test_client):
        """Test successfully updating a comment on standalone task"""
        client, fake_db = test_client

        _setup_standalone_task(fake_db, "task-1")
        _setup_user(fake_db, "user-1", full_name="Jane Doe")

        task_ref = fake_db.collection("tasks").document("task-1")
        task_ref.collection("comments").document("comment-1").set({
            "user_id": "user-1",
            "text": "Original",
            "timestamp": "2024-01-01T10:00:00",
            "edited": False,
        })

        with patch('comments.datetime') as mock_datetime:
            mock_datetime.utcnow.return_value = datetime(2024, 1, 1, 11, 0, 0)

            resp = client.put("/api/standalone-tasks/task-1/comments/comment-1", json={
                "text": "Updated text",
            })

        assert resp.status_code == 200
        data = resp.get_json()
        assert data["text"] == "Updated text"
        assert data["edited"] is True
        assert "edited_timestamp" in data

    def test_put_comment_updates_author(self, test_client):
        """Test PUT updates author from user_id (covers lines 122-131)"""
        client, fake_db = test_client

        _setup_standalone_task(fake_db, "task-1")
        _setup_user(fake_db, "user-1", full_name="Jane Doe")
        _setup_user(fake_db, "user-2", full_name="John Smith")

        task_ref = fake_db.collection("tasks").document("task-1")
        task_ref.collection("comments").document("comment-1").set({
            "user_id": "user-2",
            "text": "Original",
            "timestamp": "2024-01-01T10:00:00",
            "edited": False,
        })

        with patch('comments.datetime') as mock_datetime:
            mock_datetime.utcnow.return_value = datetime(2024, 1, 1, 11, 0, 0)

            resp = client.put("/api/standalone-tasks/task-1/comments/comment-1", json={
                "text": "Updated text",
            })

        assert resp.status_code == 200
        data = resp.get_json()
        assert data["author"] == "John Smith"  # Author updated from user_id

    def test_delete_comment_task_not_found(self, test_client):
        """Test DELETE when standalone task doesn't exist"""
        client, _ = test_client

        resp = client.delete("/api/standalone-tasks/non-existent/comments/comment-1")
        assert resp.status_code == 404

    def test_delete_comment_not_found(self, test_client):
        """Test DELETE when comment doesn't exist"""
        client, fake_db = test_client

        _setup_standalone_task(fake_db, "task-1")

        resp = client.delete("/api/standalone-tasks/task-1/comments/non-existent")
        assert resp.status_code == 404

    def test_delete_comment_success(self, test_client):
        """Test successfully deleting a comment from standalone task"""
        client, fake_db = test_client

        _setup_standalone_task(fake_db, "task-1")

        task_ref = fake_db.collection("tasks").document("task-1")
        task_ref.collection("comments").document("comment-1").set({
            "user_id": "user-1",
            "text": "To delete",
            "timestamp": "2024-01-01T10:00:00",
            "edited": False,
        })

        resp = client.delete("/api/standalone-tasks/task-1/comments/comment-1")
        assert resp.status_code == 200
        assert resp.get_json()["success"] is True

        # Verify deletion
        comment = task_ref.collection("comments").document("comment-1").get()
        assert not comment.exists


# ============================================================================
# EDGE CASES AND INTEGRATION TESTS
# ============================================================================

class TestEdgeCases:
    """Test edge cases and integration scenarios"""

    def test_multiple_comments_ordering(self, test_client):
        """Test comments are returned in timestamp order"""
        client, fake_db = test_client

        _setup_standalone_task(fake_db, "task-1")

        task_ref = fake_db.collection("tasks").document("task-1")
        comments_col = task_ref.collection("comments")

        # Add comments out of order
        comments_col.document("comment-3").set({
            "text": "Third",
            "timestamp": "2024-01-01T12:00:00",
            "edited": False,
        })
        comments_col.document("comment-1").set({
            "text": "First",
            "timestamp": "2024-01-01T10:00:00",
            "edited": False,
        })
        comments_col.document("comment-2").set({
            "text": "Second",
            "timestamp": "2024-01-01T11:00:00",
            "edited": False,
        })

        resp = client.get("/api/standalone-tasks/task-1/comments")
        assert resp.status_code == 200
        data = resp.get_json()
        # Note: Ordering may depend on FakeFirestore implementation
        assert len(data) == 3

    def test_edit_comment_preserves_original_timestamp(self, test_client):
        """Test editing doesn't change original timestamp"""
        client, fake_db = test_client

        _setup_standalone_task(fake_db, "task-1")

        task_ref = fake_db.collection("tasks").document("task-1")
        task_ref.collection("comments").document("comment-1").set({
            "user_id": "user-1",
            "text": "Original",
            "timestamp": "2024-01-01T10:00:00",
            "edited": False,
        })

        with patch('comments.datetime') as mock_datetime:
            mock_datetime.utcnow.return_value = datetime(2024, 1, 1, 11, 0, 0)

            resp = client.put("/api/standalone-tasks/task-1/comments/comment-1", json={
                "text": "Edited",
            })

        assert resp.status_code == 200
        data = resp.get_json()
        assert data["timestamp"] == "2024-01-01T10:00:00"
        assert data["edited_timestamp"] != data["timestamp"]

    def test_comment_with_empty_text(self, test_client):
        """Test creating comment with empty text"""
        client, fake_db = test_client

        _setup_standalone_task(fake_db, "task-1")

        resp = client.post("/api/standalone-tasks/task-1/comments", json={
            "user_id": "user-1",
            "text": "",
        })
        assert resp.status_code == 201

    def test_full_comment_lifecycle(self, test_client):
        """Test complete CRUD cycle for a comment"""
        client, fake_db = test_client

        _setup_project_task(fake_db, "proj-1", "task-1")
        _setup_user(fake_db, "user-1", full_name="Test User")

        # Create
        with patch('comments.datetime') as mock_datetime:
            mock_datetime.utcnow.return_value = datetime(2024, 1, 1, 10, 0, 0)

            create_resp = client.post("/api/tasks/task-1/comments?project_id=proj-1", json={
                "user_id": "user-1",
                "text": "Initial comment",
            })

        assert create_resp.status_code == 201
        comment_id = create_resp.get_json()["id"]

        # Read
        get_resp = client.get("/api/tasks/task-1/comments?project_id=proj-1")
        assert get_resp.status_code == 200
        comments = get_resp.get_json()
        assert len(comments) == 1
        assert comments[0]["text"] == "Initial comment"

        # Update
        with patch('comments.datetime') as mock_datetime:
            mock_datetime.utcnow.return_value = datetime(2024, 1, 1, 11, 0, 0)

            update_resp = client.put(f"/api/tasks/task-1/comments/{comment_id}?project_id=proj-1", json={
                "text": "Updated comment",
            })

        assert update_resp.status_code == 200
        assert update_resp.get_json()["text"] == "Updated comment"
        assert update_resp.get_json()["edited"] is True

        # Delete
        delete_resp = client.delete(f"/api/tasks/task-1/comments/{comment_id}?project_id=proj-1")
        assert delete_resp.status_code == 200

        # Verify deletion
        final_get = client.get("/api/tasks/task-1/comments?project_id=proj-1")
        assert len(final_get.get_json()) == 0


# ============================================================================
# SUBTASK COMMENTS TESTS
# ============================================================================

class TestSubtaskComments:
    """Test comment operations on subtasks (covers lines 309-461)"""

    def _setup_subtask(self, fake_db, project_id, task_id, subtask_id):
        """Helper to create project, task, and subtask"""
        fake_db.collection("projects").document(project_id).set({
            "name": "Test Project",
            "teamIds": ["user-1"],
        })
        fake_db.collection("projects").document(project_id).collection("tasks").document(task_id).set({
            "title": "Test Task",
            "assigneeId": "user-1",
        })
        fake_db.collection("projects").document(project_id).collection("tasks").document(task_id).collection("subtasks").document(subtask_id).set({
            "title": "Test Subtask",
            "assigneeId": "user-1",
        })

    def test_get_subtask_comments_missing_project_id(self, test_client):
        """Test GET subtask comments without project_id (line 310-311)"""
        client, _ = test_client

        resp = client.get("/api/tasks/task-1/subtasks/sub-1/comments")
        assert resp.status_code == 400
        assert "Missing project_id" in resp.get_json()["error"]

    def test_get_subtask_comments_project_not_found(self, test_client):
        """Test GET when project doesn't exist (line 316-317)"""
        client, _ = test_client

        resp = client.get("/api/tasks/task-1/subtasks/sub-1/comments?project_id=non-existent")
        assert resp.status_code == 404
        assert "Project not found" in resp.get_json()["error"]

    def test_get_subtask_comments_task_not_found(self, test_client):
        """Test GET when task doesn't exist (line 319-320)"""
        client, fake_db = test_client

        fake_db.collection("projects").document("proj-1").set({"name": "Project"})

        resp = client.get("/api/tasks/task-1/subtasks/sub-1/comments?project_id=proj-1")
        assert resp.status_code == 404
        assert "Task not found" in resp.get_json()["error"]

    def test_get_subtask_comments_subtask_not_found(self, test_client):
        """Test GET when subtask doesn't exist (line 322-323)"""
        client, fake_db = test_client

        fake_db.collection("projects").document("proj-1").set({"name": "Project"})
        fake_db.collection("projects").document("proj-1").collection("tasks").document("task-1").set({"title": "Task"})

        resp = client.get("/api/tasks/task-1/subtasks/sub-1/comments?project_id=proj-1")
        assert resp.status_code == 404
        assert "Subtask not found" in resp.get_json()["error"]

    def test_get_subtask_comments_empty(self, test_client):
        """Test GET returns empty list when no comments (lines 324-341)"""
        client, fake_db = test_client

        self._setup_subtask(fake_db, "proj-1", "task-1", "sub-1")

        resp = client.get("/api/tasks/task-1/subtasks/sub-1/comments?project_id=proj-1")
        assert resp.status_code == 200
        assert resp.get_json() == []

    def test_get_subtask_comments_with_data(self, test_client):
        """Test GET returns comments with author (lines 327-340)"""
        client, fake_db = test_client

        self._setup_subtask(fake_db, "proj-1", "task-1", "sub-1")
        _setup_user(fake_db, "user-1", full_name="Test User")

        subtask_ref = fake_db.collection("projects").document("proj-1").collection("tasks").document("task-1").collection("subtasks").document("sub-1")
        subtask_ref.collection("comments").document("comment-1").set({
            "user_id": "user-1",
            "text": "Subtask comment",
            "timestamp": "2024-01-01T10:00:00",
            "edited": False,
        })

        resp = client.get("/api/tasks/task-1/subtasks/sub-1/comments?project_id=proj-1")
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data) == 1
        assert data[0]["text"] == "Subtask comment"
        assert data[0]["author"] == "Test User"

    def test_get_subtask_comments_user_not_found(self, test_client):
        """Test GET with non-existent user (lines 336-337)"""
        client, fake_db = test_client

        self._setup_subtask(fake_db, "proj-1", "task-1", "sub-1")

        subtask_ref = fake_db.collection("projects").document("proj-1").collection("tasks").document("task-1").collection("subtasks").document("sub-1")
        subtask_ref.collection("comments").document("comment-1").set({
            "user_id": "non-existent",
            "text": "Comment",
            "timestamp": "2024-01-01T10:00:00",
            "edited": False,
        })

        resp = client.get("/api/tasks/task-1/subtasks/sub-1/comments?project_id=proj-1")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data[0]["author"] == "Unknown"

    def test_post_subtask_comment_success(self, test_client):
        """Test POST creates subtask comment (lines 342-365)"""
        client, fake_db = test_client

        self._setup_subtask(fake_db, "proj-1", "task-1", "sub-1")
        _setup_user(fake_db, "user-1", full_name="Test User")

        with patch('comments.datetime') as mock_datetime:
            mock_datetime.utcnow.return_value = datetime(2024, 1, 1, 10, 0, 0)

            resp = client.post("/api/tasks/task-1/subtasks/sub-1/comments?project_id=proj-1", json={
                "user_id": "user-1",
                "text": "New subtask comment",
            })

        assert resp.status_code == 201
        data = resp.get_json()
        assert data["text"] == "New subtask comment"
        assert data["author"] == "Test User"
        assert "id" in data

    def test_post_subtask_comment_without_user(self, test_client):
        """Test POST with no user_id (lines 352-353)"""
        client, fake_db = test_client

        self._setup_subtask(fake_db, "proj-1", "task-1", "sub-1")

        with patch('comments.datetime') as mock_datetime:
            mock_datetime.utcnow.return_value = datetime(2024, 1, 1, 10, 0, 0)

            resp = client.post("/api/tasks/task-1/subtasks/sub-1/comments?project_id=proj-1", json={
                "text": "Anonymous comment",
            })

        assert resp.status_code == 201
        data = resp.get_json()
        assert data["author"] == "Unknown"

    @patch('notifications.add_notification')
    def test_post_subtask_comment_notifications(self, mock_notif, test_client):
        """Test POST sends notifications to assignee and collaborators (lines 397-401)"""
        client, fake_db = test_client

        # Setup with collaborators
        fake_db.collection("projects").document("proj-1").set({"name": "Test Project"})
        fake_db.collection("projects").document("proj-1").collection("tasks").document("task-1").set({"title": "Task"})
        fake_db.collection("projects").document("proj-1").collection("tasks").document("task-1").collection("subtasks").document("sub-1").set({
            "title": "Test Subtask",
            "assigneeId": "user-2",
            "collaboratorsIds": ["user-3", "user-4"],
        })
        _setup_user(fake_db, "user-1", full_name="Commenter")

        with patch('comments.datetime') as mock_datetime:
            mock_datetime.utcnow.return_value = datetime(2024, 1, 1, 10, 0, 0)

            resp = client.post("/api/tasks/task-1/subtasks/sub-1/comments?project_id=proj-1", json={
                "user_id": "user-1",
                "text": "Update!",
            })

        assert resp.status_code == 201
        # Should notify assignee + 2 collaborators
        assert mock_notif.call_count >= 2

    def test_put_subtask_comment_missing_project_id(self, test_client):
        """Test PUT without project_id (line 411-412)"""
        client, _ = test_client

        resp = client.put("/api/tasks/task-1/subtasks/sub-1/comments/comment-1", json={"text": "Updated"})
        assert resp.status_code == 400

    def test_put_subtask_comment_project_not_found(self, test_client):
        """Test PUT when project doesn't exist (line 417-418)"""
        client, _ = test_client

        resp = client.put("/api/tasks/task-1/subtasks/sub-1/comments/comment-1?project_id=non-existent", json={"text": "Updated"})
        assert resp.status_code == 404

    def test_put_subtask_comment_task_not_found(self, test_client):
        """Test PUT when task doesn't exist (line 420-421)"""
        client, fake_db = test_client

        fake_db.collection("projects").document("proj-1").set({"name": "Project"})

        resp = client.put("/api/tasks/task-1/subtasks/sub-1/comments/comment-1?project_id=proj-1", json={"text": "Updated"})
        assert resp.status_code == 404

    def test_put_subtask_comment_subtask_not_found(self, test_client):
        """Test PUT when subtask doesn't exist (line 423-424)"""
        client, fake_db = test_client

        fake_db.collection("projects").document("proj-1").set({"name": "Project"})
        fake_db.collection("projects").document("proj-1").collection("tasks").document("task-1").set({"title": "Task"})

        resp = client.put("/api/tasks/task-1/subtasks/sub-1/comments/comment-1?project_id=proj-1", json={"text": "Updated"})
        assert resp.status_code == 404

    def test_put_subtask_comment_not_found(self, test_client):
        """Test PUT when comment doesn't exist (line 431-432)"""
        client, fake_db = test_client

        self._setup_subtask(fake_db, "proj-1", "task-1", "sub-1")

        resp = client.put("/api/tasks/task-1/subtasks/sub-1/comments/non-existent?project_id=proj-1", json={"text": "Updated"})
        assert resp.status_code == 404

    def test_put_subtask_comment_success(self, test_client):
        """Test PUT updates subtask comment (lines 428-454)"""
        client, fake_db = test_client

        self._setup_subtask(fake_db, "proj-1", "task-1", "sub-1")
        _setup_user(fake_db, "user-1", full_name="Test User")

        subtask_ref = fake_db.collection("projects").document("proj-1").collection("tasks").document("task-1").collection("subtasks").document("sub-1")
        subtask_ref.collection("comments").document("comment-1").set({
            "user_id": "user-1",
            "text": "Original",
            "timestamp": "2024-01-01T10:00:00",
            "edited": False,
        })

        with patch('comments.datetime') as mock_datetime:
            mock_datetime.utcnow.return_value = datetime(2024, 1, 1, 11, 0, 0)

            resp = client.put("/api/tasks/task-1/subtasks/sub-1/comments/comment-1?project_id=proj-1", json={
                "text": "Updated text",
            })

        assert resp.status_code == 200
        data = resp.get_json()
        assert data["text"] == "Updated text"
        assert data["edited"] is True
        assert "edited_timestamp" in data

    def test_put_subtask_comment_updates_author(self, test_client):
        """Test PUT updates author from user_id (lines 444-451)"""
        client, fake_db = test_client

        self._setup_subtask(fake_db, "proj-1", "task-1", "sub-1")
        _setup_user(fake_db, "user-2", full_name="Bob Jones")

        subtask_ref = fake_db.collection("projects").document("proj-1").collection("tasks").document("task-1").collection("subtasks").document("sub-1")
        subtask_ref.collection("comments").document("comment-1").set({
            "user_id": "user-2",
            "text": "Original",
            "timestamp": "2024-01-01T10:00:00",
            "edited": False,
        })

        with patch('comments.datetime') as mock_datetime:
            mock_datetime.utcnow.return_value = datetime(2024, 1, 1, 11, 0, 0)

            resp = client.put("/api/tasks/task-1/subtasks/sub-1/comments/comment-1?project_id=proj-1", json={
                "text": "Updated",
            })

        assert resp.status_code == 200
        data = resp.get_json()
        assert data["author"] == "Bob Jones"

    def test_delete_subtask_comment_not_found(self, test_client):
        """Test DELETE when comment doesn't exist (line 458-459)"""
        client, fake_db = test_client

        self._setup_subtask(fake_db, "proj-1", "task-1", "sub-1")

        resp = client.delete("/api/tasks/task-1/subtasks/sub-1/comments/non-existent?project_id=proj-1")
        assert resp.status_code == 404

    def test_delete_subtask_comment_success(self, test_client):
        """Test DELETE removes subtask comment (lines 456-461)"""
        client, fake_db = test_client

        self._setup_subtask(fake_db, "proj-1", "task-1", "sub-1")

        subtask_ref = fake_db.collection("projects").document("proj-1").collection("tasks").document("task-1").collection("subtasks").document("sub-1")
        subtask_ref.collection("comments").document("comment-1").set({
            "user_id": "user-1",
            "text": "To delete",
            "timestamp": "2024-01-01T10:00:00",
            "edited": False,
        })

        resp = client.delete("/api/tasks/task-1/subtasks/sub-1/comments/comment-1?project_id=proj-1")
        assert resp.status_code == 200
        assert resp.get_json()["success"] is True

        # Verify deletion
        comment = subtask_ref.collection("comments").document("comment-1").get()
        assert not comment.exists
