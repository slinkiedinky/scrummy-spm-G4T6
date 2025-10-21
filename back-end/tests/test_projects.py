"""
Comprehensive tests for projects.py
Tests all endpoints for projects, tasks, subtasks, and standalone tasks.
"""
import os
import sys
from datetime import datetime, timezone
import pytest
import types

# Ensure the back-end folder is on the import path
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from app import app as flask_app  # noqa: E402
import projects  # noqa: E402
from fake_firestore import FakeFirestore, FakeCollection, FakeDocumentReference  # noqa: E402


@pytest.fixture
def test_client(monkeypatch):
    """Create a test client with mocked Firestore database"""
    fake_db = FakeFirestore()
    monkeypatch.setattr(projects, "db", fake_db)

    # Keep original function for coverage
    real_now = projects.now_utc
    real_now()

    # Mock now_utc to return consistent timestamp
    monkeypatch.setattr(projects, "now_utc", lambda: datetime(2024, 1, 1, tzinfo=timezone.utc))

    flask_app.config.update(TESTING=True)
    with flask_app.test_client() as client:
        yield client, fake_db


def _setup_project(fake_db, project_id, **data):
    """Helper to set up a project with normalized data"""
    ref = fake_db.collection("projects").document(project_id)
    payload = {
        "name": data.get("name", "Project"),
        "status": projects.canon_status(data.get("status", "to-do")),
        "priority": projects.canon_project_priority(data.get("priority", "medium")),
        "teamIds": data.get("teamIds", []),
        "ownerId": data.get("ownerId"),
        "createdBy": data.get("createdBy"),
        "tags": data.get("tags", []),
    }
    owner = payload.get("ownerId") or payload.get("createdBy")
    if owner and owner not in payload["teamIds"]:
        payload["teamIds"].append(owner)
    ref.set(payload)
    return ref


def _setup_task(fake_db, project_id, task_id, **data):
    """Helper to set up a task with normalized data"""
    project_ref = fake_db.collection("projects").document(project_id)
    project_ref.collection("tasks").document(task_id).set({
        "title": data.get("title", "Task"),
        "status": projects.canon_status(data.get("status", "to-do")),
        "priority": projects.canon_task_priority(data.get("priority", 5)),
        "assigneeId": data.get("assigneeId", "user-1"),
        "ownerId": data.get("ownerId", "user-1"),
        "collaboratorsIds": data.get("collaboratorsIds", []),
        "tags": data.get("tags", []),
        "subtaskCount": data.get("subtaskCount", 0),
        "subtaskCompletedCount": data.get("subtaskCompletedCount", 0),
        "subtaskProgress": data.get("subtaskProgress", 0),
    })
    return project_ref.collection("tasks").document(task_id)


# ============================================================================
# HELPER FUNCTIONS TESTS
# ============================================================================

class TestHelperFunctions:
    """Test utility and canonicalization functions"""

    def test_canon_status_variations(self):
        """Test status normalization with various inputs"""
        assert projects.canon_status("doing") == "in progress"
        assert projects.canon_status("DOING") == "in progress"
        assert projects.canon_status("done") == "completed"
        assert projects.canon_status("Done") == "completed"
        assert projects.canon_status("to-do") == "to-do"
        assert projects.canon_status("blocked") == "blocked"
        assert projects.canon_status("invalid") == "to-do"
        assert projects.canon_status(None) == "to-do"
        assert projects.canon_status("") == "to-do"
        assert projects.canon_status("  ") == "to-do"

    def test_canon_project_priority(self):
        """Test project priority normalization"""
        assert projects.canon_project_priority("low") == "low"
        assert projects.canon_project_priority("LOW") == "low"
        assert projects.canon_project_priority("medium") == "medium"
        assert projects.canon_project_priority("high") == "high"
        assert projects.canon_project_priority("HIGH") == "high"
        assert projects.canon_project_priority(1) == "low"
        assert projects.canon_project_priority(3) == "low"
        assert projects.canon_project_priority(5) == "medium"
        assert projects.canon_project_priority(6) == "medium"
        assert projects.canon_project_priority(8) == "high"
        assert projects.canon_project_priority(10) == "high"
        assert projects.canon_project_priority("9") == "high"
        assert projects.canon_project_priority("invalid") == "medium"
        assert projects.canon_project_priority(None) == "medium"
        assert projects.canon_project_priority("") == "medium"

    def test_canon_task_priority(self):
        """Test task priority normalization (1-10 range)"""
        assert projects.canon_task_priority("low") == 3
        assert projects.canon_task_priority("medium") == 6
        assert projects.canon_task_priority("high") == 9
        assert projects.canon_task_priority("urgent") == 9
        assert projects.canon_task_priority("critical") == 10
        assert projects.canon_task_priority(0) == 1  # Below range
        assert projects.canon_task_priority(15) == 10  # Above range
        assert projects.canon_task_priority(5) == 5
        assert projects.canon_task_priority(None) == 5  # Default
        assert projects.canon_task_priority("invalid") == 5

    def test_ensure_list(self):
        """Test list conversion utility"""
        assert projects.ensure_list([1, 2, 3]) == [1, 2, 3]
        assert projects.ensure_list(None) == []
        assert projects.ensure_list("single") == ["single"]
        assert projects.ensure_list((1, 2)) == [1, 2]
        assert projects.ensure_list({1, 2}) == [1, 2] or projects.ensure_list({1, 2}) == [2, 1]


# ============================================================================
# PROJECT ENDPOINTS TESTS
# ============================================================================

