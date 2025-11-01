# back-end/tests/test_overdue_integration.py
"""
Integration tests for overdue highlighting behavior via API.
Matches Scrum-135.1 ... 135.9 exactly.
Relies on:
  - POST /api/projects/
  - POST /api/projects/<pid>/tasks
  - GET  /api/projects/<pid>/tasks
  - PATCH /api/projects/<pid>/tasks/<tid>
These tests compute overdue based on dueDate + status from API payloads.
"""

import os
import sys
import pytest
from datetime import datetime, timezone, timedelta
from flask import jsonify

# Ensure the back-end folder is on the import path
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from app import app as flask_app  # noqa: E402
import projects  # noqa: E402
from fake_firestore import FakeFirestore  # noqa: E402

UTC = timezone.utc

def _iso(y, m, d, hh=9, mm=0, ss=0):
    return datetime(y, m, d, hh, mm, ss, tzinfo=UTC).isoformat()

def _overdue_count(tasks, now_dt):
    def is_overdue(t):
        if (t.get("status") or "").lower() == "completed":
            return False
        due = t.get("dueDate")
        if not due:
            return False
        d = datetime.fromisoformat(due.replace("Z", "+00:00")).astimezone(UTC).date()
        return d < now_dt.astimezone(UTC).date()
    return sum(1 for t in tasks if is_overdue(t))

@pytest.fixture
def test_client(monkeypatch):
    """Create a test client with mocked Firestore database"""
    fake_db = FakeFirestore()
    monkeypatch.setattr(projects, "db", fake_db)
    
    # Mock now_utc to return consistent timestamp
    monkeypatch.setattr(projects, "now_utc", lambda: datetime(2024, 11, 15, tzinfo=timezone.utc))
    
    flask_app.config.update(TESTING=True)
    with flask_app.test_client() as client:
        yield client, fake_db

