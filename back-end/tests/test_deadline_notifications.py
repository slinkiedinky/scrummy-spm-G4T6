"""
Comprehensive tests for deadline_notifications.py
Tests the deadline notification checking and creation logic.
"""
import os
import sys
import datetime as dt
import pytest
from unittest.mock import Mock, patch, call

# Ensure the back-end folder is on the import path
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from fake_firestore import FakeFirestore  # noqa: E402
import deadline_notifications  # noqa: E402


@pytest.fixture
def fake_db(monkeypatch):
    """Create a fake Firestore database"""
    db = FakeFirestore()
    monkeypatch.setattr(deadline_notifications, "db", db)
    return db


@pytest.fixture
def mock_add_notification(monkeypatch):
    """Mock the add_notification function"""
    mock = Mock()
    monkeypatch.setattr(deadline_notifications, "add_notification", mock)
    return mock


def _create_project(db, project_id, name="Test Project"):
    """Helper to create a test project"""
    db.collection("projects").document(project_id).set({
        "name": name,
        "teamIds": ["user-1"],
    })


def _create_task(db, project_id, task_id, **kwargs):
    """Helper to create a test task"""
    task_data = {
        "title": kwargs.get("title", "Test Task"),
        "description": kwargs.get("description", ""),
        "assigneeId": kwargs.get("assigneeId", "user-1"),
        "collaboratorsIds": kwargs.get("collaboratorsIds", []),
        "status": kwargs.get("status", "to-do"),
        "priority": kwargs.get("priority", 5),
        "dueDate": kwargs.get("dueDate"),
    }
    db.collection("projects").document(project_id).collection("tasks").document(task_id).set(task_data)


class TestDeadlineNotificationsBasic:
    """Test basic deadline notification functionality"""

    def test_no_projects(self, fake_db, mock_add_notification):
        """Test when there are no projects"""
        deadline_notifications.check_and_create_deadline_notifications()

        # Should not create any notifications
        mock_add_notification.assert_not_called()

    def test_project_with_no_tasks(self, fake_db, mock_add_notification):
        """Test project with no tasks"""
        _create_project(fake_db, "proj-1")

        deadline_notifications.check_and_create_deadline_notifications()

        # Should not create any notifications
        mock_add_notification.assert_not_called()

    def test_task_without_due_date(self, fake_db, mock_add_notification):
        """Test task without dueDate"""
        _create_project(fake_db, "proj-1")
        _create_task(fake_db, "proj-1", "task-1", dueDate=None)

        deadline_notifications.check_and_create_deadline_notifications()

        # Should not create any notifications
        mock_add_notification.assert_not_called()

    def test_completed_task_ignored(self, fake_db, mock_add_notification):
        """Test that completed tasks are ignored"""
        _create_project(fake_db, "proj-1")

        tomorrow = dt.datetime.utcnow() + dt.timedelta(days=1)
        _create_task(
            fake_db, "proj-1", "task-1",
            status="completed",
            dueDate=tomorrow.isoformat()
        )

        deadline_notifications.check_and_create_deadline_notifications()

        # Should not create notifications for completed tasks
        mock_add_notification.assert_not_called()