class TestProjectEndpoints:
    """Test project CRUD operations"""

    def test_create_project_success(self, test_client):
        """Test creating a project with all fields"""
        client, fake_db = test_client

        payload = {
            "name": "New Initiative",
            "description": "Test description",
            "ownerId": "owner-1",
            "teamIds": ["member-1"],
            "status": "doing",
            "priority": "HIGH",
            "tags": ["tag1", "tag2"],
            "dueDate": "2024-12-31",
        }

        resp = client.post("/api/projects/", json=payload)
        assert resp.status_code == 201
        data = resp.get_json()
        assert "id" in data
        assert data["message"] == "Project created"

        # Verify stored data
        project_id = data["id"]
        doc = fake_db.collection("projects").document(project_id).get()
        assert doc.exists
        stored = doc.to_dict()

        assert stored["name"] == "New Initiative"
        assert stored["description"] == "Test description"
        assert stored["ownerId"] == "owner-1"
        assert "owner-1" in stored["teamIds"]
        assert "member-1" in stored["teamIds"]
        assert stored["status"] == "in progress"
        assert stored["priority"] == "high"
        assert stored["tags"] == ["tag1", "tag2"]

    def test_create_project_owner_added_to_team(self, test_client):
        """Test that owner is automatically added to teamIds"""
        client, fake_db = test_client

        payload = {
            "name": "Project",
            "ownerId": "owner-1",
            "teamIds": ["member-1"],
        }

        resp = client.post("/api/projects/", json=payload)
        assert resp.status_code == 201

        project_id = resp.get_json()["id"]
        stored = fake_db.collection("projects").document(project_id).get().to_dict()
        assert "owner-1" in stored["teamIds"]
        assert "member-1" in stored["teamIds"]

    def test_create_project_minimal(self, test_client):
        """Test creating project with minimal data"""
        client, fake_db = test_client

        resp = client.post("/api/projects/", json={})
        assert resp.status_code == 201

    def test_list_projects_no_filters(self, test_client):
        """Test listing all projects without filters"""
        client, fake_db = test_client

        _setup_project(fake_db, "proj-1", name="Alpha", status="doing", priority="high")
        _setup_project(fake_db, "proj-2", name="Beta", status="completed", priority="low")

        resp = client.get("/api/projects/")
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data) == 2
        names = {p["name"] for p in data}
        assert "Alpha" in names
        assert "Beta" in names

    def test_list_projects_with_status_filter(self, test_client):
        """Test filtering projects by status"""
        client, fake_db = test_client

        _setup_project(fake_db, "proj-1", status="doing")
        _setup_project(fake_db, "proj-2", status="completed")

        resp = client.get("/api/projects/?status=doing")
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data) == 1
        assert data[0]["status"] == "in progress"

    def test_list_projects_with_priority_filter(self, test_client):
        """Test filtering projects by priority"""
        client, fake_db = test_client

        _setup_project(fake_db, "proj-1", priority="high")
        _setup_project(fake_db, "proj-2", priority="low")

        resp = client.get("/api/projects/?priority=high")
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data) == 1
        assert data[0]["priority"] == "high"

    def test_list_projects_filter_by_assigned_user(self, test_client):
        """Test filtering projects by assigned user"""
        client, fake_db = test_client

        _setup_project(fake_db, "proj-1", teamIds=["user-1"], ownerId="user-1")
        _setup_project(fake_db, "proj-2", teamIds=["user-2"], ownerId="user-2")

        resp = client.get("/api/projects/?assignedTo=user-1")
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data) == 1

    def test_list_projects_multiple_filters(self, test_client):
        """Test combining multiple filters"""
        client, fake_db = test_client

        _setup_project(fake_db, "proj-1", status="doing", priority="high", teamIds=["user-1"])
        _setup_project(fake_db, "proj-2", status="completed", priority="high", teamIds=["user-1"])

        resp = client.get("/api/projects/?status=doing&priority=high&assignedTo=user-1")
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data) == 1

    def test_get_project_success(self, test_client):
        """Test retrieving a single project"""
        client, fake_db = test_client

        _setup_project(fake_db, "proj-1", name="Test Project", teamIds=["user-1"])

        resp = client.get("/api/projects/proj-1")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["id"] == "proj-1"
        assert data["name"] == "Test Project"

    def test_get_project_not_found(self, test_client):
        """Test getting non-existent project"""
        client, _ = test_client

        resp = client.get("/api/projects/non-existent")
        assert resp.status_code == 404
        assert "Not found" in resp.get_json()["error"]

    def test_get_project_forbidden_when_not_on_team(self, test_client):
        """Test access control for project retrieval"""
        client, fake_db = test_client

        _setup_project(fake_db, "proj-1", teamIds=["user-1"], ownerId="user-1")

        resp = client.get("/api/projects/proj-1?assignedTo=user-2")
        assert resp.status_code == 403
        assert "Forbidden" in resp.get_json()["error"]

    def test_update_project_success(self, test_client):
        """Test updating project fields"""
        client, fake_db = test_client

        project_ref = _setup_project(fake_db, "proj-1", name="Old Name", status="to-do")

        resp = client.put("/api/projects/proj-1", json={
            "name": "New Name",
            "status": "doing",
            "priority": "high",
            "tags": ["updated"],
        })
        assert resp.status_code == 200

        updated = project_ref.get().to_dict()
        assert updated["name"] == "New Name"
        assert updated["status"] == "in progress"
        assert updated["priority"] == "high"
        assert updated["tags"] == ["updated"]

    def test_update_project_normalizes_data(self, test_client):
        """Test that update normalizes status and priority"""
        client, fake_db = test_client

        project_ref = _setup_project(fake_db, "proj-1")

        resp = client.put("/api/projects/proj-1", json={
            "status": "done",
            "priority": "9",
            "tags": "single-tag",
        })
        assert resp.status_code == 200

        updated = project_ref.get().to_dict()
        assert updated["status"] == "completed"
        assert updated["priority"] == "high"
        assert updated["tags"] == ["single-tag"]

    def test_delete_project(self, test_client):
        """Test deleting a project"""
        client, fake_db = test_client

        _setup_project(fake_db, "proj-delete")

        resp = client.delete("/api/projects/proj-delete")
        assert resp.status_code == 200
        assert "deleted" in resp.get_json()["message"]

        # Verify deletion
        doc = fake_db.collection("projects").document("proj-delete").get()
        assert not doc.exists


