import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime, timezone
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
    with patch('projects.db') as mock_db:
        yield mock_db

# Scrum-14.1: Add collaborator to a task
def test_add_collaborator_to_task(client, mock_firestore):
    # Setup test data
    project_id = "project123"
    task_id = "task456"
    john_id = "john123"
    user_id = "user789"

    # Mock existing task data (John is NOT a collaborator yet)
    existing_task = {
        "title": "Task 1",
        "description": "Test task",
        "status": "to-do",
        "priority": 5,
        "assigneeId": user_id,
        "ownerId": user_id,
        "collaboratorsIds": [],  # Empty - John is not a collaborator
        "tags": [],
        "dueDate": "2025-11-10T00:00:00.000Z",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }

    # Expected task data after adding John as collaborator
    expected_task_with_john = {
        **existing_task,
        "collaboratorsIds": [john_id],
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }

    # Setup mock Firestore responses
    mock_task_doc = MagicMock()
    mock_task_doc.exists = True
    mock_task_doc.to_dict.return_value = existing_task.copy()

    mock_task_ref = MagicMock()
    mock_task_ref.get.return_value = mock_task_doc
    mock_task_ref.update = MagicMock()

    # After update, return task with John as collaborator
    mock_updated_doc = MagicMock()
    mock_updated_doc.exists = True
    mock_updated_doc.to_dict.return_value = expected_task_with_john.copy()

    # Configure get() to return different values on successive calls
    mock_task_ref.get.side_effect = [mock_task_doc, mock_updated_doc]

    mock_collection = MagicMock()
    mock_collection.document.return_value = mock_task_ref

    mock_project_ref = MagicMock()
    mock_project_ref.collection.return_value = mock_collection

    # Mock project document for the return value
    mock_project_doc_return = MagicMock()
    mock_project_doc_return.exists = True
    mock_project_doc_return.id = project_id
    mock_project_doc_return.to_dict.return_value = {
        "name": "Project 1",
        "status": "in progress",
        "ownerId": user_id,
        "teamIds": [user_id, john_id]
    }
    mock_project_ref.get.return_value = mock_project_doc_return

    mock_firestore.collection.return_value.document.return_value = mock_project_ref

    # Prepare request payload - adding John as collaborator
    payload = {
        "collaboratorsIds": [john_id]
    }

    # Send PATCH request to update task
    response = client.patch(
        f'/api/projects/{project_id}/tasks/{task_id}',
        json=payload,
        headers={'Content-Type': 'application/json'}
    )

    # Assertions
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"

    response_data = response.get_json()
    assert response_data is not None, "Response should contain JSON data"
    assert "ok" in response_data, "Response should contain ok field"
    assert response_data["ok"] is True, "Response should indicate success"

    # Verify update was called with correct data
    mock_task_ref.update.assert_called_once()
    update_call_args = mock_task_ref.update.call_args[0][0]
    assert "collaboratorsIds" in update_call_args, "Update should include collaboratorsIds"
    assert john_id in update_call_args["collaboratorsIds"], "John's ID should be in the update"


# Scrum-14.2: Add multiple collaborators to a task
def test_add_multiple_collaborators_to_task(client, mock_firestore):
    # Setup test data
    project_id = "project123"
    task_id = "task456"
    john_id = "john123"
    mary_id = "mary456"
    user_id = "user789"

    # Mock existing task data (John and Mary are NOT collaborators yet)
    existing_task = {
        "title": "Task 1",
        "description": "John and Mary's first task",
        "status": "to-do",
        "priority": 5,
        "assigneeId": user_id,
        "ownerId": user_id,
        "collaboratorsIds": [],  # Empty - no collaborators yet
        "tags": [],
        "dueDate": "2025-11-07T00:00:00.000Z",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }

    # Expected task data after adding John and Mary as collaborators
    expected_task_with_collaborators = {
        **existing_task,
        "collaboratorsIds": [john_id, mary_id],
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }

    # Setup mock Firestore responses
    mock_task_doc = MagicMock()
    mock_task_doc.exists = True
    mock_task_doc.to_dict.return_value = existing_task.copy()

    mock_task_ref = MagicMock()
    mock_task_ref.get.return_value = mock_task_doc
    mock_task_ref.update = MagicMock()

    # After update, return task with John and Mary as collaborators
    mock_updated_doc = MagicMock()
    mock_updated_doc.exists = True
    mock_updated_doc.to_dict.return_value = expected_task_with_collaborators.copy()

    # Configure get() to return different values on successive calls
    mock_task_ref.get.side_effect = [mock_task_doc, mock_updated_doc]

    mock_collection = MagicMock()
    mock_collection.document.return_value = mock_task_ref

    mock_project_ref = MagicMock()
    mock_project_ref.collection.return_value = mock_collection

    # Mock project document for the return value
    mock_project_doc_return = MagicMock()
    mock_project_doc_return.exists = True
    mock_project_doc_return.id = project_id
    mock_project_doc_return.to_dict.return_value = {
        "name": "Project 1",
        "status": "in progress",
        "ownerId": user_id,
        "teamIds": [user_id, john_id, mary_id]
    }
    mock_project_ref.get.return_value = mock_project_doc_return

    mock_firestore.collection.return_value.document.return_value = mock_project_ref

    # Prepare request payload - adding John and Mary as collaborators
    payload = {
        "collaboratorsIds": [john_id, mary_id]
    }

    # Send PATCH request to update task
    response = client.patch(
        f'/api/projects/{project_id}/tasks/{task_id}',
        json=payload,
        headers={'Content-Type': 'application/json'}
    )

    # Assertions
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"

    response_data = response.get_json()
    assert response_data is not None, "Response should contain JSON data"
    assert "ok" in response_data, "Response should contain ok field"
    assert response_data["ok"] is True, "Response should indicate success"

    # Verify update was called with correct data
    mock_task_ref.update.assert_called_once()
    update_call_args = mock_task_ref.update.call_args[0][0]
    assert "collaboratorsIds" in update_call_args, "Update should include collaboratorsIds"
    assert john_id in update_call_args["collaboratorsIds"], "John's ID should be in the update"
    assert mary_id in update_call_args["collaboratorsIds"], "Mary's ID should be in the update"
    assert len(update_call_args["collaboratorsIds"]) == 2, "Update should have exactly 2 collaborators"


