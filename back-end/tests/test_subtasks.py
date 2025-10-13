"""
Comprehensive tests for subtask functionality.
"""

import os
import sys

import pytest
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from test_projects_api import test_client  # Import the shared fixture


# ==================== SUBTASK CREATION TESTS ====================

class TestSubtaskCreation:
    """Tests for creating subtasks."""

    def test_create_subtask_success(self, test_client):
        """Test creating a subtask under a parent task."""
        client, fake_db = test_client
        
        # Setup: Create a project and parent task
        projects_col = fake_db.collection("projects")
        projects_col.document("proj-1").set({
            "name": "Test Project",
            "ownerId": "user-1",
            "teamIds": ["user-1", "user-2"],
        })
        
        tasks_col = projects_col.document("proj-1").collection("tasks")
        tasks_col.document("task-1").set({
            "title": "Parent Task",
            "status": "to-do",
            "priority": 5,
            "assigneeId": "user-1",
            "createdBy": "user-1",
        })
        
        # Create subtask
        subtask_payload = {
            "title": "Review designs",
            "description": "Check Figma mockups",
            "status": "to-do",
            "priority": 7,
            "assigneeId": "user-2",
            "collaboratorsIds": ["user-1"],
            "tags": ["design", "review"],
            "dueDate": "2025-12-31T00:00:00Z",
        }
        
        resp = client.post("/api/projects/proj-1/tasks/task-1/subtasks", json=subtask_payload)
        assert resp.status_code == 201
        
        data = resp.get_json()
        assert "id" in data
        subtask_id = data["id"]
        
        # Verify subtask was created
        subtask_ref = tasks_col.document("task-1").collection("subtasks").document(subtask_id)
        subtask_doc = subtask_ref.get()
        assert subtask_doc.exists
        
        stored = subtask_doc.to_dict()
        assert stored["title"] == "Review designs"
        assert stored["description"] == "Check Figma mockups"
        assert stored["status"] == "to-do"
        assert stored["priority"] == 7
        assert stored["assigneeId"] == "user-2"
        assert stored["parentTaskId"] == "task-1"
        assert "design" in stored["tags"]
        assert "review" in stored["tags"]

    def test_create_subtask_updates_parent_progress(self, test_client):
        """Test that creating a subtask updates parent task progress."""
        client, fake_db = test_client
        
        projects_col = fake_db.collection("projects")
        projects_col.document("proj-1").set({
            "name": "Test Project",
            "ownerId": "user-1",
        })
        
        tasks_col = projects_col.document("proj-1").collection("tasks")
        tasks_col.document("task-1").set({
            "title": "Parent Task",
            "status": "to-do",
        })
        
        subtask_payload = {
            "title": "New subtask",
            "status": "to-do",
            "priority": 5,
        }
        
        resp = client.post("/api/projects/proj-1/tasks/task-1/subtasks", json=subtask_payload)
        assert resp.status_code == 201
        
        # Verify parent task was updated with progress
        parent_doc = tasks_col.document("task-1").get()
        parent_data = parent_doc.to_dict()
        assert parent_data["subtaskCount"] == 1
        assert parent_data["subtaskCompletedCount"] == 0
        assert parent_data["subtaskProgress"] == 0

    def test_create_subtask_with_missing_parent_task(self, test_client):
        """Test creating a subtask when parent task doesn't exist."""
        client, fake_db = test_client
        
        projects_col = fake_db.collection("projects")
        projects_col.document("proj-1").set({
            "name": "Test Project",
            "ownerId": "user-1",
        })
        
        subtask_payload = {
            "title": "Orphan subtask",
            "status": "to-do",
            "priority": 5,
        }
        
        resp = client.post("/api/projects/proj-1/tasks/nonexistent/subtasks", json=subtask_payload)
        assert resp.status_code == 404


# ==================== SUBTASK RETRIEVAL TESTS ====================