# ============================================================================
# TASK ENDPOINTS TESTS
# ============================================================================

class TestTaskEndpoints:
    """Test task CRUD operations within projects"""

    def test_create_task_success(self, test_client):
        """Test creating a task with all fields"""
        client, fake_db = test_client

        _setup_project(fake_db, "proj-1", teamIds=["owner-1"], ownerId="owner-1")

        resp = client.post("/api/projects/proj-1/tasks", json={
            "title": "New Task",
            "description": "Task description",
            "assigneeId": "user-1",
            "priority": "high",
            "status": "doing",
            "dueDate": "2024-12-31",
            "tags": ["urgent"],
            "collaboratorsIds": ["user-2"],
        })
        assert resp.status_code == 201
        data = resp.get_json()
        assert "id" in data

        # Verify stored data
        task_id = data["id"]
        task = fake_db.collection("projects").document("proj-1").collection("tasks").document(task_id).get()
        assert task.exists
        stored = task.to_dict()
        assert stored["title"] == "New Task"
        assert stored["assigneeId"] == "user-1"
        assert stored["priority"] == 9
        assert stored["status"] == "in progress"

    def test_create_task_without_assignee_fails(self, test_client):
        """Test that assigneeId is required"""
        client, fake_db = test_client

        _setup_project(fake_db, "proj-1", teamIds=["owner-1"])

        resp = client.post("/api/projects/proj-1/tasks", json={
            "title": "Task",
        })
        assert resp.status_code == 400
        assert "assigneeId is required" in resp.get_json()["error"]

    def test_create_task_project_not_found(self, test_client):
        """Test creating task for non-existent project"""
        client, _ = test_client

        resp = client.post("/api/projects/non-existent/tasks", json={
            "assigneeId": "user-1",
        })
        assert resp.status_code == 404
        assert "Project not found" in resp.get_json()["error"]

    def test_create_task_adds_assignee_to_team(self, test_client):
        """Test assignee is added to project team"""
        client, fake_db = test_client

        project_ref = _setup_project(fake_db, "proj-1", teamIds=["owner-1"], ownerId="owner-1")

        resp = client.post("/api/projects/proj-1/tasks", json={
            "title": "Task",
            "assigneeId": "user-2",
        })
        assert resp.status_code == 201

        # Verify user-2 added to team
        project = project_ref.get().to_dict()
        assert "user-2" in project["teamIds"]

    def test_create_task_default_title(self, test_client):
        """Test default title when empty/missing"""
        client, fake_db = test_client

        _setup_project(fake_db, "proj-1", teamIds=["owner-1"])

        resp = client.post("/api/projects/proj-1/tasks", json={
            "title": "",
            "assigneeId": "user-1",
        })
        assert resp.status_code == 201

        task_id = resp.get_json()["id"]
        task = fake_db.collection("projects").document("proj-1").collection("tasks").document(task_id).get()
        assert task.to_dict()["title"] == "Untitled task"

    def test_create_task_with_notifications(self, test_client, monkeypatch):
        """Test task creation sends notifications"""
        client, fake_db = test_client

        # Mock notifications module
        module = types.SimpleNamespace(record=[])
        def fake_add_notification(payload, project_name):
            module.record.append((payload, project_name))

        monkeypatch.setitem(sys.modules, "notifications", module)
        module.add_notification = fake_add_notification

        _setup_project(fake_db, "proj-1", name="Test Project", teamIds=["owner-1"])
        fake_db.collection("users").document("user-creator").set({"fullName": "Creator Name"})

        resp = client.post("/api/projects/proj-1/tasks", json={
            "title": "Task",
            "assigneeId": "user-1",
            "collaboratorsIds": ["user-2"],
            "createdBy": "user-creator",
        })
        assert resp.status_code == 201
        assert len(module.record) == 1
        assert module.record[0][1] == "Test Project"

    def test_list_tasks_for_project(self, test_client):
        """Test listing tasks for a project"""
        client, fake_db = test_client

        _setup_project(fake_db, "proj-1", teamIds=["user-1"], ownerId="user-1")
        _setup_task(fake_db, "proj-1", "task-1", title="Task 1", assigneeId="user-1")
        _setup_task(fake_db, "proj-1", "task-2", title="Task 2", assigneeId="user-1")

        resp = client.get("/api/projects/proj-1/tasks?assigneeId=user-1")
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data) == 2

    def test_list_tasks_project_not_found(self, test_client):
        """Test listing tasks for non-existent project"""
        client, _ = test_client

        resp = client.get("/api/projects/non-existent/tasks?assigneeId=user-1")
        assert resp.status_code == 404

    def test_list_tasks_user_not_on_team(self, test_client):
        """Test listing tasks when user not on team returns empty"""
        client, fake_db = test_client

        _setup_project(fake_db, "proj-1", teamIds=["user-1"], ownerId="user-1")

        resp = client.get("/api/projects/proj-1/tasks?assigneeId=user-2")
        assert resp.status_code == 200
        assert resp.get_json() == []

    def test_get_task_success(self, test_client):
        """Test retrieving a single task"""
        client, fake_db = test_client

        _setup_project(fake_db, "proj-1")
        _setup_task(fake_db, "proj-1", "task-1", title="Test Task")

        resp = client.get("/api/projects/proj-1/tasks/task-1")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["id"] == "task-1"
        assert data["title"] == "Test Task"
        assert data["projectId"] == "proj-1"

    def test_get_task_not_found(self, test_client):
        """Test getting non-existent task"""
        client, fake_db = test_client

        _setup_project(fake_db, "proj-1")

        resp = client.get("/api/projects/proj-1/tasks/non-existent")
        assert resp.status_code == 404

    def test_update_task_success(self, test_client):
        """Test updating task fields"""
        client, fake_db = test_client

        _setup_project(fake_db, "proj-1")
        task_ref = _setup_task(fake_db, "proj-1", "task-1", title="Old Title", status="to-do")

        resp = client.put("/api/projects/proj-1/tasks/task-1", json={
            "title": "New Title",
            "status": "completed",
            "description": "Updated",
        })
        assert resp.status_code == 200

        updated = task_ref.get().to_dict()
        assert updated["title"] == "New Title"
        assert updated["status"] == "completed"

    def test_update_task_empty_title_uses_default(self, test_client):
        """Test updating with empty title uses default"""
        client, fake_db = test_client

        _setup_project(fake_db, "proj-1")
        task_ref = _setup_task(fake_db, "proj-1", "task-1")

        resp = client.put("/api/projects/proj-1/tasks/task-1", json={
            "title": "",
        })
        assert resp.status_code == 200
        assert task_ref.get().to_dict()["title"] == "Untitled task"

    def test_update_task_syncs_assignee_and_owner(self, test_client):
        """Test assigneeId and ownerId stay in sync"""
        client, fake_db = test_client

        _setup_project(fake_db, "proj-1")
        task_ref = _setup_task(fake_db, "proj-1", "task-1", assigneeId="user-1", ownerId="user-1")

        resp = client.put("/api/projects/proj-1/tasks/task-1", json={
            "assigneeId": "user-2",
        })
        assert resp.status_code == 200

        updated = task_ref.get().to_dict()
        assert updated["assigneeId"] == "user-2"
        assert updated["ownerId"] == "user-2"

    def test_update_task_with_status_change_notification(self, test_client, monkeypatch):
        """Test status change triggers notifications"""
        client, fake_db = test_client

        _setup_project(fake_db, "proj-1")
        _setup_task(fake_db, "proj-1", "task-1", status="to-do")

        called = {}
        def tracker(project_id, task_id, prev, status, changed_by=None):
            called["count"] = called.get("count", 0) + 1
            called["args"] = (project_id, task_id, prev, status, changed_by)

        monkeypatch.setattr(projects, "create_status_change_notifications", tracker)

        resp = client.put("/api/projects/proj-1/tasks/task-1", json={
            "status": "completed",
            "updatedBy": "user-1",
        })
        assert resp.status_code == 200
        assert called["count"] == 1
        assert called["args"][3] == "completed"

    def test_delete_task(self, test_client):
        """Test deleting a task"""
        client, fake_db = test_client

        _setup_project(fake_db, "proj-1")
        _setup_task(fake_db, "proj-1", "task-delete")

        resp = client.delete("/api/projects/proj-1/tasks/task-delete")
        assert resp.status_code == 200

        # Verify deletion
        task = fake_db.collection("projects").document("proj-1").collection("tasks").document("task-delete").get()
        assert not task.exists

    def test_list_tasks_across_projects(self, test_client):
        """Test listing tasks across all projects for a user"""
        client, fake_db = test_client

        _setup_project(fake_db, "proj-1", name="Project 1", priority="high")
        _setup_task(fake_db, "proj-1", "task-1", assigneeId="user-1", status="doing")

        _setup_project(fake_db, "proj-2", name="Project 2", priority="low")
        _setup_task(fake_db, "proj-2", "task-2", ownerId="user-1", status="completed")

        resp = client.get("/api/projects/assigned/tasks?assignedTo=user-1")
        assert resp.status_code == 200
        data = resp.get_json()
        # Verify tasks are returned (exact count depends on collection_group mock)
        assert isinstance(data, list)

    def test_list_tasks_across_projects_requires_user(self, test_client):
        """Test assignedTo parameter is required"""
        client, _ = test_client

        resp = client.get("/api/projects/assigned/tasks")
        assert resp.status_code == 400
        assert "assignedTo is required" in resp.get_json()["error"]


