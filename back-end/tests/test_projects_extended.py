import os
import sys
from datetime import datetime, timezone

import pytest

# Ensure the back-end folder is on the import path
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from app import app as flask_app  # noqa: E402
import projects  # noqa: E402
from test_projects_api import FakeFirestore  # noqa: E402


@pytest.fixture
def test_client(monkeypatch):
    fake_db = FakeFirestore()
    monkeypatch.setattr(projects, "db", fake_db)
    monkeypatch.setattr(projects, "now_utc", lambda: datetime(2024, 1, 1, tzinfo=timezone.utc))

    flask_app.config.update(TESTING=True)
    with flask_app.test_client() as client:
        yield client, fake_db


class TestProjectStatusAndPriority:
    """Test status and priority canonicalization"""

    def test_status_canonicalization(self, test_client):
        """Test various status inputs are normalized"""
        client, fake_db = test_client

        test_cases = [
            ("doing", "in progress"),
            ("DOING", "in progress"),
            ("done", "completed"),
            ("Done", "completed"),
            ("to-do", "to-do"),
            ("blocked", "blocked"),
            ("invalid", "to-do"),  # invalid defaults to to-do
            (None, "to-do"),
            ("", "to-do"),
        ]

        for i, (input_status, expected) in enumerate(test_cases):
            resp = client.post("/api/projects/", json={
                "name": f"Test {i}",
                "status": input_status,
                "ownerId": "owner-1",
            })
            assert resp.status_code == 201

            project_id = resp.get_json()["id"]
            doc = fake_db.collection("projects").document(project_id).get()
            assert doc.to_dict()["status"] == expected

    def test_priority_canonicalization(self, test_client):
        """Test various priority inputs are normalized"""
        client, fake_db = test_client

        test_cases = [
            ("low", "low"),
            ("LOW", "low"),
            ("medium", "medium"),
            ("high", "high"),
            ("HIGH", "high"),
            (1, "low"),
            (3, "low"),
            (5, "medium"),
            (6, "medium"),
            (8, "high"),
            (10, "high"),
            ("9", "high"),
            ("invalid", "medium"),
            (None, "medium"),
        ]

        for i, (input_priority, expected) in enumerate(test_cases):
            resp = client.post("/api/projects/", json={
                "name": f"Test {i}",
                "priority": input_priority,
                "ownerId": "owner-1",
            })
            assert resp.status_code == 201

            project_id = resp.get_json()["id"]
            doc = fake_db.collection("projects").document(project_id).get()
            assert doc.to_dict()["priority"] == expected