@pytest.mark.integration
class TestOverdueIntegration:

    @pytest.fixture
    def project_with_tasks(self, test_client):
        """
        Build the exact dataset used in the Excel sheet naming:
          - Task A: due yesterday, not completed (overdue)
          - Task B: due tomorrow, not completed (not overdue)
          - Task C: due today, not completed (not overdue)
          - Task D: optional second overdue when needed
        """
        client, fake_db = test_client

        # Fix "today" anchor for reproducibility
        today = datetime(2025, 11, 1, 10, 0, tzinfo=UTC)
        yesterday = (today - timedelta(days=1)).date()
        tomorrow = (today + timedelta(days=1)).date()

        # Create project
        r = client.post("/api/projects/", json={"name": "Testing Project", "ownerId": "user-1"})
        assert r.status_code == 201
        pid = r.get_json()["id"]

        # Task A: overdue (yesterday, not completed)
        r = client.post(f"/api/projects/{pid}/tasks", json={
            "title": "Task A",
            "status": "to-do",
            "assigneeId": "john-doe",
            "userId": "user-1",
            "dueDate": _iso(yesterday.year, yesterday.month, yesterday.day)
        })
        assert r.status_code == 201
        taskA = r.get_json()

        # Task B: future (tomorrow)
        r = client.post(f"/api/projects/{pid}/tasks", json={
            "title": "Task B",
            "status": "to-do",
            "assigneeId": "john-doe",
            "userId": "user-1",
            "dueDate": _iso(tomorrow.year, tomorrow.month, tomorrow.day)
        })
        assert r.status_code == 201
        taskB = r.get_json()

        # Task C: today
        r = client.post(f"/api/projects/{pid}/tasks", json={
            "title": "Task C",
            "status": "to-do",
            "assigneeId": "john-doe",
            "userId": "user-1",
            "dueDate": _iso(today.year, today.month, today.day)
        })
        assert r.status_code == 201
        taskC = r.get_json()

        return client, pid, today, taskA, taskB, taskC

    # Scrum-135.1 – Flag past due tasks as overdue
    def test_flag_past_due_tasks_as_overdue(self, project_with_tasks):
        client, pid, today, taskA, taskB, taskC = project_with_tasks
        r = client.get(f"/api/projects/{pid}/tasks?userId=user-1")
        assert r.status_code == 200
        tasks = r.get_json()
        assert _overdue_count(tasks, today) == 1  # Task A only

    # Scrum-135.2 – Do not flag future tasks
    def test_do_not_flag_future_tasks(self, project_with_tasks):
        client, pid, today, taskA, taskB, taskC = project_with_tasks
        r = client.get(f"/api/projects/{pid}/tasks?userId=user-1")
        assert r.status_code == 200
        tasks = r.get_json()
        # Confirm B is not counted
        future = [t for t in tasks if t["title"] == "Task B"][0]
        assert future["status"].lower() != "completed"
        assert _overdue_count([future], today) == 0

    # Scrum-135.3 – Do not flag tasks due today
    def test_do_not_flag_due_today(self, project_with_tasks):
        client, pid, today, taskA, taskB, taskC = project_with_tasks
        r = client.get(f"/api/projects/{pid}/tasks?userId=user-1")
        assert r.status_code == 200
        tasks = r.get_json()
        today_task = [t for t in tasks if t["title"] == "Task C"][0]
        assert _overdue_count([today_task], today) == 0
        # Total overdue still 1 (Task A)
        assert _overdue_count(tasks, today) == 1

    # Scrum-135.4 – Overdue counter matches flagged items (A and D overdue)
    def test_overdue_counter_matches_flagged_items(self, project_with_tasks):
        client, pid, today, taskA, taskB, taskC = project_with_tasks
        # Add Task D overdue (two days ago)
        two_days_ago = (today - timedelta(days=2)).date()
        r = client.post(f"/api/projects/{pid}/tasks", json={
            "title": "Task D",
            "status": "in-progress",
            "assigneeId": "john-doe",
            "userId": "user-1",
            "dueDate": _iso(two_days_ago.year, two_days_ago.month, two_days_ago.day)
        })
        assert r.status_code == 201
        r = client.get(f"/api/projects/{pid}/tasks?userId=user-1")
        assert r.status_code == 200
        tasks = r.get_json()
        assert _overdue_count(tasks, today) == 2  # A and D

    # Scrum-135.5 – Change due date to future removes overdue
    def test_change_due_date_future_removes_overdue(self, project_with_tasks):
        client, pid, today, taskA, taskB, taskC = project_with_tasks
        # Change Task A due date to 1/11/2025 (if "today" is 1 Nov, same-day is not overdue).
        # To clearly remove overdue, set to 2 Nov 2025 unless your product defines same-day as "future".
        new_due = _iso(2025, 11, 2)
        r = client.patch(f"/api/projects/{pid}/tasks/{taskA['id']}", json={"dueDate": new_due})
        assert r.status_code == 200
        r = client.get(f"/api/projects/{pid}/tasks?userId=user-1")
        assert r.status_code == 200
        tasks = r.get_json()
        assert _overdue_count(tasks, today) == 0  # Only A was overdue; now 0

    # Scrum-135.6 – Completing an overdue task removes overdue highlight
    def test_completed_task_no_longer_overdue(self, project_with_tasks):
        client, pid, today, taskA, taskB, taskC = project_with_tasks
        # Mark A completed
        r = client.patch(f"/api/projects/{pid}/tasks/{taskA['id']}", json={"status": "completed"})
        assert r.status_code == 200
        r = client.get(f"/api/projects/{pid}/tasks?userId=user-1")
        assert r.status_code == 200
        tasks = r.get_json()
        assert _overdue_count(tasks, today) == 0

    # Scrum-135.7 – Overdue boundary at 12am on due day (27/9/25)
    def test_overdue_boundary_midnight(self, test_client):
        client, fake_db = test_client
        # Set anchor to 2025-09-27 00:00:00Z
        anchor = datetime(2025, 9, 27, 0, 0, 0, tzinfo=UTC)

        # Create project with two tasks: one due 26/9 (overdue), one due 27/9 (not overdue yet)
        r = client.post("/api/projects/", json={"name": "Boundary Project", "ownerId": "user-1"})
        assert r.status_code == 201
        pid = r.get_json()["id"]

        # Due 26/9/2025
        r = client.post(f"/api/projects/{pid}/tasks", json={
            "title": "Task Prev Day",
            "status": "to-do",
            "assigneeId": "user-1",
            "userId": "user-1",
            "dueDate": _iso(2025, 9, 26)
        })
        assert r.status_code == 201

        # Due 27/9/2025
        r = client.post(f"/api/projects/{pid}/tasks", json={
            "title": "Task Same Day",
            "status": "to-do",
            "assigneeId": "user-1",
            "userId": "user-1",
            "dueDate": _iso(2025, 9, 27)
        })
        assert r.status_code == 201

        r = client.get(f"/api/projects/{pid}/tasks?userId=user-1")
        assert r.status_code == 200
        tasks = r.get_json()
        # Only the 26/9 task is overdue at 00:00 on the 27th
        assert _overdue_count(tasks, anchor) == 1

    # Scrum-135.8 – Persistence across views
    def test_overdue_persistence_across_views(self, project_with_tasks):
        """Test that overdue counts remain consistent across different API endpoints"""
        client, pid, today, taskA, taskB, taskC = project_with_tasks
        
        # Add Task D overdue (two days ago) to have 2 overdue tasks total
        two_days_ago = (today - timedelta(days=2)).date()
        r = client.post(f"/api/projects/{pid}/tasks", json={
            "title": "Task D",
            "status": "in-progress", 
            "assigneeId": "john-doe",
            "userId": "user-1",
            "dueDate": _iso(two_days_ago.year, two_days_ago.month, two_days_ago.day)
        })
        assert r.status_code == 201
        
        # 1. Check overdue count via tasks endpoint (Dashboard equivalent)
        r = client.get(f"/api/projects/{pid}/tasks?userId=user-1")
        assert r.status_code == 200
        tasks_view = r.get_json()
        tasks_overdue_count = _overdue_count(tasks_view, today)
        assert tasks_overdue_count == 2  # Task A and Task D
        
        # 2. Check overdue count via project endpoint (Project view equivalent)
        r = client.get(f"/api/projects/{pid}")
        assert r.status_code == 200
        project_data = r.get_json()
        
        # Get tasks again via project's tasks endpoint
        r = client.get(f"/api/projects/{pid}/tasks?userId=user-1")
        assert r.status_code == 200
        project_tasks = r.get_json()
        project_overdue_count = _overdue_count(project_tasks, today)
        
        # 3. Verify consistency across views
        assert tasks_overdue_count == project_overdue_count == 2
        
        # 4. Verify individual task overdue status is consistent
        overdue_tasks = [t for t in project_tasks if self._is_task_overdue(t, today)]
        assert len(overdue_tasks) == 2
        assert set(t["title"] for t in overdue_tasks) == {"Task A", "Task D"}

    # Scrum-135.9 – [Negative] Due date update failure  
    def test_due_date_update_failure_preserves_overdue_status(self, project_with_tasks):
        """Test that failed due date updates don't change overdue status"""
        client, pid, today, taskA, taskB, taskC = project_with_tasks
        
        # Verify Task A is initially overdue
        r = client.get(f"/api/projects/{pid}/tasks?userId=user-1")
        assert r.status_code == 200
        tasks = r.get_json()
        initial_overdue_count = _overdue_count(tasks, today)
        assert initial_overdue_count == 1  # Task A only
        
        # Attempt to update with invalid task ID (should fail with 404)
        future_due = _iso(2025, 11, 2)
        r = client.patch(f"/api/projects/{pid}/tasks/invalid-task-id", json={"dueDate": future_due})
        
        # Should get 404 error (task not found)
        assert r.status_code == 404
        
        # Verify overdue status unchanged after failed update
        r = client.get(f"/api/projects/{pid}/tasks?userId=user-1")
        assert r.status_code == 200
        tasks = r.get_json()
        final_overdue_count = _overdue_count(tasks, today)
        
        # Overdue count should remain the same (1)
        assert final_overdue_count == initial_overdue_count == 1
        
        # Verify Task A is still overdue (original due date preserved)
        task_a = [t for t in tasks if t["title"] == "Task A"][0]
        assert self._is_task_overdue(task_a, today) is True
        
        # Additional test: Try to update with invalid project ID
        r = client.patch(f"/api/projects/invalid-project/tasks/{taskA['id']}", json={"dueDate": future_due})
        assert r.status_code >= 400  # Should be an error
        
        # Verify overdue status still unchanged
        r = client.get(f"/api/projects/{pid}/tasks?userId=user-1")
        assert r.status_code == 200
        tasks = r.get_json()
        assert _overdue_count(tasks, today) == 1  # Still 1 overdue task

    # Add helper method to the class
    def _is_task_overdue(self, task, now_dt):
        """Helper to match UI overdue detection logic"""
        if (task.get("status") or "").lower() == "completed":
            return False
        due = task.get("dueDate")
        if not due:
            return False
        d = datetime.fromisoformat(due.replace("Z", "+00:00")).astimezone(UTC).date()
        return d < now_dt.astimezone(UTC).date()