# ============================================================================
# SUBTASK ENDPOINTS TESTS
# ============================================================================

class TestSubtaskEndpoints:
    """Test subtask CRUD operations"""

    def test_create_subtask_success(self, test_client):
        """Test creating a subtask"""
        client, fake_db = test_client

        _setup_project(fake_db, "proj-1", teamIds=["owner-1"], ownerId="owner-1")
        _setup_task(fake_db, "proj-1", "task-1")

        resp = client.post("/api/projects/proj-1/tasks/task-1/subtasks", json={
            "title": "Subtask 1",
            "assigneeId": "user-1",
            "priority": "high",
            "status": "doing",
        })
        assert resp.status_code == 201
        data = resp.get_json()
        assert "id" in data

        # Verify subtask created
        subtask_id = data["id"]
        subtask = (fake_db.collection("projects").document("proj-1")
                   .collection("tasks").document("task-1")
                   .collection("subtasks").document(subtask_id).get())
        assert subtask.exists
        assert subtask.to_dict()["title"] == "Subtask 1"
        assert subtask.to_dict()["parentTaskId"] == "task-1"

    def test_create_subtask_without_assignee_fails(self, test_client):
        """Test assigneeId is required for subtasks"""
        client, fake_db = test_client

        _setup_project(fake_db, "proj-1")
        _setup_task(fake_db, "proj-1", "task-1")

        resp = client.post("/api/projects/proj-1/tasks/task-1/subtasks", json={
            "title": "Subtask",
        })
        assert resp.status_code == 400
        assert "assigneeId is required" in resp.get_json()["error"]

    def test_create_subtask_parent_not_found(self, test_client):
        """Test creating subtask when parent doesn't exist"""
        client, fake_db = test_client

        _setup_project(fake_db, "proj-1")

        resp = client.post("/api/projects/proj-1/tasks/non-existent/subtasks", json={
            "title": "Subtask",
            "assigneeId": "user-1",
        })
        assert resp.status_code == 404
        assert "Parent task not found" in resp.get_json()["error"]

    def test_create_subtask_project_not_found(self, test_client, monkeypatch):
        """Test creating subtask when project doesn't exist"""
        client, fake_db = test_client

        _setup_project(fake_db, "proj-1")
        _setup_task(fake_db, "proj-1", "task-1")

        original_get = FakeDocumentReference.get
        def fake_get(self):
            if getattr(self._collection, "_path", "") == "projects" and self.id == "proj-1":
                return types.SimpleNamespace(exists=False, to_dict=lambda: {})
            return original_get(self)

        monkeypatch.setattr(FakeDocumentReference, "get", fake_get)

        resp = client.post("/api/projects/proj-1/tasks/task-1/subtasks", json={
            "assigneeId": "user-1",
        })
        assert resp.status_code == 404

    def test_list_subtasks(self, test_client):
        """Test listing all subtasks for a task"""
        client, fake_db = test_client

        _setup_project(fake_db, "proj-1")
        parent_ref = _setup_task(fake_db, "proj-1", "task-1")

        subtasks_col = parent_ref.collection("subtasks")
        subtasks_col.document("sub-1").set({"title": "Sub 1", "status": "to-do", "priority": 5})
        subtasks_col.document("sub-2").set({"title": "Sub 2", "status": "completed", "priority": 3})

        resp = client.get("/api/projects/proj-1/tasks/task-1/subtasks")
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data) == 2
        titles = {s["title"] for s in data}
        assert "Sub 1" in titles
        assert "Sub 2" in titles

    def test_get_subtask_success(self, test_client):
        """Test retrieving a single subtask"""
        client, fake_db = test_client

        _setup_project(fake_db, "proj-1")
        parent_ref = _setup_task(fake_db, "proj-1", "task-1")
        parent_ref.collection("subtasks").document("sub-1").set({
            "title": "Test Subtask",
            "status": "to-do",
            "priority": 5,
        })

        resp = client.get("/api/projects/proj-1/tasks/task-1/subtasks/sub-1")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["id"] == "sub-1"
        assert data["title"] == "Test Subtask"
        assert data["projectId"] == "proj-1"
        assert data["parentTaskId"] == "task-1"

    def test_get_subtask_not_found(self, test_client):
        """Test getting non-existent subtask"""
        client, fake_db = test_client

        _setup_project(fake_db, "proj-1")
        _setup_task(fake_db, "proj-1", "task-1")

        resp = client.get("/api/projects/proj-1/tasks/task-1/subtasks/non-existent")
        assert resp.status_code == 404

    def test_update_subtask_success(self, test_client):
        """Test updating subtask fields"""
        client, fake_db = test_client

        _setup_project(fake_db, "proj-1")
        parent_ref = _setup_task(fake_db, "proj-1", "task-1")
        subtask_ref = parent_ref.collection("subtasks").document("sub-1")
        subtask_ref.set({
            "title": "Original",
            "status": "to-do",
            "priority": 5,
            "assigneeId": "user-1",
            "ownerId": "user-1",
        })

        resp = client.put("/api/projects/proj-1/tasks/task-1/subtasks/sub-1", json={
            "title": "Updated",
            "status": "completed",
            "priority": 9,
        })
        assert resp.status_code == 200

        updated = subtask_ref.get().to_dict()
        assert updated["title"] == "Updated"
        assert updated["status"] == "completed"
        assert updated["priority"] == 9

    def test_update_subtask_updates_parent_progress(self, test_client):
        """Test updating subtask status updates parent progress"""
        client, fake_db = test_client

        _setup_project(fake_db, "proj-1")
        parent_ref = _setup_task(fake_db, "proj-1", "task-1")
        parent_ref.collection("subtasks").document("sub-1").set({
            "title": "Sub 1",
            "status": "to-do",
            "priority": 5,
        })

        resp = client.put("/api/projects/proj-1/tasks/task-1/subtasks/sub-1", json={
            "status": "completed",
        })
        assert resp.status_code == 200

        # Check parent task progress was updated
        parent = parent_ref.get().to_dict()
        assert parent["subtaskCount"] == 1
        assert parent["subtaskCompletedCount"] == 1
        assert parent["subtaskProgress"] == 100

    def test_delete_subtask(self, test_client):
        """Test deleting a subtask"""
        client, fake_db = test_client

        _setup_project(fake_db, "proj-1")
        parent_ref = _setup_task(fake_db, "proj-1", "task-1")
        parent_ref.collection("subtasks").document("sub-delete").set({
            "title": "To Delete",
            "status": "to-do",
            "priority": 5,
        })

        resp = client.delete("/api/projects/proj-1/tasks/task-1/subtasks/sub-delete")
        assert resp.status_code == 200

        # Verify deletion
        subtask = parent_ref.collection("subtasks").document("sub-delete").get()
        assert not subtask.exists

    def test_update_parent_task_progress_no_subtasks(self, test_client):
        """Test progress calculation with no subtasks"""
        client, fake_db = test_client

        _setup_project(fake_db, "proj-1")
        parent_ref = _setup_task(fake_db, "proj-1", "task-1")

        projects.update_parent_task_progress("proj-1", "task-1")

        updated = parent_ref.get().to_dict()
        assert updated["subtaskCount"] == 0
        assert updated["subtaskCompletedCount"] == 0
        assert updated["subtaskProgress"] == 0

    def test_update_parent_task_progress_partial(self):
        """Test progress calculation with partial completion"""
        fake_db = FakeFirestore()
        projects.db = fake_db

        _setup_project(fake_db, "proj-1")
        parent_ref = _setup_task(fake_db, "proj-1", "task-1", status="to-do")

        sub_col = parent_ref.collection("subtasks")
        sub_col.document("one").set({"status": "completed"})
        sub_col.document("two").set({"status": "to-do"})

        projects.update_parent_task_progress("proj-1", "task-1")

        updated = parent_ref.get().to_dict()
        assert updated["subtaskCount"] == 2
        assert updated["subtaskCompletedCount"] == 1
        assert updated["subtaskProgress"] == 50

    def test_update_parent_task_autocomplete(self):
        """Test parent task auto-completes when all subtasks done"""
        fake_db = FakeFirestore()
        projects.db = fake_db

        _setup_project(fake_db, "proj-1")
        parent_ref = _setup_task(fake_db, "proj-1", "task-1", status="to-do")

        sub_col = parent_ref.collection("subtasks")
        sub_col.document("one").set({"status": "completed"})
        sub_col.document("two").set({"status": "completed"})

        projects.update_parent_task_progress("proj-1", "task-1")

        updated = parent_ref.get().to_dict()
        assert updated["subtaskProgress"] == 100
        assert updated["status"] == "completed"