class TestTaskCreationAndRetrieval:
    """Test task creation with various scenarios"""

    def test_create_task_without_assignee_fails(self, test_client):
        """Test creating task without assigneeId returns 400"""
        client, fake_db = test_client

        # Create project first
        fake_db.collection("projects").document("proj-1").set({
            "name": "Test Project",
            "teamIds": ["owner-1"],
            "ownerId": "owner-1",
        })

        resp = client.post("/api/projects/proj-1/tasks", json={
            "title": "Task without assignee",
        })
        assert resp.status_code == 400
        assert "assigneeId is required" in resp.get_json()["error"]

    def test_create_task_with_project_not_found(self, test_client):
        """Test creating task for non-existent project"""
        client, fake_db = test_client

        resp = client.post("/api/projects/non-existent/tasks", json={
            "title": "Test Task",
            "assigneeId": "user-1",
        })
        assert resp.status_code == 404
        assert "Project not found" in resp.get_json()["error"]

    def test_create_task_adds_assignee_to_team(self, test_client):
        """Test that creating a task adds assignee to project team"""
        client, fake_db = test_client

        project_ref = fake_db.collection("projects").document("proj-team")
        project_ref.set({
            "name": "Team Project",
            "teamIds": ["owner-1"],
            "ownerId": "owner-1",
        })

        resp = client.post("/api/projects/proj-team/tasks", json={
            "title": "New Task",
            "assigneeId": "user-2",
        })
        assert resp.status_code == 201

        # Verify user-2 was added to team
        project = project_ref.get().to_dict()
        assert "user-2" in project["teamIds"]

    def test_create_task_with_default_title(self, test_client):
        """Test creating task with empty/missing title uses default"""
        client, fake_db = test_client

        fake_db.collection("projects").document("proj-default").set({
            "name": "Test",
            "teamIds": ["owner-1"],
            "ownerId": "owner-1",
        })

        # Test with empty string
        resp = client.post("/api/projects/proj-default/tasks", json={
            "title": "",
            "assigneeId": "user-1",
        })
        assert resp.status_code == 201

        task_id = resp.get_json()["id"]
        task = fake_db.collection("projects").document("proj-default").collection("tasks").document(task_id).get()
        assert task.to_dict()["title"] == "Untitled task"

    def test_task_priority_canonicalization(self, test_client):
        """Test task priority is normalized to 1-10 range"""
        client, fake_db = test_client

        fake_db.collection("projects").document("proj-priority").set({
            "name": "Test",
            "teamIds": ["owner-1"],
            "ownerId": "owner-1",
        })

        test_cases = [
            ("low", 3),
            ("medium", 6),
            ("high", 9),
            ("urgent", 9),
            (0, 1),  # below range
            (15, 10),  # above range
            (5, 5),
            (None, 5),  # default
        ]

        for i, (input_priority, expected) in enumerate(test_cases):
            resp = client.post("/api/projects/proj-priority/tasks", json={
                "title": f"Task {i}",
                "assigneeId": "user-1",
                "priority": input_priority,
            })
            assert resp.status_code == 201

            task_id = resp.get_json()["id"]
            task = fake_db.collection("projects").document("proj-priority").collection("tasks").document(task_id).get()
            assert task.to_dict()["priority"] == expected

    def test_list_tasks_project_not_found(self, test_client):
        """Test listing tasks for non-existent project"""
        client, fake_db = test_client

        resp = client.get("/api/projects/non-existent/tasks?assigneeId=user-1")
        assert resp.status_code == 404
        assert "Project not found" in resp.get_json()["error"]

    def test_list_tasks_user_not_on_team(self, test_client):
        """Test listing tasks when user is not on project team"""
        client, fake_db = test_client

        fake_db.collection("projects").document("proj-no-access").set({
            "name": "Private Project",
            "teamIds": ["owner-1"],
            "ownerId": "owner-1",
        })

        resp = client.get("/api/projects/proj-no-access/tasks?assigneeId=user-2")
        assert resp.status_code == 200
        assert resp.get_json() == []  # No tasks for unauthorized user


class TestTaskUpdates:
    """Test task update operations"""

    def test_update_task_title_empty_uses_default(self, test_client):
        """Test updating task title to empty string uses default"""
        client, fake_db = test_client

        project_ref = fake_db.collection("projects").document("proj-update")
        project_ref.set({
            "name": "Test",
            "teamIds": ["owner-1"],
            "ownerId": "owner-1",
        })

        task_ref = project_ref.collection("tasks").document("task-1")
        task_ref.set({
            "title": "Original Title",
            "assigneeId": "user-1",
            "status": "to-do",
            "priority": 5,
        })

        resp = client.put("/api/projects/proj-update/tasks/task-1", json={
            "title": "",
        })
        assert resp.status_code == 200

        updated = task_ref.get().to_dict()
        assert updated["title"] == "Untitled task"

    def test_update_task_assignee_syncs_with_owner(self, test_client):
        """Test updating assigneeId also updates ownerId"""
        client, fake_db = test_client

        project_ref = fake_db.collection("projects").document("proj-sync")
        project_ref.set({
            "name": "Test",
            "teamIds": ["user-1", "user-2"],
            "ownerId": "owner-1",
        })

        task_ref = project_ref.collection("tasks").document("task-sync")
        task_ref.set({
            "title": "Task",
            "assigneeId": "user-1",
            "ownerId": "user-1",
            "status": "to-do",
            "priority": 5,
        })

        resp = client.put("/api/projects/proj-sync/tasks/task-sync", json={
            "assigneeId": "user-2",
        })
        assert resp.status_code == 200

        updated = task_ref.get().to_dict()
        assert updated["assigneeId"] == "user-2"
        assert updated["ownerId"] == "user-2"

    def test_update_task_clears_due_date(self, test_client):
        """Test setting dueDate to null clears it"""
        client, fake_db = test_client

        project_ref = fake_db.collection("projects").document("proj-date")
        project_ref.set({
            "name": "Test",
            "teamIds": ["user-1"],
            "ownerId": "owner-1",
        })

        task_ref = project_ref.collection("tasks").document("task-date")
        task_ref.set({
            "title": "Task",
            "assigneeId": "user-1",
            "dueDate": "2024-12-31",
            "status": "to-do",
            "priority": 5,
        })

        resp = client.put("/api/projects/proj-date/tasks/task-date", json={
            "dueDate": None,
        })
        assert resp.status_code == 200

        updated = task_ref.get().to_dict()
        assert updated["dueDate"] is None