class TestDeadlineNotificationsTomorrow:
    """Test notifications for tasks due tomorrow"""

    def test_task_due_tomorrow_creates_notification(self, fake_db, mock_add_notification):
        """Test notification created for task due tomorrow"""
        _create_project(fake_db, "proj-1", "Project Alpha")

        tomorrow = dt.datetime.utcnow() + dt.timedelta(days=1)
        tomorrow_date = tomorrow.replace(hour=0, minute=0, second=0, microsecond=0)

        _create_task(
            fake_db, "proj-1", "task-1",
            title="Important Task",
            description="Task description",
            assigneeId="user-1",
            dueDate=tomorrow_date.isoformat(),
            priority=9,
            status="in progress"
        )

        deadline_notifications.check_and_create_deadline_notifications()

        # Should create one notification
        assert mock_add_notification.call_count == 1

        # Verify notification data
        call_args = mock_add_notification.call_args
        notif_data = call_args[0][0]
        project_name = call_args[0][1]

        assert notif_data["projectId"] == "proj-1"
        assert notif_data["taskId"] == "task-1"
        assert notif_data["title"] == "Important Task"
        assert notif_data["userId"] == "user-1"
        assert notif_data["type"] == "deadline_reminder"
        assert notif_data["icon"] == "calendar"
        assert "tomorrow" in notif_data["message"].lower()
        assert project_name == "Project Alpha"

    def test_task_due_tomorrow_with_collaborators(self, fake_db, mock_add_notification):
        """Test notifications sent to assignee and collaborators"""
        _create_project(fake_db, "proj-1")

        tomorrow = dt.datetime.utcnow() + dt.timedelta(days=1)
        tomorrow_date = tomorrow.replace(hour=0, minute=0, second=0, microsecond=0)

        _create_task(
            fake_db, "proj-1", "task-1",
            assigneeId="user-1",
            collaboratorsIds=["user-2", "user-3"],
            dueDate=tomorrow_date.isoformat()
        )

        deadline_notifications.check_and_create_deadline_notifications()

        # Should create 3 notifications (assignee + 2 collaborators)
        assert mock_add_notification.call_count == 3

        # Verify all users notified
        notified_users = [call[0][0]["userId"] for call in mock_add_notification.call_args_list]
        assert "user-1" in notified_users
        assert "user-2" in notified_users
        assert "user-3" in notified_users

    def test_duplicate_notification_not_created(self, fake_db, mock_add_notification):
        """Test that duplicate notifications are not created"""
        _create_project(fake_db, "proj-1")

        tomorrow = dt.datetime.utcnow() + dt.timedelta(days=1)
        tomorrow_date = tomorrow.replace(hour=0, minute=0, second=0, microsecond=0)

        _create_task(
            fake_db, "proj-1", "task-1",
            assigneeId="user-1",
            dueDate=tomorrow_date.isoformat()
        )

        # Create existing notification
        fake_db.collection("notifications").document("notif-1").set({
            "taskId": "task-1",
            "userId": "user-1",
            "type": "deadline_reminder",
        })

        deadline_notifications.check_and_create_deadline_notifications()

        # Should not create duplicate
        mock_add_notification.assert_not_called()


class TestDeadlineNotificationsToday:
    """Test notifications for tasks due today"""

    def test_task_due_today_creates_notification(self, fake_db, mock_add_notification):
        """Test notification created for task due today"""
        _create_project(fake_db, "proj-1", "Project Beta")

        today = dt.datetime.utcnow()
        today_date = today.replace(hour=0, minute=0, second=0, microsecond=0)

        _create_task(
            fake_db, "proj-1", "task-1",
            title="Urgent Task",
            assigneeId="user-1",
            dueDate=today_date.isoformat(),
            status="to-do"
        )

        deadline_notifications.check_and_create_deadline_notifications()

        # Should create one notification
        assert mock_add_notification.call_count == 1

        # Verify notification data
        call_args = mock_add_notification.call_args
        notif_data = call_args[0][0]

        assert notif_data["type"] == "deadline_today"
        assert notif_data["taskId"] == "task-1"
        assert "today" in notif_data["message"].lower()

    def test_task_due_today_with_collaborators(self, fake_db, mock_add_notification):
        """Test today's deadline notifies all users"""
        _create_project(fake_db, "proj-1")

        today = dt.datetime.utcnow()
        today_date = today.replace(hour=0, minute=0, second=0, microsecond=0)

        _create_task(
            fake_db, "proj-1", "task-1",
            assigneeId="user-1",
            collaboratorsIds=["user-2"],
            dueDate=today_date.isoformat()
        )

        deadline_notifications.check_and_create_deadline_notifications()

        # Should create 2 notifications
        assert mock_add_notification.call_count == 2

    def test_duplicate_today_notification_not_created(self, fake_db, mock_add_notification):
        """Test that duplicate today notifications are not created"""
        _create_project(fake_db, "proj-1")

        today = dt.datetime.utcnow()
        today_date = today.replace(hour=0, minute=0, second=0, microsecond=0)

        _create_task(
            fake_db, "proj-1", "task-1",
            assigneeId="user-1",
            dueDate=today_date.isoformat()
        )

        # Create existing notification
        fake_db.collection("notifications").document("notif-1").set({
            "taskId": "task-1",
            "userId": "user-1",
            "type": "deadline_today",
        })

        deadline_notifications.check_and_create_deadline_notifications()

        # Should not create duplicate
        mock_add_notification.assert_not_called()