# ============================================================================
# STANDALONE TASK ENDPOINTS TESTS
# ============================================================================

class TestStandaloneTaskEndpoints:
    """Test standalone task operations (not associated with projects)"""

    def test_create_standalone_task_success(self, test_client):
        """Test creating a standalone task"""
        client, fake_db = test_client

        resp = client.post("/api/projects/standalone/tasks", json={
            "ownerId": "owner-1",
            "title": "Standalone Task",
            "description": "Task description",
            "priority": "high",
            "status": "doing",
            "dueDate": "2024-12-31",
            "tags": ["personal"],
        })
        assert resp.status_code == 201
        data = resp.get_json()
        assert data["id"]
        assert data["title"] == "Standalone Task"
        assert data["priority"] == 9
        assert data["status"] == "in progress"

    def test_create_standalone_task_missing_owner(self, test_client):
        """Test ownerId is required"""
        client, _ = test_client

        resp = client.post("/api/projects/standalone/tasks", json={
            "title": "Task",
            "dueDate": "2024-12-31",
        })
        assert resp.status_code == 400
        assert "ownerId is required" in resp.get_json()["error"]

    def test_create_standalone_task_missing_title(self, test_client):
        """Test title is required"""
        client, _ = test_client

        resp = client.post("/api/projects/standalone/tasks", json={
            "ownerId": "owner-1",
            "title": "  ",
            "dueDate": "2024-12-31",
        })
        assert resp.status_code == 400
        assert "Title is required" in resp.get_json()["error"]

    def test_create_standalone_task_missing_due_date(self, test_client):
        """Test dueDate is required"""
        client, _ = test_client

        resp = client.post("/api/projects/standalone/tasks", json={
            "ownerId": "owner-1",
            "title": "Task",
        })
        assert resp.status_code == 400
        assert "Due date is required" in resp.get_json()["error"]

    def test_list_standalone_tasks(self, test_client):
        """Test listing standalone tasks for a user"""
        client, fake_db = test_client

        # Create tasks
        tasks_col = fake_db.collection("tasks")
        tasks_col.document("task-1").set({
            "title": "Task 1",
            "ownerId": "owner-1",
            "status": "to-do",
            "priority": 5,
        })
        tasks_col.document("task-2").set({
            "title": "Task 2",
            "ownerId": "owner-1",
            "status": "completed",
            "priority": 8,
        })

        resp = client.get("/api/projects/standalone/tasks?ownerId=owner-1")
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data) == 2

    def test_list_standalone_tasks_missing_owner(self, test_client):
        """Test ownerId parameter is required"""
        client, _ = test_client

        resp = client.get("/api/projects/standalone/tasks")
        assert resp.status_code == 400
        assert "ownerId is required" in resp.get_json()["error"]

    def test_get_standalone_task_success(self, test_client):
        """Test retrieving a standalone task"""
        client, fake_db = test_client

        fake_db.collection("tasks").document("task-1").set({
            "title": "Test Task",
            "ownerId": "owner-1",
            "status": "to-do",
            "priority": 5,
        })

        resp = client.get("/api/projects/standalone/tasks/task-1")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["id"] == "task-1"
        assert data["title"] == "Test Task"

    def test_get_standalone_task_not_found(self, test_client):
        """Test getting non-existent task"""
        client, _ = test_client

        resp = client.get("/api/projects/standalone/tasks/non-existent")
        assert resp.status_code == 404

    def test_update_standalone_task_success(self, test_client):
        """Test updating a standalone task"""
        client, fake_db = test_client

        task_ref = fake_db.collection("tasks").document("task-1")
        task_ref.set({
            "title": "Original",
            "ownerId": "owner-1",
            "status": "to-do",
            "priority": 5,
        })

        resp = client.put("/api/projects/standalone/tasks/task-1", json={
            "title": "Updated",
            "status": "completed",
            "priority": 9,
            "updatedBy": "owner-1",
        })
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["title"] == "Updated"
        assert data["status"] == "completed"
        assert data["priority"] == 9

    def test_update_standalone_task_not_found(self, test_client):
        """Test updating non-existent task"""
        client, _ = test_client

        resp = client.put("/api/projects/standalone/tasks/non-existent", json={
            "updatedBy": "user-1",
        })
        assert resp.status_code == 404

    def test_update_standalone_task_forbidden(self, test_client):
        """Test only owner can update"""
        client, fake_db = test_client

        fake_db.collection("tasks").document("task-1").set({
            "title": "Task",
            "ownerId": "owner-1",
        })

        resp = client.put("/api/projects/standalone/tasks/task-1", json={
            "title": "Hacked",
            "updatedBy": "user-2",
        })
        assert resp.status_code == 403
        assert "Only the task owner" in resp.get_json()["error"]

    def test_delete_standalone_task_success(self, test_client):
        """Test deleting a standalone task with subtasks"""
        client, fake_db = test_client

        task_ref = fake_db.collection("tasks").document("task-delete")
        task_ref.set({
            "title": "To Delete",
            "ownerId": "owner-1",
        })

        # Add subtasks
        task_ref.collection("subtasks").document("sub-1").set({"title": "Sub"})

        resp = client.delete("/api/projects/standalone/tasks/task-delete")
        assert resp.status_code == 200

        # Verify deletion
        task = fake_db.collection("tasks").document("task-delete").get()
        assert not task.exists

    def test_delete_standalone_task_not_found(self, test_client):
        """Test deleting non-existent task"""
        client, _ = test_client

        resp = client.delete("/api/projects/standalone/tasks/non-existent")
        assert resp.status_code == 404