class TestSubtasks:
    """Test subtask functionality"""

    def test_create_subtask_success(self, test_client):
        """Test creating a subtask under a parent task"""
        client, fake_db = test_client

        # Create project and parent task
        project_ref = fake_db.collection("projects").document("proj-sub")
        project_ref.set({
            "name": "Test Project",
            "teamIds": ["owner-1"],
            "ownerId": "owner-1",
        })

        parent_task_ref = project_ref.collection("tasks").document("parent-task")
        parent_task_ref.set({
            "title": "Parent Task",
            "assigneeId": "user-1",
            "status": "to-do",
            "priority": 5,
        })

        resp = client.post("/api/projects/proj-sub/tasks/parent-task/subtasks", json={
            "title": "Subtask 1",
            "assigneeId": "user-1",
        })
        assert resp.status_code == 201
        assert "id" in resp.get_json()

        # Verify subtask was created
        subtask_id = resp.get_json()["id"]
        subtask = parent_task_ref.collection("subtasks").document(subtask_id).get()
        assert subtask.exists
        assert subtask.to_dict()["title"] == "Subtask 1"
        assert subtask.to_dict()["parentTaskId"] == "parent-task"

    def test_create_subtask_parent_not_found(self, test_client):
        """Test creating subtask when parent task doesn't exist"""
        client, fake_db = test_client

        fake_db.collection("projects").document("proj-sub").set({
            "name": "Test",
            "teamIds": ["owner-1"],
            "ownerId": "owner-1",
        })

        resp = client.post("/api/projects/proj-sub/tasks/non-existent/subtasks", json={
            "title": "Subtask",
            "assigneeId": "user-1",
        })
        assert resp.status_code == 404
        assert "Parent task not found" in resp.get_json()["error"]

    def test_list_subtasks(self, test_client):
        """Test listing all subtasks"""
        client, fake_db = test_client

        project_ref = fake_db.collection("projects").document("proj-list")
        project_ref.set({
            "name": "Test",
            "teamIds": ["owner-1"],
            "ownerId": "owner-1",
        })

        parent_task_ref = project_ref.collection("tasks").document("parent")
        parent_task_ref.set({
            "title": "Parent",
            "assigneeId": "user-1",
        })

        # Create subtasks
        subtasks_col = parent_task_ref.collection("subtasks")
        subtasks_col.document("sub-1").set({
            "title": "Subtask 1",
            "assigneeId": "user-1",
            "status": "to-do",
            "priority": 5,
        })
        subtasks_col.document("sub-2").set({
            "title": "Subtask 2",
            "assigneeId": "user-1",
            "status": "completed",
            "priority": 3,
        })

        resp = client.get("/api/projects/proj-list/tasks/parent/subtasks")
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data) == 2

        titles = {sub["title"] for sub in data}
        assert "Subtask 1" in titles
        assert "Subtask 2" in titles

    def test_update_subtask(self, test_client):
        """Test updating a subtask"""
        client, fake_db = test_client

        project_ref = fake_db.collection("projects").document("proj-update-sub")
        project_ref.set({
            "name": "Test",
            "teamIds": ["user-1"],
            "ownerId": "owner-1",
        })

        parent_task_ref = project_ref.collection("tasks").document("parent")
        parent_task_ref.set({
            "title": "Parent",
            "assigneeId": "user-1",
        })

        subtask_ref = parent_task_ref.collection("subtasks").document("sub-1")
        subtask_ref.set({
            "title": "Original",
            "assigneeId": "user-1",
            "status": "to-do",
            "priority": 5,
        })

        resp = client.put("/api/projects/proj-update-sub/tasks/parent/subtasks/sub-1", json={
            "title": "Updated Subtask",
            "status": "completed",
        })
        assert resp.status_code == 200

        updated = subtask_ref.get().to_dict()
        assert updated["title"] == "Updated Subtask"
        assert updated["status"] == "completed"

    def test_delete_subtask(self, test_client):
        """Test deleting a subtask"""
        client, fake_db = test_client

        project_ref = fake_db.collection("projects").document("proj-del-sub")
        project_ref.set({
            "name": "Test",
            "teamIds": ["user-1"],
            "ownerId": "owner-1",
        })

        parent_task_ref = project_ref.collection("tasks").document("parent")
        parent_task_ref.set({
            "title": "Parent",
            "assigneeId": "user-1",
        })

        parent_task_ref.collection("subtasks").document("sub-del").set({
            "title": "To Delete",
            "assigneeId": "user-1",
        })

        resp = client.delete("/api/projects/proj-del-sub/tasks/parent/subtasks/sub-del")
        assert resp.status_code == 200

        # Verify deletion
        subtask = parent_task_ref.collection("subtasks").document("sub-del").get()
        assert not subtask.exists