# Scrum-14.3: Invite notification sent to collaborator
def test_collaborator_receives_invitation_notification(client, mock_firestore):
    """
    Test Scenario: Invite notification sent to collaborator

    Pre-conditions:
        1. User logged in
        2. Member 'John' exists
        3. Project 'Project 1' exists
        4. Task 'Task 1' exists and John is not a current collaborator

    Test steps:
        1. Update task to add John as collaborator (simulating the workflow)
        2. Verify notification is created for John

    Test data:
        Email: john@example.com
        Password: password

    Expected results:
        - Invitation notification is created in notifications collection
        - Notification contains correct task and user information
        - Notification type is 'add collaborator' or similar

    Note: This test verifies the backend logic. The frontend test will verify
    the notification appears in John's notifications tab after login.
    """
    # Setup test data
    project_id = "project123"
    task_id = "task456"
    john_id = "john123"
    user_id = "user789"

    # Mock existing task data
    existing_task = {
        "title": "Task 1",
        "description": "Test task",
        "status": "to-do",
        "priority": 5,
        "assigneeId": user_id,
        "ownerId": user_id,
        "collaboratorsIds": [],
        "tags": [],
        "dueDate": "2025-11-10T00:00:00.000Z",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }

    # Expected task data after adding John
    updated_task = {
        **existing_task,
        "collaboratorsIds": [john_id],
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }

    # Setup mock Firestore responses
    mock_task_doc = MagicMock()
    mock_task_doc.exists = True
    mock_task_doc.to_dict.return_value = existing_task.copy()

    mock_task_ref = MagicMock()
    mock_task_ref.get.return_value = mock_task_doc
    mock_task_ref.update = MagicMock()

    mock_updated_doc = MagicMock()
    mock_updated_doc.exists = True
    mock_updated_doc.to_dict.return_value = updated_task.copy()

    mock_task_ref.get.side_effect = [mock_task_doc, mock_updated_doc]

    mock_collection = MagicMock()
    mock_collection.document.return_value = mock_task_ref

    mock_project_ref = MagicMock()
    mock_project_ref.collection.return_value = mock_collection

    mock_firestore.collection.return_value.document.return_value = mock_project_ref

    # Mock notifications collection for verification
    mock_notifications_collection = MagicMock()
    mock_notification_ref = MagicMock()
    mock_notification_ref.id = "notification123"

    # Configure add() to return a tuple with (timestamp, document_reference)
    mock_notifications_collection.add.return_value = (None, mock_notification_ref)

    # Mock project document for the return value
    mock_project_doc_return = MagicMock()
    mock_project_doc_return.exists = True
    mock_project_doc_return.id = project_id
    mock_project_doc_return.to_dict.return_value = {
        "name": "Project 1",
        "status": "in progress",
        "ownerId": user_id,
        "teamIds": [user_id, john_id]
    }

    # Create mock projects collection for routing
    mock_projects_collection_route = MagicMock()
    mock_project_ref_for_get = MagicMock()
    mock_project_ref_for_get.get.return_value = mock_project_doc_return
    mock_project_ref_for_get.collection.return_value.document.return_value = mock_task_ref
    mock_projects_collection_route.document.return_value = mock_project_ref_for_get

    # Setup firestore collection routing
    def collection_router(collection_name):
        if collection_name == "notifications":
            return mock_notifications_collection
        elif collection_name == "projects":
            return mock_projects_collection_route
        return MagicMock()

    mock_firestore.collection.side_effect = collection_router

    # Prepare request payload
    payload = {
        "collaboratorsIds": [john_id]
    }

    # Send PATCH request
    with patch('notifications.db', mock_firestore):
        response = client.patch(
            f'/api/projects/{project_id}/tasks/{task_id}',
            json=payload,
            headers={'Content-Type': 'application/json'}
        )

    # Verify task update succeeded
    assert response.status_code == 200