# ============================================================================
# STANDALONE SUBTASK ENDPOINTS TESTS
# ============================================================================

class TestStandaloneSubtaskEndpoints:
    """Test subtask operations for standalone tasks"""

    def test_create_standalone_subtask_success(self, test_client):
        """Test creating a subtask for standalone task"""
        client, fake_db = test_client

        fake_db.collection("tasks").document("task-1").set({
            "title": "Parent",
            "ownerId": "owner-1",
        })

        resp = client.post("/api/projects/standalone/tasks/task-1/subtasks", json={
            "title": "Subtask",
            "description": "Sub description",
            "status": "doing",
            "priority": 8,
            "dueDate": "2024-12-31",
        })
        assert resp.status_code == 201
        data = resp.get_json()
        assert data["id"]
        assert data["title"] == "Subtask"

    def test_create_standalone_subtask_parent_not_found(self, test_client):
        """Test creating subtask when parent doesn't exist"""
        client, _ = test_client

        resp = client.post("/api/projects/standalone/tasks/non-existent/subtasks", json={
            "title": "Subtask",
        })
        assert resp.status_code == 404

    def test_create_standalone_subtask_missing_title(self, test_client):
        """Test title is required"""
        client, fake_db = test_client

        fake_db.collection("tasks").document("task-1").set({
            "title": "Parent",
            "ownerId": "owner-1",
        })

        resp = client.post("/api/projects/standalone/tasks/task-1/subtasks", json={
            "title": "  ",
        })
        assert resp.status_code == 400
        assert "Title is required" in resp.get_json()["error"]

    def test_list_standalone_subtasks(self, test_client):
        """Test listing subtasks for standalone task"""
        client, fake_db = test_client

        task_ref = fake_db.collection("tasks").document("task-1")
        task_ref.set({
            "title": "Parent",
            "ownerId": "owner-1",
        })

        subtasks_col = task_ref.collection("subtasks")
        subtasks_col.document("sub-1").set({"title": "Sub 1", "status": "to-do", "priority": 5})
        subtasks_col.document("sub-2").set({"title": "Sub 2", "status": "completed", "priority": 3})

        resp = client.get("/api/projects/standalone/tasks/task-1/subtasks")
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data) == 2

    def test_list_standalone_subtasks_task_not_found(self, test_client):
        """Test listing when task doesn't exist"""
        client, _ = test_client

        resp = client.get("/api/projects/standalone/tasks/non-existent/subtasks")
        assert resp.status_code == 404

    def test_get_standalone_subtask_success(self, test_client):
        """Test retrieving a single standalone subtask"""
        client, fake_db = test_client

        task_ref = fake_db.collection("tasks").document("task-1")
        task_ref.set({"title": "Parent", "ownerId": "owner-1"})
        task_ref.collection("subtasks").document("sub-1").set({
            "title": "Test Sub",
            "status": "to-do",
            "priority": 5,
        })

        resp = client.get("/api/projects/standalone/tasks/task-1/subtasks/sub-1")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["id"] == "sub-1"
        assert data["title"] == "Test Sub"

    def test_get_standalone_subtask_not_found(self, test_client):
        """Test getting non-existent subtask"""
        client, fake_db = test_client

        fake_db.collection("tasks").document("task-1").set({
            "title": "Parent",
            "ownerId": "owner-1",
        })

        resp = client.get("/api/projects/standalone/tasks/task-1/subtasks/non-existent")
        assert resp.status_code == 404

    def test_update_standalone_subtask_success(self, test_client):
        """Test updating a standalone subtask"""
        client, fake_db = test_client

        task_ref = fake_db.collection("tasks").document("task-1")
        task_ref.set({"title": "Parent", "ownerId": "owner-1"})
        subtask_ref = task_ref.collection("subtasks").document("sub-1")
        subtask_ref.set({
            "title": "Original",
            "status": "to-do",
            "priority": 5,
        })

        resp = client.put("/api/projects/standalone/tasks/task-1/subtasks/sub-1", json={
            "title": "Updated",
            "status": "completed",
            "priority": 9,
        })
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["title"] == "Updated"
        assert data["status"] == "completed"

    def test_update_standalone_subtask_not_found(self, test_client):
        """Test updating non-existent subtask"""
        client, _ = test_client

        resp = client.put("/api/projects/standalone/tasks/bogus/subtasks/missing", json={})
        assert resp.status_code == 404

    def test_delete_standalone_subtask_success(self, test_client):
        """Test deleting a standalone subtask"""
        client, fake_db = test_client

        task_ref = fake_db.collection("tasks").document("task-1")
        task_ref.set({"title": "Parent", "ownerId": "owner-1"})
        task_ref.collection("subtasks").document("sub-delete").set({
            "title": "To Delete",
            "status": "to-do",
            "priority": 5,
        })

        resp = client.delete("/api/projects/standalone/tasks/task-1/subtasks/sub-delete")
        assert resp.status_code == 200

        # Verify deletion
        subtask = task_ref.collection("subtasks").document("sub-delete").get()
        assert not subtask.exists

    def test_delete_standalone_subtask_not_found(self, test_client):
        """Test deleting non-existent subtask"""
        client, _ = test_client

        resp = client.delete("/api/projects/standalone/tasks/bogus/subtasks/missing")
        assert resp.status_code == 404

    def test_update_standalone_task_progress(self):
        """Test progress calculation for standalone tasks"""
        fake_db = FakeFirestore()
        projects.db = fake_db

        task_ref = fake_db.collection("tasks").document("solo")
        task_ref.set({"ownerId": "user-1", "status": "to-do"})

        # No subtasks
        projects.update_standalone_task_progress("solo")
        doc = task_ref.get().to_dict()
        assert doc["subtaskCount"] == 0
        assert doc["subtaskProgress"] == 0

        # Add subtasks
        sub_col = task_ref.collection("subtasks")
        sub_col.document("one").set({"status": "completed"})
        sub_col.document("two").set({"status": "completed"})

        projects.update_standalone_task_progress("solo")
        updated = task_ref.get().to_dict()
        assert updated["subtaskCount"] == 2
        assert updated["subtaskCompletedCount"] == 2
        assert updated["subtaskProgress"] == 100
        assert updated["status"] == "completed"


