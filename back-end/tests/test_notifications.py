"""
Comprehensive tests for notifications.py
Tests the add_notification function.
"""
import os
import sys
import pytest

# Ensure the back-end folder is on the import path
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

import notifications  # noqa: E402
from fake_firestore import FakeFirestore  # noqa: E402
from google.cloud import firestore as gcf  # noqa: E402


@pytest.fixture
def fake_db(monkeypatch):
    """Create a fake Firestore database"""
    db = FakeFirestore()
    monkeypatch.setattr(notifications, "db", db)
    return db


class TestAddNotification:
    """Test the add_notification function"""

    def test_add_notification_with_all_fields(self, fake_db):
        """Test creating notification with all possible fields"""
        task_data = {
            "userId": "user-1",
            "assigneeId": "assignee-1",
            "projectId": "project-1",
            "taskId": "task-1",
            "title": "Task Title",
            "description": "Task Description",
            "dueDate": "2024-12-31",
            "priority": 8,
            "status": "in progress",
            "tags": ["urgent", "bug"],
            "type": "add task",
            "icon": "clipboardlist",
            "createdBy": "creator-1",
            "assignedByName": "John Doe",
            "updatedBy": "updater-1",
            "updatedByName": "Jane Doe",
            "prevStatus": "to-do",
            "statusFrom": "to-do",
            "statusTo": "in progress",
            "message": "Status changed",
        }

        result = notifications.add_notification(task_data, "Test Project")

        # Verify all fields are set correctly
        assert result["userId"] == "user-1"
        assert result["assigneeId"] == "assignee-1"
        assert result["projectId"] == "project-1"
        assert result["projectName"] == "Test Project"
        assert result["taskId"] == "task-1"
        assert result["title"] == "Task Title"
        assert result["description"] == "Task Description"
        assert result["dueDate"] == "2024-12-31"
        assert result["priority"] == 8
        assert result["status"] == "in progress"
        assert result["tags"] == ["urgent", "bug"]
        assert result["type"] == "add task"
        assert result["icon"] == "clipboardlist"
        assert result["createdBy"] == "creator-1"
        assert result["assignedByName"] == "John Doe"
        assert result["updatedBy"] == "updater-1"
        assert result["updatedByName"] == "Jane Doe"
        assert result["prevStatus"] == "to-do"
        assert result["statusFrom"] == "to-do"
        assert result["statusTo"] == "in progress"
        assert result["message"] == "Status changed"
        assert result["isRead"] is False
        assert "createdAt" in result

        # Verify it was added to database
        notifications_col = fake_db.collection("notifications")
        docs = list(notifications_col.stream())
        assert len(docs) == 1

    def test_add_notification_with_minimal_fields(self, fake_db):
        """Test creating notification with only required fields"""
        task_data = {
            "userId": "user-1",
            "projectId": "project-1",
            "taskId": "task-1",
        }

        result = notifications.add_notification(task_data, "Minimal Project")

        assert result["userId"] == "user-1"
        assert result["projectId"] == "project-1"
        assert result["projectName"] == "Minimal Project"
        assert result["taskId"] == "task-1"
        assert result["isRead"] is False

        # Fields that should have defaults or be filtered out
        assert "tags" not in result or result["tags"] == []
        assert "icon" in result  # Default is "bell"
        assert result["icon"] == "bell"

    def test_add_notification_filters_none_values(self, fake_db):
        """Test that None values are filtered out"""
        task_data = {
            "userId": "user-1",
            "projectId": "project-1",
            "taskId": "task-1",
            "description": None,
            "dueDate": None,
            "priority": None,
            "createdBy": None,
        }

        result = notifications.add_notification(task_data, "Test Project")

        assert "description" not in result
        assert "dueDate" not in result
        assert "priority" not in result
        assert "createdBy" not in result
        assert "userId" in result
        assert "projectId" in result

    def test_add_notification_empty_tags_becomes_empty_list(self, fake_db):
        """Test that None tags becomes empty list"""
        task_data = {
            "userId": "user-1",
            "projectId": "project-1",
            "taskId": "task-1",
            "tags": None,
        }

        result = notifications.add_notification(task_data, "Test Project")

        assert result["tags"] == []

    def test_add_notification_default_type_empty(self, fake_db):
        """Test default type is empty string"""
        task_data = {
            "userId": "user-1",
            "projectId": "project-1",
            "taskId": "task-1",
        }

        result = notifications.add_notification(task_data, "Test Project")

        assert result["type"] == ""

    def test_add_notification_default_icon(self, fake_db):
        """Test default icon is 'bell'"""
        task_data = {
            "userId": "user-1",
            "projectId": "project-1",
            "taskId": "task-1",
        }

        result = notifications.add_notification(task_data, "Test Project")

        assert result["icon"] == "bell"

    def test_add_notification_custom_icon(self, fake_db):
        """Test custom icon overrides default"""
        task_data = {
            "userId": "user-1",
            "projectId": "project-1",
            "taskId": "task-1",
            "icon": "alert",
        }

        result = notifications.add_notification(task_data, "Test Project")

        assert result["icon"] == "alert"

    def test_add_notification_with_status_change(self, fake_db):
        """Test notification for status change"""
        task_data = {
            "userId": "user-1",
            "projectId": "project-1",
            "taskId": "task-1",
            "type": "status change",
            "statusFrom": "to-do",
            "statusTo": "completed",
            "updatedBy": "updater-1",
            "updatedByName": "John Doe",
        }

        result = notifications.add_notification(task_data, "Status Project")

        assert result["type"] == "status change"
        assert result["statusFrom"] == "to-do"
        assert result["statusTo"] == "completed"
        assert result["updatedBy"] == "updater-1"
        assert result["updatedByName"] == "John Doe"

    def test_add_notification_with_task_assignment(self, fake_db):
        """Test notification for task assignment"""
        task_data = {
            "userId": "assignee-1",
            "assigneeId": "assignee-1",
            "projectId": "project-1",
            "taskId": "task-1",
            "title": "New Task",
            "type": "add task",
            "createdBy": "creator-1",
            "assignedByName": "Manager",
            "priority": 9,
            "status": "to-do",
        }

        result = notifications.add_notification(task_data, "Assignment Project")

        assert result["type"] == "add task"
        assert result["assigneeId"] == "assignee-1"
        assert result["createdBy"] == "creator-1"
        assert result["assignedByName"] == "Manager"
        assert result["title"] == "New Task"

    def test_add_notification_returns_created_notification(self, fake_db):
        """Test that function returns the created notification"""
        task_data = {
            "userId": "user-1",
            "projectId": "project-1",
            "taskId": "task-1",
        }

        result = notifications.add_notification(task_data, "Return Project")

        assert isinstance(result, dict)
        assert result["userId"] == "user-1"
        assert result["projectName"] == "Return Project"
        assert result["isRead"] is False

    def test_add_notification_creates_document(self, fake_db):
        """Test that notification is actually created in database"""
        task_data = {
            "userId": "user-1",
            "projectId": "project-1",
            "taskId": "task-1",
            "title": "Database Test",
        }

        notifications.add_notification(task_data, "DB Project")

        # Verify document exists
        notifications_col = fake_db.collection("notifications")
        docs = list(notifications_col.stream())

        assert len(docs) == 1
        doc_data = docs[0].to_dict()
        assert doc_data["userId"] == "user-1"
        assert doc_data["title"] == "Database Test"
        assert doc_data["projectName"] == "DB Project"

    def test_add_multiple_notifications(self, fake_db):
        """Test adding multiple notifications"""
        task_data_1 = {
            "userId": "user-1",
            "projectId": "project-1",
            "taskId": "task-1",
        }

        task_data_2 = {
            "userId": "user-2",
            "projectId": "project-2",
            "taskId": "task-2",
        }

        notifications.add_notification(task_data_1, "Project 1")
        notifications.add_notification(task_data_2, "Project 2")

        # Verify both were created
        notifications_col = fake_db.collection("notifications")
        docs = list(notifications_col.stream())
        assert len(docs) == 2

    def test_add_notification_with_empty_project_name(self, fake_db):
        """Test notification with empty project name"""
        task_data = {
            "userId": "user-1",
            "projectId": "project-1",
            "taskId": "task-1",
        }

        result = notifications.add_notification(task_data, "")

        assert result["projectName"] == ""

    def test_add_notification_preserves_data_types(self, fake_db):
        """Test that data types are preserved correctly"""
        task_data = {
            "userId": "user-1",
            "projectId": "project-1",
            "taskId": "task-1",
            "priority": 5,  # int
            "tags": ["tag1", "tag2"],  # list
            "isRead": False,  # will be overridden
        }

        result = notifications.add_notification(task_data, "Type Test")

        assert isinstance(result["priority"], int)
        assert result["priority"] == 5
        assert isinstance(result["tags"], list)
        assert result["tags"] == ["tag1", "tag2"]
        assert result["isRead"] is False  # Always false for new notifications

    def test_add_notification_with_complex_tags(self, fake_db):
        """Test notification with multiple tags"""
        task_data = {
            "userId": "user-1",
            "projectId": "project-1",
            "taskId": "task-1",
            "tags": ["urgent", "bug", "frontend", "critical"],
        }

        result = notifications.add_notification(task_data, "Tag Test")

        assert len(result["tags"]) == 4
        assert "urgent" in result["tags"]
        assert "critical" in result["tags"]

    def test_add_notification_message_field(self, fake_db):
        """Test notification with custom message"""
        task_data = {
            "userId": "user-1",
            "projectId": "project-1",
            "taskId": "task-1",
            "message": "This is a custom notification message",
        }

        result = notifications.add_notification(task_data, "Message Test")

        assert result["message"] == "This is a custom notification message"

    def test_add_notification_all_status_fields(self, fake_db):
        """Test notification with all status-related fields"""
        task_data = {
            "userId": "user-1",
            "projectId": "project-1",
            "taskId": "task-1",
            "status": "in progress",
            "prevStatus": "to-do",
            "statusFrom": "to-do",
            "statusTo": "in progress",
        }

        result = notifications.add_notification(task_data, "Status Test")

        assert result["status"] == "in progress"
        assert result["prevStatus"] == "to-do"
        assert result["statusFrom"] == "to-do"
        assert result["statusTo"] == "in progress"