class TestDeadlineNotificationsDateParsing:
    """Test date parsing edge cases"""

    def test_iso_format_with_z(self, fake_db, mock_add_notification):
        """Test ISO format date with Z suffix"""
        _create_project(fake_db, "proj-1")

        tomorrow = dt.datetime.utcnow() + dt.timedelta(days=1)
        tomorrow_date = tomorrow.replace(hour=0, minute=0, second=0, microsecond=0)
        iso_with_z = tomorrow_date.isoformat() + "Z"

        _create_task(
            fake_db, "proj-1", "task-1",
            assigneeId="user-1",
            dueDate=iso_with_z
        )

        deadline_notifications.check_and_create_deadline_notifications()

        # Should handle Z suffix and create notification
        assert mock_add_notification.call_count == 1

    def test_invalid_date_format_ignored(self, fake_db, mock_add_notification):
        """Test that invalid date formats are ignored gracefully"""
        _create_project(fake_db, "proj-1")

        _create_task(
            fake_db, "proj-1", "task-1",
            assigneeId="user-1",
            dueDate="invalid-date-format"
        )

        # Should not crash, just skip the task
        deadline_notifications.check_and_create_deadline_notifications()

        # Should not create any notifications
        mock_add_notification.assert_not_called()

    def test_firestore_timestamp_format(self, fake_db, mock_add_notification):
        """Test Firestore timestamp format"""
        _create_project(fake_db, "proj-1")

        tomorrow = dt.datetime.utcnow() + dt.timedelta(days=1)
        tomorrow_date = tomorrow.replace(hour=0, minute=0, second=0, microsecond=0)

        # Mock Firestore timestamp
        mock_timestamp = Mock()
        mock_timestamp.todate.return_value = tomorrow_date

        # Manually set task with mock timestamp
        task_ref = fake_db.collection("projects").document("proj-1").collection("tasks").document("task-1")
        task_ref.set({
            "title": "Task",
            "assigneeId": "user-1",
            "status": "to-do",
            "dueDate": mock_timestamp,
        })

        deadline_notifications.check_and_create_deadline_notifications()

        # Should handle Firestore timestamp
        assert mock_add_notification.call_count == 1


class TestDeadlineNotificationsMultipleProjects:
    """Test with multiple projects and tasks"""

    def test_multiple_projects_and_tasks(self, fake_db, mock_add_notification):
        """Test processing multiple projects with multiple tasks"""
        # Create two projects
        _create_project(fake_db, "proj-1", "Project 1")
        _create_project(fake_db, "proj-2", "Project 2")

        tomorrow = dt.datetime.utcnow() + dt.timedelta(days=1)
        tomorrow_date = tomorrow.replace(hour=0, minute=0, second=0, microsecond=0)

        today = dt.datetime.utcnow()
        today_date = today.replace(hour=0, minute=0, second=0, microsecond=0)

        # Project 1 tasks
        _create_task(fake_db, "proj-1", "task-1", assigneeId="user-1", dueDate=tomorrow_date.isoformat())
        _create_task(fake_db, "proj-1", "task-2", assigneeId="user-2", dueDate=today_date.isoformat())

        # Project 2 tasks
        _create_task(fake_db, "proj-2", "task-3", assigneeId="user-3", dueDate=tomorrow_date.isoformat())

        deadline_notifications.check_and_create_deadline_notifications()

        # Should create 3 notifications total
        assert mock_add_notification.call_count == 3

    def test_mixed_deadline_statuses(self, fake_db, mock_add_notification):
        """Test tasks with various deadline statuses"""
        _create_project(fake_db, "proj-1")

        tomorrow = dt.datetime.utcnow() + dt.timedelta(days=1)
        tomorrow_date = tomorrow.replace(hour=0, minute=0, second=0, microsecond=0)

        today = dt.datetime.utcnow()
        today_date = today.replace(hour=0, minute=0, second=0, microsecond=0)

        next_week = dt.datetime.utcnow() + dt.timedelta(days=7)
        next_week_date = next_week.replace(hour=0, minute=0, second=0, microsecond=0)

        # Tomorrow (should notify)
        _create_task(fake_db, "proj-1", "task-1", assigneeId="user-1", dueDate=tomorrow_date.isoformat())

        # Today (should notify)
        _create_task(fake_db, "proj-1", "task-2", assigneeId="user-1", dueDate=today_date.isoformat())

        # Next week (should NOT notify)
        _create_task(fake_db, "proj-1", "task-3", assigneeId="user-1", dueDate=next_week_date.isoformat())

        # No due date (should NOT notify)
        _create_task(fake_db, "proj-1", "task-4", assigneeId="user-1", dueDate=None)

        # Completed (should NOT notify)
        _create_task(fake_db, "proj-1", "task-5", assigneeId="user-1", status="completed", dueDate=tomorrow_date.isoformat())

        deadline_notifications.check_and_create_deadline_notifications()

        # Should create 2 notifications (tomorrow + today)
        assert mock_add_notification.call_count == 2