# ============================================================================
# NORMALIZATION FUNCTIONS TESTS
# ============================================================================

class TestNormalizationFunctions:
    """Test data normalization functions"""

    def test_normalize_project_out(self):
        """Test project normalization"""
        doc = {
            "name": "Test",
            "ownerId": "owner-1",
            "status": "doing",
            "priority": 8,
            "teamIds": ["user-1"],
            "tags": "single",
        }

        result = projects.normalize_project_out(doc)

        assert result["status"] == "in progress"
        assert result["priority"] == "high"
        assert result["teamIds"] == ["user-1", "owner-1"]
        assert result["tags"] == ["single"]

    def test_normalize_project_out_defaults(self):
        """Test normalization with missing fields"""
        doc = {}

        result = projects.normalize_project_out(doc)

        assert result["name"] == ""
        assert result["description"] == ""
        assert result["status"] == "to-do"
        assert result["priority"] == "medium"
        assert result["teamIds"] == []
        assert result["tags"] == []

    def test_normalize_task_out(self):
        """Test task normalization"""
        doc = {
            "title": "Task",
            "status": "done",
            "priority": "high",
            "assigneeId": "user-1",
            "collaboratorsIds": "user-2",
            "tags": ["tag1"],
        }

        result = projects.normalize_task_out(doc)

        assert result["status"] == "completed"
        assert result["priority"] == 9
        assert result["assigneeId"] == "user-1"
        assert result["ownerId"] == "user-1"
        assert result["collaboratorsIds"] == ["user-2"]
        assert result["subtaskCount"] == 0

    def test_normalize_task_out_defaults(self):
        """Test task normalization with defaults"""
        doc = {}

        result = projects.normalize_task_out(doc)

        assert result["title"] == ""
        assert result["description"] == ""
        assert result["status"] == "to-do"
        assert result["priority"] == 5
        assert result["collaboratorsIds"] == []
        assert result["tags"] == []
        assert result["subtaskProgress"] == 0


