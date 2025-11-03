# back-end/tests/test_project_progress_integration.py
"""
Integration tests for project progress bar behaviour via REST API.
Covers Scrum-324.1 – Scrum-324.8
"""

import os
import sys
import pytest
from datetime import datetime, timezone

# Ensure the back-end folder is on the import path
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from app import app as flask_app  # noqa: E402
import projects  # noqa: E402
from fake_firestore import FakeFirestore  # noqa: E402


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
class TestProjectProgressIntegration:
    @pytest.fixture
    def project_setup(self, test_client):
        client, fake_db = test_client
        # Create project
        resp = client.post("/api/projects/", json={"name": "Testing Project", "ownerId": "user-1"})
        assert resp.status_code == 201
        project = resp.get_json()
        pid = project["id"]

        # Add baseline tasks with assigneeId
        tasks = [
            {"title": "Task A", "status": "to-do", "assigneeId": "user-1"},
            {"title": "Task B", "status": "in-progress", "assigneeId": "user-1"},
            {"title": "Task C", "status": "completed", "assigneeId": "user-1"},
        ]
        for t in tasks:
            r = client.post(f"/api/projects/{pid}/tasks", json={
                **t, 
                "userId": "user-1", 
                "dueDate": datetime(2024, 11, 15, tzinfo=timezone.utc).isoformat()
            })
            assert r.status_code == 201, f"Failed to create task: {r.get_json()}"
        
        return client, pid

    # Scrum-324.1 – Progress shown on load
    def test_progress_shown_on_load_formula_check(self, project_setup):
        client, pid = project_setup
        r = client.get(f"/api/projects/{pid}")
        assert r.status_code == 200
        data = r.get_json()
        assert "progress" in data
        # 1 completed out of 3 tasks = 33%
        assert data["progress"] == 33

    # Scrum-324.2 – Recalculate on new task created
    def test_progress_recalculate_on_new_task(self, project_setup):
        client, pid = project_setup
        r = client.get(f"/api/projects/{pid}")
        base = int(r.get_json().get("progress", 0))  # Should be 33%
        
        # Add new task
        client.post(f"/api/projects/{pid}/tasks", json={
            "title": "Task D", 
            "status": "to-do", 
            "assigneeId": "user-1",
            "userId": "user-1"
        })
        
        r = client.get(f"/api/projects/{pid}")
        # Now 1 completed out of 4 tasks = 25%
        assert int(r.get_json().get("progress", 0)) == 25

    # Scrum-324.3 – Recalculate on status change
    def test_progress_recalculate_on_status_change(self, project_setup):
        client, pid = project_setup
        
        # Get tasks with proper error handling
        r = client.get(f"/api/projects/{pid}/tasks?userId=user-1")
        assert r.status_code == 200, f"Failed to get tasks: {r.get_json()}"
        tasks = r.get_json()
        assert isinstance(tasks, list), f"Expected list but got: {type(tasks)} - {tasks}"
        
        # Find a to-do task
        todo_task = None
        for task in tasks:
            if task.get("status") == "to-do":
                todo_task = task
                break
        
        assert todo_task is not None, f"No to-do task found in: {tasks}"
        tid = todo_task["id"]
        
        # Change to-do task to completed
        patch_resp = client.patch(f"/api/projects/{pid}/tasks/{tid}", json={"status": "completed"})
        assert patch_resp.status_code == 200, f"Failed to update task: {patch_resp.get_json()}"
        
        r = client.get(f"/api/projects/{pid}")
        # Now 2 completed out of 3 tasks = 67%
        assert int(r.get_json().get("progress", 0)) == 67

    # Scrum-324.4 – Display whole number
    def test_progress_display_is_whole_number(self, project_setup):
        client, pid = project_setup
        r = client.get(f"/api/projects/{pid}")
        progress = r.get_json().get("progress", 0)
        assert isinstance(progress, int)  # Must be integer, not float

    # Scrum-324.5 – Zero tasks project shows 0%
    def test_progress_zero_tasks(self, test_client):
        client, _ = test_client
        r = client.post("/api/projects/", json={"name": "Empty Project", "ownerId": "user-1"})
        pid = r.get_json()["id"]
        r = client.get(f"/api/projects/{pid}")
        assert int(r.get_json().get("progress", 0)) == 0

    # Scrum-324.6 – All complete shows 100%
    def test_progress_full_completion(self, test_client):
        client, _ = test_client
        r = client.post("/api/projects/", json={"name": "Full Project", "ownerId": "user-1"})
        pid = r.get_json()["id"]
        
        # Create 4 completed tasks
        for i in range(4):
            rr = client.post(f"/api/projects/{pid}/tasks", json={
                "title": f"Done {i}", 
                "status": "completed", 
                "assigneeId": "user-1",
                "userId": "user-1",
                "dueDate": datetime(2024, 11, 15, tzinfo=timezone.utc).isoformat()
            })
            assert rr.status_code == 201
        
        r = client.get(f"/api/projects/{pid}")
        assert int(r.get_json().get("progress", 0)) == 100

    # Scrum-324.7 – Negative: Non-complete status should not increase progress
    def test_progress_unchanged_on_non_complete_status(self, project_setup):
        client, pid = project_setup
        r = client.get(f"/api/projects/{pid}")
        base = int(r.get_json().get("progress", 0))
        
        # Get tasks with proper error handling
        r = client.get(f"/api/projects/{pid}/tasks?userId=user-1")
        assert r.status_code == 200, f"Failed to get tasks: {r.get_json()}"
        tasks = r.get_json()
        assert isinstance(tasks, list), f"Expected list but got: {type(tasks)} - {tasks}"
        
        # Find a to-do task
        todo_task = None
        for task in tasks:
            if task.get("status") == "to-do":
                todo_task = task
                break
        
        assert todo_task is not None, f"No to-do task found in: {tasks}"
        tid = todo_task["id"]
        
        # Change to in-progress (should not increase completed count)
        client.patch(f"/api/projects/{pid}/tasks/{tid}", json={"status": "in-progress"})
        
        r = client.get(f"/api/projects/{pid}")
        assert int(r.get_json().get("progress", 0)) == base

    # Scrum-324.8 – Negative: Verify progress doesn't change on actual failure
    def test_progress_task_creation_failure_does_not_change_progress(self, monkeypatch, project_setup):
        client, pid = project_setup
        r = client.get(f"/api/projects/{pid}")
        base = int(r.get_json().get("progress", 0))

        # Try to create a task with invalid data that should fail
        resp = client.post(f"/api/projects/{pid}/tasks", json={
            "title": "",  # Empty title should be handled gracefully
            "status": "invalid-status",  # This will be normalized to "to-do"
            # Missing assigneeId - this should cause a 400 error
        })
        
        # Should get a client error (400) due to missing assigneeId
        assert resp.status_code == 400
        
        # Progress should remain unchanged since task creation failed
        r = client.get(f"/api/projects/{pid}")
        assert int(r.get_json().get("progress", 0)) == base