class TestSubtaskRetrieval:
    """Tests for retrieving subtasks."""

    def test_list_subtasks(self, test_client):
        """Test listing all subtasks under a parent task."""
        client, fake_db = test_client
        
        # Setup
        projects_col = fake_db.collection("projects")
        projects_col.document("proj-1").set({
            "name": "Test Project",
            "ownerId": "user-1",
        })
        
        tasks_col = projects_col.document("proj-1").collection("tasks")
        tasks_col.document("task-1").set({
            "title": "Parent Task",
            "status": "to-do",
        })
        
        subtasks_col = tasks_col.document("task-1").collection("subtasks")
        subtasks_col.document("sub-1").set({
            "title": "First subtask",
            "status": "completed",
            "priority": 8,
            "parentTaskId": "task-1",
        })
        subtasks_col.document("sub-2").set({
            "title": "Second subtask",
            "status": "to-do",
            "priority": 3,
            "parentTaskId": "task-1",
        })
        
        resp = client.get("/api/projects/proj-1/tasks/task-1/subtasks")
        assert resp.status_code == 200
        
        data = resp.get_json()
        assert len(data) == 2
        
        titles = {item["title"] for item in data}
        assert "First subtask" in titles
        assert "Second subtask" in titles

    def test_list_subtasks_returns_empty_for_no_subtasks(self, test_client):
        """Test that listing subtasks returns empty array when none exist."""
        client, fake_db = test_client
        
        projects_col = fake_db.collection("projects")
        projects_col.document("proj-1").set({
            "name": "Test Project",
            "ownerId": "user-1",
        })
        
        tasks_col = projects_col.document("proj-1").collection("tasks")
        tasks_col.document("task-1").set({
            "title": "Parent Task",
            "status": "to-do",
        })
        
        resp = client.get("/api/projects/proj-1/tasks/task-1/subtasks")
        assert resp.status_code == 200
        assert resp.get_json() == []

    def test_get_single_subtask(self, test_client):
        """Test getting a single subtask by ID."""
        client, fake_db = test_client
        
        # Setup
        projects_col = fake_db.collection("projects")
        projects_col.document("proj-1").set({
            "name": "Test Project",
            "ownerId": "user-1",
        })
        
        tasks_col = projects_col.document("proj-1").collection("tasks")
        tasks_col.document("task-1").set({
            "title": "Parent Task",
            "status": "to-do",
        })
        
        subtasks_col = tasks_col.document("task-1").collection("subtasks")
        subtasks_col.document("sub-1").set({
            "title": "Target subtask",
            "description": "Detailed description",
            "status": "in progress",
            "priority": 9,
            "assigneeId": "user-2",
            "parentTaskId": "task-1",
        })
        
        resp = client.get("/api/projects/proj-1/tasks/task-1/subtasks/sub-1")
        assert resp.status_code == 200
        
        data = resp.get_json()
        assert data["id"] == "sub-1"
        assert data["title"] == "Target subtask"
        assert data["description"] == "Detailed description"
        assert data["status"] == "in progress"
        assert data["priority"] == 9
        assert data["projectId"] == "proj-1"
        assert data["parentTaskId"] == "task-1"

    def test_get_nonexistent_subtask(self, test_client):
        """Test getting a subtask that doesn't exist."""
        client, fake_db = test_client
        
        projects_col = fake_db.collection("projects")
        projects_col.document("proj-1").set({
            "name": "Test Project",
            "ownerId": "user-1",
        })
        
        tasks_col = projects_col.document("proj-1").collection("tasks")
        tasks_col.document("task-1").set({
            "title": "Parent Task",
            "status": "to-do",
        })
        
        resp = client.get("/api/projects/proj-1/tasks/task-1/subtasks/nonexistent")
        assert resp.status_code == 404


# ==================== SUBTASK UPDATE TESTS ====================