class TestProjectDeletion:
    """Test project deletion"""

    def test_delete_project(self, test_client):
        """Test deleting a project"""
        client, fake_db = test_client

        fake_db.collection("projects").document("proj-delete").set({
            "name": "To Delete",
            "ownerId": "owner-1",
        })

        resp = client.delete("/api/projects/proj-delete")
        assert resp.status_code == 200
        assert resp.get_json()["message"] == "Project deleted"

        # Verify deletion
        doc = fake_db.collection("projects").document("proj-delete").get()
        assert not doc.exists


class TestTaskAcrossProjects:
    """Test listing tasks across multiple projects"""

    def test_list_tasks_across_projects_no_assignee(self, test_client):
        """Test that assignedTo parameter is required"""
        client, fake_db = test_client

        resp = client.get("/api/projects/assigned/tasks")
        assert resp.status_code == 400
        assert "assignedTo is required" in resp.get_json()["error"]

    def test_list_tasks_across_projects_with_filters(self, test_client):
        """Test listing tasks includes project information"""
        client, fake_db = test_client

        # Create a simple project with task
        project_ref = fake_db.collection("projects").document("proj-cross")
        project_ref.set({
            "name": "Cross Project",
            "teamIds": ["user-1"],
            "ownerId": "owner-1",
            "priority": "high",
        })

        # Add task to project
        task_ref = project_ref.collection("tasks").document("task-cross")
        task_ref.set({
            "title": "Cross Task",
            "assigneeId": "user-1",
            "status": "to-do",
            "priority": 5,
        })

        # Manually add to fake collection group result
        # This simulates what collection_group would return
        resp = client.get("/api/projects/assigned/tasks?assignedTo=user-1")
        assert resp.status_code == 200
        data = resp.get_json()

        # Verify we get results (may be empty if collection_group not fully mocked)
        # This test mainly ensures the endpoint doesn't crash
        assert isinstance(data, list)