class TestDeadlineNotificationsEdgeCases:
    """Test edge cases and error handling"""

    def test_task_with_empty_assignee(self, fake_db, mock_add_notification):
        """Test task with no assignee"""
        _create_project(fake_db, "proj-1")

        tomorrow = dt.datetime.utcnow() + dt.timedelta(days=1)
        tomorrow_date = tomorrow.replace(hour=0, minute=0, second=0, microsecond=0)

        _create_task(
            fake_db, "proj-1", "task-1",
            assigneeId=None,
            dueDate=tomorrow_date.isoformat()
        )

        # Should not crash
        deadline_notifications.check_and_create_deadline_notifications()

        # Should not create notifications for tasks without assignee
        mock_add_notification.assert_not_called()

    def test_task_with_empty_collaborators_list(self, fake_db, mock_add_notification):
        """Test task with empty collaborators list"""
        _create_project(fake_db, "proj-1")

        tomorrow = dt.datetime.utcnow() + dt.timedelta(days=1)
        tomorrow_date = tomorrow.replace(hour=0, minute=0, second=0, microsecond=0)

        _create_task(
            fake_db, "proj-1", "task-1",
            assigneeId="user-1",
            collaboratorsIds=[],
            dueDate=tomorrow_date.isoformat()
        )

        deadline_notifications.check_and_create_deadline_notifications()

        # Should create notification for assignee only
        assert mock_add_notification.call_count == 1

    def test_project_without_name(self, fake_db, mock_add_notification):
        """Test project without name field"""
        fake_db.collection("projects").document("proj-1").set({
            "teamIds": ["user-1"],
        })

        tomorrow = dt.datetime.utcnow() + dt.timedelta(days=1)
        tomorrow_date = tomorrow.replace(hour=0, minute=0, second=0, microsecond=0)

        _create_task(
            fake_db, "proj-1", "task-1",
            assigneeId="user-1",
            dueDate=tomorrow_date.isoformat()
        )

        deadline_notifications.check_and_create_deadline_notifications()

        # Should use default project name
        call_args = mock_add_notification.call_args
        project_name = call_args[0][1]
        assert project_name == "Unknown Project"

    def test_notification_data_includes_all_fields(self, fake_db, mock_add_notification):
        """Test that notification includes all required fields"""
        _create_project(fake_db, "proj-1", "Complete Project")

        tomorrow = dt.datetime.utcnow() + dt.timedelta(days=1)
        tomorrow_date = tomorrow.replace(hour=0, minute=0, second=0, microsecond=0)

        _create_task(
            fake_db, "proj-1", "task-1",
            title="Complete Task",
            description="Full description",
            assigneeId="user-1",
            priority=8,
            status="in progress",
            dueDate=tomorrow_date.isoformat()
        )

        deadline_notifications.check_and_create_deadline_notifications()

        call_args = mock_add_notification.call_args
        notif_data = call_args[0][0]

        # Verify all fields present
        assert "projectId" in notif_data
        assert "projectName" in notif_data
        assert "taskId" in notif_data
        assert "title" in notif_data
        assert "description" in notif_data
        assert "userId" in notif_data
        assert "dueDate" in notif_data
        assert "priority" in notif_data
        assert "status" in notif_data
        assert "type" in notif_data
        assert "message" in notif_data
        assert "icon" in notif_data


class TestMainExecution:
    """Test main script execution"""

    def test_main_execution(self, fake_db, mock_add_notification):
        """Test that main execution works"""
        _create_project(fake_db, "proj-1")

        tomorrow = dt.datetime.utcnow() + dt.timedelta(days=1)
        tomorrow_date = tomorrow.replace(hour=0, minute=0, second=0, microsecond=0)

        _create_task(
            fake_db, "proj-1", "task-1",
            assigneeId="user-1",
            dueDate=tomorrow_date.isoformat()
        )

        # Should execute without errors
        deadline_notifications.check_and_create_deadline_notifications()

        assert mock_add_notification.call_count >= 1