class TestSubtaskUpdate:
    """Tests for updating subtasks."""

    def test_update_subtask_fields(self, test_client):
        """Test updating a subtask's fields."""
        client, fake_db = test_client
        
        # Setup
        projects_col = fake_db.collection("projects")
        projects_col.document("proj-1").set({
            "name": "Test Project",
            "ownerId": "user-1",
        })
        
        tasks_col = projects_col.document("proj-1").collection("tasks")
        tasks_col.document("task-1").set({
            "title": "Parent Task",
            "status": "to-do",
        })
        
        subtasks_col = tasks_col.document("task-1").collection("subtasks")
        subtasks_col.document("sub-1").set({
            "title": "Original title",
            "status": "to-do",
            "priority": 5,
            "assigneeId": "user-1",
            "parentTaskId": "task-1",
        })
        
        # Update subtask
        update_payload = {
            "title": "Updated title",
            "status": "in progress",
            "priority": 8,
            "description": "New description",
        }
        
        resp = client.put("/api/projects/proj-1/tasks/task-1/subtasks/sub-1", json=update_payload)
        assert resp.status_code == 200
        
        # Verify update
        subtask_doc = subtasks_col.document("sub-1").get()
        stored = subtask_doc.to_dict()
        assert stored["title"] == "Updated title"
        assert stored["status"] == "in progress"
        assert stored["priority"] == 8
        assert stored["description"] == "New description"
        assert "updatedAt" in stored

    def test_update_subtask_status_updates_parent_progress(self, test_client):
        """Test that updating subtask status updates parent task progress."""
        client, fake_db = test_client
        
        # Setup project and parent task
        projects_col = fake_db.collection("projects")
        projects_col.document("proj-1").set({
            "name": "Test Project",
            "ownerId": "user-1",
        })
        
        tasks_col = projects_col.document("proj-1").collection("tasks")
        tasks_col.document("task-1").set({
            "title": "Parent Task",
            "status": "to-do",
            "subtaskCount": 3,
            "subtaskCompletedCount": 1,
            "subtaskProgress": 33,
        })
        
        # Create 3 subtasks: 1 completed, 2 to-do
        subtasks_col = tasks_col.document("task-1").collection("subtasks")
        subtasks_col.document("sub-1").set({
            "title": "Subtask 1",
            "status": "completed",
            "parentTaskId": "task-1",
        })
        subtasks_col.document("sub-2").set({
            "title": "Subtask 2",
            "status": "to-do",
            "parentTaskId": "task-1",
        })
        subtasks_col.document("sub-3").set({
            "title": "Subtask 3",
            "status": "to-do",
            "parentTaskId": "task-1",
        })
        
        # Complete sub-2
        resp = client.put("/api/projects/proj-1/tasks/task-1/subtasks/sub-2", 
                         json={"status": "completed"})
        assert resp.status_code == 200
        
        # Verify parent task progress updated
        parent_doc = tasks_col.document("task-1").get()
        parent_data = parent_doc.to_dict()
        assert parent_data["subtaskCount"] == 3
        assert parent_data["subtaskCompletedCount"] == 2
        assert parent_data["subtaskProgress"] == 66  # 2/3 = 66%

    def test_complete_all_subtasks_completes_parent(self, test_client):
        """Test that completing all subtasks auto-completes parent task."""
        client, fake_db = test_client
        
        # Setup
        projects_col = fake_db.collection("projects")
        projects_col.document("proj-1").set({
            "name": "Test Project",
            "ownerId": "user-1",
        })
        
        tasks_col = projects_col.document("proj-1").collection("tasks")
        tasks_col.document("task-1").set({
            "title": "Parent Task",
            "status": "in progress",
        })
        
        subtasks_col = tasks_col.document("task-1").collection("subtasks")
        subtasks_col.document("sub-1").set({
            "title": "Subtask 1",
            "status": "completed",
            "parentTaskId": "task-1",
        })
        subtasks_col.document("sub-2").set({
            "title": "Subtask 2",
            "status": "to-do",
            "parentTaskId": "task-1",
        })
        
        # Complete the last subtask
        resp = client.put("/api/projects/proj-1/tasks/task-1/subtasks/sub-2",
                         json={"status": "completed"})
        assert resp.status_code == 200
        
        # Verify parent is completed
        parent_doc = tasks_col.document("task-1").get()
        parent_data = parent_doc.to_dict()
        assert parent_data["subtaskProgress"] == 100
        assert parent_data["status"] == "completed"


