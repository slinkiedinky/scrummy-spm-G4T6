import pytest
from unittest.mock import MagicMock, patch, call
from datetime import datetime, timedelta, timezone
import sys
import os

# Add parent directory to path to import the app
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import app


@pytest.fixture
def client():
    """Create a test client for the Flask app"""
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


@pytest.fixture
def mock_firestore():
    """Mock Firestore database operations"""
    with patch('deadline_notifications.db') as mock_db:
        yield mock_db


@pytest.fixture
def mock_add_notification():
    """Mock the add_notification function"""
    with patch('deadline_notifications.add_notification') as mock_add:
        yield mock_add


def test_upcoming_deadline_alert_24h_before_due_date(client, mock_firestore, mock_add_notification):
    """
    Test scenario: Deadline notification sent 24h before due date

    Pre-conditions:
        1. User logged in
        2. Task with status != Completed and due date is one day after the day of testing

    Test steps:
        1. Open notifications tab

    Test data:
        Task name: Task 1
        Due date: 1 day after current date

    Expected results:
        "Upcoming Deadline" notification appears on notification tab
    """
    from deadline_notifications import check_and_create_deadline_notifications

    # Setup test data
    user_id = "user123"
    project_id = "project123"
    task_id = "task123"
    project_name = "Project 1"

    # Create task with due date 1 day from now (tomorrow)
    # Use datetime without timezone to match deadline_notifications.py implementation
    tomorrow = datetime.utcnow() + timedelta(days=1)
    tomorrow = tomorrow.replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow_str = tomorrow.isoformat()

    task_data = {
        "title": "Task 1",
        "description": "Task with deadline tomorrow",
        "status": "To-Do",  # Not completed
        "priority": 5,
        "dueDate": tomorrow_str,
        "assigneeId": user_id,
    }

    # Mock project document
    mock_project_doc = MagicMock()
    mock_project_doc.id = project_id
    mock_project_doc.to_dict.return_value = {"name": project_name}

    # Mock task document
    mock_task_doc = MagicMock()
    mock_task_doc.id = task_id
    mock_task_doc.to_dict.return_value = task_data

    # Mock tasks collection
    mock_tasks_collection = MagicMock()
    mock_tasks_collection.stream.return_value = [mock_task_doc]

    # Mock project reference
    mock_project_ref = MagicMock()
    mock_project_ref.collection.return_value = mock_tasks_collection

    # Mock projects collection
    mock_projects_collection = MagicMock()
    mock_projects_collection.stream.return_value = [mock_project_doc]
    mock_projects_collection.document.return_value = mock_project_ref

    # Mock notifications query for checking existing notifications
    mock_limit_query = MagicMock()
    mock_limit_query.stream.return_value = []  # No existing notifications
    mock_where_query = MagicMock()
    mock_where_query.where.return_value = mock_where_query
    mock_where_query.limit.return_value = mock_limit_query
    mock_notifications_collection = MagicMock()
    mock_notifications_collection.where.return_value = mock_where_query

    # Setup collection routing
    def mock_collection_router(collection_name):
        if collection_name == "notifications":
            return mock_notifications_collection
        elif collection_name == "projects":
            return mock_projects_collection
        return MagicMock()

    mock_firestore.collection.side_effect = mock_collection_router

    # Trigger deadline check
    check_and_create_deadline_notifications()

    # Verify add_notification was called
    assert mock_add_notification.called, "Notification should be created"

    # Get the notification data that was added
    notification_data = mock_add_notification.call_args[0][0]
    project_name_arg = mock_add_notification.call_args[0][1]

    assert notification_data is not None, "Notification data should not be None"
    assert project_name_arg == project_name, "Project name should be passed to add_notification"

    # Step 1: Open notifications tab - Verify "Upcoming Deadline" notification appears
    # Expected results: "Upcoming Deadline" notification with correct details
    assert notification_data["type"] == "deadline_reminder", "Notification type should be 'deadline_reminder' (Upcoming Deadline)"
    assert notification_data["userId"] == user_id, "Notification should be for the assigned user"
    assert notification_data["taskId"] == task_id, "Notification should reference the task"
    assert notification_data["projectId"] == project_id, "Notification should reference the project"
    assert notification_data["projectName"] == project_name, "Notification should include project name"
    assert notification_data["title"] == "Task 1", "Notification should include task name"
    assert "due tomorrow" in notification_data["message"].lower(), "Notification message should mention deadline"
    assert notification_data["icon"] == "calendar", "Notification should have calendar icon"

    # Verify notification appears when user opens notifications tab
    # The frontend would query: db.collection("notifications").where("userId", "==", user_id)
    assert notification_data["userId"] == user_id, "User should see their notification in notifications tab"
    assert notification_data["type"] == "deadline_reminder", "Notification type should indicate upcoming deadline"