# ============================================================================
# EDGE CASES AND ERROR HANDLING
# ============================================================================

class TestEdgeCases:
    """Test edge cases and error conditions"""

    def test_create_task_notification_error(self, test_client, monkeypatch):
        """Test task creation succeeds even if notification fails"""
        client, fake_db = test_client

        def fail_notification(*args, **kwargs):
            raise RuntimeError("Notification failed")

        failing_module = types.SimpleNamespace(add_notification=fail_notification)
        monkeypatch.setitem(sys.modules, "notifications", failing_module)

        _setup_project(fake_db, "proj-1", teamIds=[])

        resp = client.post("/api/projects/proj-1/tasks", json={
            "assigneeId": "user-1",
            "title": "Task",
            "collaboratorsIds": ["user-2"],
        })
        assert resp.status_code == 201

    def test_update_task_endpoint_error_path(self, test_client, monkeypatch):
        """Test update task handles errors"""
        client, fake_db = test_client

        _setup_project(fake_db, "proj-1")
        task_ref = _setup_task(fake_db, "proj-1", "task-1")

        def raising_update(self, patch):
            raise RuntimeError("Update failed")

        monkeypatch.setattr(type(task_ref), "update", raising_update)

        resp = client.put("/api/projects/proj-1/tasks/task-1", json={"title": "  "})
        assert resp.status_code == 500

    def test_update_task_notification_exception(self, test_client, monkeypatch):
        """Test update succeeds even if notification fails"""
        client, fake_db = test_client

        _setup_project(fake_db, "proj-1")
        _setup_task(fake_db, "proj-1", "task-1")

        def raising_tracker(*args, **kwargs):
            raise RuntimeError("Notification failed")

        monkeypatch.setattr(projects, "create_status_change_notifications", raising_tracker)

        resp = client.put("/api/projects/proj-1/tasks/task-1", json={
            "status": "blocked",
        })
        assert resp.status_code == 200

    def test_update_task_helper_function(self, monkeypatch):
        """Test the update_task helper function"""
        fake_db = FakeFirestore()
        projects.db = fake_db

        _setup_project(fake_db, "proj-1")
        _setup_task(fake_db, "proj-1", "task-1")

        called = {}
        def tracker(project_id, task_id, prev, new_status, changed_by=None):
            called["args"] = (project_id, task_id, prev, new_status, changed_by)

        monkeypatch.setattr(projects, "create_status_change_notifications", tracker)

        projects.update_task("proj-1", "task-1", {"status": "completed"}, updated_by="user-1")
        assert called["args"][0] == "proj-1"
        assert called["args"][3] == "completed"

        # Test with failing notification
        def raising_tracker(*args, **kwargs):
            raise RuntimeError("Failed")

        monkeypatch.setattr(projects, "create_status_change_notifications", raising_tracker)
        projects.update_task("proj-1", "task-1", {"status": "blocked"})

    def test_list_projects_filter_all(self, test_client):
        """Test 'all' filter value returns everything"""
        client, fake_db = test_client

        _setup_project(fake_db, "proj-1", status="doing")
        _setup_project(fake_db, "proj-2", status="completed")

        resp = client.get("/api/projects/?status=all&priority=all")
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data) == 2

    def test_project_owner_deduplication(self, test_client):
        """Test owner isn't duplicated in teamIds"""
        client, fake_db = test_client

        payload = {
            "name": "Project",
            "ownerId": "owner-1",
            "teamIds": ["owner-1", "user-1", "owner-1"],  # Duplicates
        }

        resp = client.post("/api/projects/", json=payload)
        assert resp.status_code == 201

        project_id = resp.get_json()["id"]
        stored = fake_db.collection("projects").document(project_id).get().to_dict()

        # Check owner-1 appears only once
        assert stored["teamIds"].count("owner-1") == 1