# ==================== SUBTASK DELETION TESTS ====================

class TestSubtaskDeletion:
    """Tests for deleting subtasks."""

    def test_delete_subtask(self, test_client):
        """Test deleting a subtask."""
        client, fake_db = test_client
        
        # Setup
        projects_col = fake_db.collection("projects")
        projects_col.document("proj-1").set({
            "name": "Test Project",
            "ownerId": "user-1",
        })
        
        tasks_col = projects_col.document("proj-1").collection("tasks")
        tasks_col.document("task-1").set({
            "title": "Parent Task",
            "status": "to-do",
            "subtaskCount": 2,
        })
        
        subtasks_col = tasks_col.document("task-1").collection("subtasks")
        subtasks_col.document("sub-1").set({
            "title": "Subtask to delete",
            "status": "to-do",
            "parentTaskId": "task-1",
        })
        subtasks_col.document("sub-2").set({
            "title": "Subtask to keep",
            "status": "completed",
            "parentTaskId": "task-1",
        })
        
        # Delete subtask
        resp = client.delete("/api/projects/proj-1/tasks/task-1/subtasks/sub-1")
        assert resp.status_code == 200
        
        # Verify deletion
        subtask_doc = subtasks_col.document("sub-1").get()
        assert not subtask_doc.exists
        
        # Verify parent progress updated
        parent_doc = tasks_col.document("task-1").get()
        parent_data = parent_doc.to_dict()
        assert parent_data["subtaskCount"] == 1
        assert parent_data["subtaskCompletedCount"] == 1
        assert parent_data["subtaskProgress"] == 100

    def test_delete_all_subtasks_resets_parent_progress(self, test_client):
        """Test that deleting all subtasks resets parent progress to 0."""
        client, fake_db = test_client
        
        # Setup
        projects_col = fake_db.collection("projects")
        projects_col.document("proj-1").set({
            "name": "Test Project",
            "ownerId": "user-1",
        })
        
        tasks_col = projects_col.document("proj-1").collection("tasks")
        tasks_col.document("task-1").set({
            "title": "Parent Task",
            "status": "to-do",
            "subtaskCount": 1,
            "subtaskProgress": 50,
        })
        
        subtasks_col = tasks_col.document("task-1").collection("subtasks")
        subtasks_col.document("sub-1").set({
            "title": "Last subtask",
            "status": "to-do",
            "parentTaskId": "task-1",
        })
        
        # Delete last subtask
        resp = client.delete("/api/projects/proj-1/tasks/task-1/subtasks/sub-1")
        assert resp.status_code == 200
        
        # Verify parent progress reset
        parent_doc = tasks_col.document("task-1").get()
        parent_data = parent_doc.to_dict()
        assert parent_data["subtaskCount"] == 0
        assert parent_data["subtaskCompletedCount"] == 0
        assert parent_data["subtaskProgress"] == 0


# ==================== VALIDATION TESTS ====================