def test_upcoming_deadline_alert_not_shown_for_completed_tasks(client, mock_firestore, mock_add_notification):
    """
    Test scenario: Deadline notification should NOT be sent for completed tasks

    Pre-conditions:
        1. User logged in
        2. Task with status = Completed and due date is one day after the day of testing

    Test steps:
        1. Check if notification is created for completed task

    Expected results:
        No "Upcoming Deadline" notification is created for completed tasks
    """
    from deadline_notifications import check_and_create_deadline_notifications

    # Setup test data
    user_id = "user123"
    project_id = "project123"
    task_id = "task456"
    project_name = "Project 1"

    # Create COMPLETED task with due date 1 day from now
    tomorrow = datetime.utcnow() + timedelta(days=1)
    tomorrow = tomorrow.replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow_str = tomorrow.isoformat()

    task_data = {
        "title": "Completed Task",
        "description": "This task is already completed",
        "status": "completed",  # Task is completed (lowercase to match implementation)
        "priority": 3,
        "dueDate": tomorrow_str,
        "assigneeId": user_id,
    }

    # Mock project document
    mock_project_doc = MagicMock()
    mock_project_doc.id = project_id
    mock_project_doc.to_dict.return_value = {"name": project_name}

    # Mock task document
    mock_task_doc = MagicMock()
    mock_task_doc.id = task_id
    mock_task_doc.to_dict.return_value = task_data

    # Mock tasks collection
    mock_tasks_collection = MagicMock()
    mock_tasks_collection.stream.return_value = [mock_task_doc]

    # Mock project reference
    mock_project_ref = MagicMock()
    mock_project_ref.collection.return_value = mock_tasks_collection

    # Mock projects collection
    mock_projects_collection = MagicMock()
    mock_projects_collection.stream.return_value = [mock_project_doc]
    mock_projects_collection.document.return_value = mock_project_ref

    # Mock notifications query
    mock_limit_query = MagicMock()
    mock_limit_query.stream.return_value = []
    mock_where_query = MagicMock()
    mock_where_query.where.return_value = mock_where_query
    mock_where_query.limit.return_value = mock_limit_query
    mock_notifications_collection = MagicMock()
    mock_notifications_collection.where.return_value = mock_where_query

    # Setup collection routing
    def mock_collection_router(collection_name):
        if collection_name == "notifications":
            return mock_notifications_collection
        elif collection_name == "projects":
            return mock_projects_collection
        return MagicMock()

    mock_firestore.collection.side_effect = mock_collection_router

    # Trigger deadline check for the completed task
    check_and_create_deadline_notifications()

    # Verify NO notification was created for completed task
    # The check_and_create_deadline_notifications function should skip completed tasks
    assert not mock_add_notification.called, "Notification should NOT be created for completed tasks"


def test_upcoming_deadline_alert_multiple_tasks(client, mock_firestore, mock_add_notification):
    """
    Test scenario: Multiple deadline notifications for multiple tasks due tomorrow

    Pre-conditions:
        1. User logged in
        2. Multiple tasks with status != Completed and due date is one day after testing

    Test steps:
        1. Open notifications tab

    Expected results:
        Multiple "Upcoming Deadline" notifications appear for each task
    """
    from deadline_notifications import check_and_create_deadline_notifications

    # Setup test data
    user_id = "user123"
    project_id = "project123"
    project_name = "Project 1"

    tomorrow = datetime.utcnow() + timedelta(days=1)
    tomorrow = tomorrow.replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow_str = tomorrow.isoformat()

    # Create multiple tasks due tomorrow
    tasks = [
        {
            "id": "task1",
            "title": "Task 1",
            "description": "First task due tomorrow",
            "status": "To-Do",
            "priority": 5,
            "dueDate": tomorrow_str,
            "assigneeId": user_id,
        },
        {
            "id": "task2",
            "title": "Task 2",
            "description": "Second task due tomorrow",
            "status": "In Progress",
            "priority": 3,
            "dueDate": tomorrow_str,
            "assigneeId": user_id,
        }
    ]

    # Mock project document
    mock_project_doc = MagicMock()
    mock_project_doc.id = project_id
    mock_project_doc.to_dict.return_value = {"name": project_name}

    # Mock task documents
    mock_task_docs = []
    for task in tasks:
        task_id = task["id"]
        task_data = {k: v for k, v in task.items() if k != "id"}
        mock_task_doc = MagicMock()
        mock_task_doc.id = task_id
        mock_task_doc.to_dict.return_value = task_data
        mock_task_docs.append(mock_task_doc)

    # Mock tasks collection
    mock_tasks_collection = MagicMock()
    mock_tasks_collection.stream.return_value = mock_task_docs

    # Mock project reference
    mock_project_ref = MagicMock()
    mock_project_ref.collection.return_value = mock_tasks_collection

    # Mock projects collection
    mock_projects_collection = MagicMock()
    mock_projects_collection.stream.return_value = [mock_project_doc]
    mock_projects_collection.document.return_value = mock_project_ref

    # Mock notifications query
    mock_limit_query = MagicMock()
    mock_limit_query.stream.return_value = []  # No existing notifications
    mock_where_query = MagicMock()
    mock_where_query.where.return_value = mock_where_query
    mock_where_query.limit.return_value = mock_limit_query
    mock_notifications_collection = MagicMock()
    mock_notifications_collection.where.return_value = mock_where_query

    # Setup collection routing
    def mock_collection_router(collection_name):
        if collection_name == "notifications":
            return mock_notifications_collection
        elif collection_name == "projects":
            return mock_projects_collection
        return MagicMock()

    mock_firestore.collection.side_effect = mock_collection_router

    # Trigger deadline check
    check_and_create_deadline_notifications()

    # Verify notifications were created for both tasks
    assert mock_add_notification.call_count == 2, "Should create 2 notifications for 2 tasks"

    # Verify all notification calls
    all_calls = mock_add_notification.call_args_list

    for i, call in enumerate(all_calls):
        notification_data = call[0][0]
        assert notification_data["type"] == "deadline_reminder", f"Notification {i+1} should be deadline reminder"
        assert notification_data["userId"] == user_id, f"Notification {i+1} should be for the user"
        assert "due tomorrow" in notification_data["message"].lower(), f"Notification {i+1} should mention deadline"

    # When user opens notifications tab, they should see all notifications
    # Frontend would filter: notifications.where("userId", "==", user_id).where("type", "==", "deadline_reminder")