class TestSubtaskValidation:
    """Tests for subtask validation and normalization."""

    def test_subtask_validates_required_fields(self, test_client):
        """Test that subtask creation validates required fields."""
        client, fake_db = test_client
        
        # Setup
        projects_col = fake_db.collection("projects")
        projects_col.document("proj-1").set({
            "name": "Test Project",
            "ownerId": "user-1",
        })
        
        tasks_col = projects_col.document("proj-1").collection("tasks")
        tasks_col.document("task-1").set({
            "title": "Parent Task",
            "status": "to-do",
        })
        
        # Try creating subtask without title
        invalid_payload = {
            "description": "No title provided",
            "status": "to-do",
        }
        
        resp = client.post("/api/projects/proj-1/tasks/task-1/subtasks", json=invalid_payload)
        # Should either reject or auto-fill with "Untitled subtask"
        data = resp.get_json()
        if resp.status_code == 201:
            subtask_id = data["id"]
            subtasks_col = tasks_col.document("task-1").collection("subtasks")
            subtask_doc = subtasks_col.document(subtask_id).get()
            stored = subtask_doc.to_dict()
            assert stored["title"] == "Untitled subtask"

    def test_subtask_normalizes_status_and_priority(self, test_client):
        """Test that subtask creation normalizes status and priority."""
        client, fake_db = test_client
        
        # Setup
        projects_col = fake_db.collection("projects")
        projects_col.document("proj-1").set({
            "name": "Test Project",
            "ownerId": "user-1",
        })
        
        tasks_col = projects_col.document("proj-1").collection("tasks")
        tasks_col.document("task-1").set({
            "title": "Parent Task",
            "status": "to-do",
        })
        
        # Create subtask with various status formats
        subtask_payload = {
            "title": "Test normalization",
            "status": "IN PROGRESS",  # Should normalize to "in progress"
            "priority": "invalid",     # Should normalize to default
        }
        
        resp = client.post("/api/projects/proj-1/tasks/task-1/subtasks", json=subtask_payload)
        assert resp.status_code == 201
        
        subtask_id = resp.get_json()["id"]
        subtasks_col = tasks_col.document("task-1").collection("subtasks")
        subtask_doc = subtasks_col.document(subtask_id).get()
        stored = subtask_doc.to_dict()
        
        assert stored["status"] == "in progress"
        assert isinstance(stored["priority"], int)
        assert 1 <= stored["priority"] <= 10


# ==================== INTEGRATION TESTS ====================

class TestSubtaskIntegration:
    """Integration tests for complete subtask workflows."""

    def test_full_subtask_lifecycle(self, test_client):
        """Integration test: Create, update, complete, and delete subtasks."""
        client, fake_db = test_client
        
        # Setup project and task
        projects_col = fake_db.collection("projects")
        projects_col.document("proj-1").set({
            "name": "Full Lifecycle Project",
            "ownerId": "user-1",
            "teamIds": ["user-1", "user-2"],
        })
        
        tasks_col = projects_col.document("proj-1").collection("tasks")
        tasks_col.document("task-1").set({
            "title": "Parent Task",
            "status": "to-do",
            "priority": 5,
        })
        
        # 1. Create multiple subtasks
        subtask_ids = []
        for i in range(3):
            payload = {
                "title": f"Subtask {i+1}",
                "status": "to-do",
                "priority": i + 1,
            }
            resp = client.post("/api/projects/proj-1/tasks/task-1/subtasks", json=payload)
            assert resp.status_code == 201
            subtask_ids.append(resp.get_json()["id"])
        
        # 2. List all subtasks
        resp = client.get("/api/projects/proj-1/tasks/task-1/subtasks")
        assert resp.status_code == 200
        assert len(resp.get_json()) == 3
        
        # 3. Update one subtask
        resp = client.put(f"/api/projects/proj-1/tasks/task-1/subtasks/{subtask_ids[0]}",
                         json={"status": "completed"})
        assert resp.status_code == 200
        
        # 4. Verify parent progress
        parent_doc = tasks_col.document("task-1").get()
        parent_data = parent_doc.to_dict()
        assert parent_data["subtaskProgress"] == 33  # 1/3 = 33%
        
        # 5. Complete all remaining subtasks
        for subtask_id in subtask_ids[1:]:
            resp = client.put(f"/api/projects/proj-1/tasks/task-1/subtasks/{subtask_id}",
                             json={"status": "completed"})
            assert resp.status_code == 200
        
        # 6. Verify parent is completed
        parent_doc = tasks_col.document("task-1").get()
        parent_data = parent_doc.to_dict()
        assert parent_data["subtaskProgress"] == 100
        assert parent_data["status"] == "completed"
        
        # 7. Delete one subtask
        resp = client.delete(f"/api/projects/proj-1/tasks/task-1/subtasks/{subtask_ids[0]}")
        assert resp.status_code == 200
        
        # 8. Verify count updated
        parent_doc = tasks_col.document("task-1").get()
        parent_data = parent_doc.to_dict()
        assert parent_data["subtaskCount"] == 2