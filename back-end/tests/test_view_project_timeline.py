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


# Scrum-137.1: View timeline tab on project page
def test_view_timeline_tab_on_project_page(client, mock_firestore):
    # Setup test data
    project_id = "project123"
    user_id = "user123"

    # Mock project data
    project_data = {
        "name": "Project 1",
        "description": "My first project",
        "status": "in progress",
        "priority": "high",
        "ownerId": user_id,
        "teamIds": [user_id],
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc),
    }

    # Mock Firestore responses
    mock_project_doc = MagicMock()
    mock_project_doc.exists = True
    mock_project_doc.to_dict.return_value = project_data.copy()
    mock_project_doc.id = project_id

    mock_project_ref = MagicMock()
    mock_project_ref.get.return_value = mock_project_doc

    mock_projects_collection = MagicMock()
    mock_projects_collection.document.return_value = mock_project_ref

    mock_firestore.collection.return_value = mock_projects_collection

    # Send GET request to view project details
    response = client.get(f'/api/projects/{project_id}?assignedTo={user_id}')

    # Assertions
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"

    response_data = response.get_json()
    assert response_data is not None, "Response should contain JSON data"

    # Verify project page contains necessary data for timeline tab
    # The timeline tab would be rendered on the frontend based on project data
    assert response_data["name"] == "Project 1", "Name should match"
    assert response_data["description"] == "My first project", "Description should match"
    assert response_data["status"] == "in progress", "Status should match"
    assert response_data["priority"] == "high", "Priority should match"
    assert response_data["id"] == project_id, "Project ID should match"

    # Verify project has the required fields for timeline functionality
    assert "id" in response_data, "Project should have an id field for timeline"
    assert "createdAt" in response_data or response_data.get("id"), "Project should support timeline tracking"


# Scrum-137.2: View team member's active tasks and due dates on project timeline
def test_view_team_member_tasks_on_project_timeline(client, mock_firestore):
    # Setup test data
    project_id = "project123"
    user_id = "user123"
    john_id = "john123"
    task_id = "task123"

    # Mock project data
    project_data = {
        "name": "Project 1",
        "description": "My first project",
        "status": "in progress",
        "priority": "high",
        "ownerId": user_id,
        "teamIds": [user_id, john_id],
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc),
    }

    # Mock task data - Task 1 assigned to John with due date 07/11/2025
    task_data = {
        "name": "Task 1",
        "description": "John's first task",
        "status": "to-do",
        "priority": 5,
        "dueDate": datetime(2025, 11, 7, tzinfo=timezone.utc),
        "assigneeId": john_id,
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc),
    }

    # Mock Firestore responses for project
    mock_project_doc = MagicMock()
    mock_project_doc.exists = True
    mock_project_doc.to_dict.return_value = project_data.copy()
    mock_project_doc.id = project_id

    # Mock Firestore responses for tasks
    mock_task_doc = MagicMock()
    mock_task_doc.id = task_id
    mock_task_doc.to_dict.return_value = task_data.copy()

    # Mock the collection structure
    mock_tasks_collection = MagicMock()
    mock_tasks_collection.stream.return_value = [mock_task_doc]

    mock_project_ref = MagicMock()
    mock_project_ref.get.return_value = mock_project_doc
    mock_project_ref.collection.return_value = mock_tasks_collection

    mock_projects_collection = MagicMock()
    mock_projects_collection.document.return_value = mock_project_ref

    # Setup collection routing
    def mock_collection_router(collection_name):
        if collection_name == "projects":
            return mock_projects_collection
        return MagicMock()

    mock_firestore.collection.side_effect = mock_collection_router

    # Step 1 & 2: Open projects tab and view project details (already tested)
    # Step 3: Get tasks for timeline tab
    response = client.get(f'/api/projects/{project_id}/tasks?assignedTo={user_id}')

    # Assertions
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"

    response_data = response.get_json()
    assert response_data is not None, "Response should contain JSON data"
    assert isinstance(response_data, list), "Response should be a list of tasks"

    # Verify Task 1 is in the response
    assert len(response_data) >= 1, "Should have at least 1 task"

    task1 = response_data[0]
    assert task1["name"] == "Task 1", "Task name should be 'Task 1'"
    assert task1["description"] == "John's first task", "Task description should match"
    assert task1["status"] == "to-do", "Task status should be 'to-do'"
    assert task1["priority"] == 5, "Task priority should be 5"
    assert task1["assigneeId"] == john_id, "Task should be assigned to John"

    # Verify due date is present for timeline display
    assert "dueDate" in task1, "Task should have a dueDate field for timeline"
    assert task1["dueDate"] is not None, "Task dueDate should not be None"

    # The expected result is that 07/11/2025 is shaded black on the timeline with badge '1'
    # This would be handled by the frontend, but the backend must provide the task data
    # including the due date
    if isinstance(task1["dueDate"], str):
        # Parse the date string (format: 'Fri, 07 Nov 2025 00:00:00 GMT')
        from email.utils import parsedate_to_datetime
        task_due_date = parsedate_to_datetime(task1["dueDate"])
    else:
        task_due_date = task1["dueDate"]

    assert task_due_date.year == 2025, "Due date year should be 2025"
    assert task_due_date.month == 11, "Due date month should be 11 (November)"
    assert task_due_date.day == 7, "Due date day should be 7"


# Scrum-137.3: View team member's completed tasks on project timeline
def test_view_team_member_completed_tasks_on_project_timeline(client, mock_firestore):
    # Setup test data
    project_id = "project123"
    user_id = "user123"
    john_id = "john123"
    task_id = "task123"

    # Mock project data
    project_data = {
        "name": "Project 1",
        "description": "My first project",
        "status": "in progress",
        "priority": "high",
        "ownerId": user_id,
        "teamIds": [user_id, john_id],
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc),
    }

    # Mock task data - Task 1 assigned to John and completed with due date 07/11/2025
    task_data = {
        "name": "Task 1",
        "description": "John's first task",
        "status": "completed",
        "priority": 5,
        "dueDate": datetime(2025, 11, 7, tzinfo=timezone.utc),
        "assigneeId": john_id,
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc),
    }

    # Mock Firestore responses for project
    mock_project_doc = MagicMock()
    mock_project_doc.exists = True
    mock_project_doc.to_dict.return_value = project_data.copy()
    mock_project_doc.id = project_id

    # Mock Firestore responses for tasks
    mock_task_doc = MagicMock()
    mock_task_doc.id = task_id
    mock_task_doc.to_dict.return_value = task_data.copy()

    # Mock the collection structure
    mock_tasks_collection = MagicMock()
    mock_tasks_collection.stream.return_value = [mock_task_doc]

    mock_project_ref = MagicMock()
    mock_project_ref.get.return_value = mock_project_doc
    mock_project_ref.collection.return_value = mock_tasks_collection

    mock_projects_collection = MagicMock()
    mock_projects_collection.document.return_value = mock_project_ref

    # Setup collection routing
    def mock_collection_router(collection_name):
        if collection_name == "projects":
            return mock_projects_collection
        return MagicMock()

    mock_firestore.collection.side_effect = mock_collection_router

    # Step 1 & 2: Open projects tab and view project details (already tested)
    # Step 3: Get tasks for timeline tab
    response = client.get(f'/api/projects/{project_id}/tasks?assignedTo={user_id}')

    # Assertions
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"

    response_data = response.get_json()
    assert response_data is not None, "Response should contain JSON data"
    assert isinstance(response_data, list), "Response should be a list of tasks"

    # Verify Task 1 is in the response
    assert len(response_data) >= 1, "Should have at least 1 task"

    task1 = response_data[0]
    assert task1["name"] == "Task 1", "Task name should be 'Task 1'"
    assert task1["description"] == "John's first task", "Task description should match"
    assert task1["status"] == "completed", "Task status should be 'completed'"
    assert task1["priority"] == 5, "Task priority should be 5"
    assert task1["assigneeId"] == john_id, "Task should be assigned to John"

    # Verify due date is present for timeline display
    assert "dueDate" in task1, "Task should have a dueDate field for timeline"
    assert task1["dueDate"] is not None, "Task dueDate should not be None"

    # The expected result is that 07/11/2025 is shaded green on the timeline with badge '1'
    # The frontend will render completed tasks with green color based on status
    # Backend must provide both the task status and due date
    if isinstance(task1["dueDate"], str):
        # Parse the date string (format: 'Fri, 07 Nov 2025 00:00:00 GMT')
        from email.utils import parsedate_to_datetime
        task_due_date = parsedate_to_datetime(task1["dueDate"])
    else:
        task_due_date = task1["dueDate"]

    assert task_due_date.year == 2025, "Due date year should be 2025"
    assert task_due_date.month == 11, "Due date month should be 11 (November)"
    assert task_due_date.day == 7, "Due date day should be 7"


# Scrum-137.4: View due dates for a specific day
def test_view_due_dates_for_specific_day(client, mock_firestore):
    # Setup test data
    project_id = "project123"
    user_id = "user123"
    john_id = "john123"
    task_id = "task123"

    # Mock project data
    project_data = {
        "name": "Project 1",
        "description": "My first project",
        "status": "in progress",
        "priority": "high",
        "ownerId": user_id,
        "teamIds": [user_id, john_id],
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc),
    }

    # Mock task data - Task 1 assigned to John with due date 07/11/2025
    task_data = {
        "name": "Task 1",
        "description": "John's first task",
        "status": "to-do",
        "priority": 5,
        "dueDate": datetime(2025, 11, 7, tzinfo=timezone.utc),
        "assigneeId": john_id,
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc),
    }

    # Mock Firestore responses for project
    mock_project_doc = MagicMock()
    mock_project_doc.exists = True
    mock_project_doc.to_dict.return_value = project_data.copy()
    mock_project_doc.id = project_id

    # Mock Firestore responses for tasks
    mock_task_doc = MagicMock()
    mock_task_doc.id = task_id
    mock_task_doc.to_dict.return_value = task_data.copy()

    # Mock the collection structure
    mock_tasks_collection = MagicMock()
    mock_tasks_collection.stream.return_value = [mock_task_doc]

    mock_project_ref = MagicMock()
    mock_project_ref.get.return_value = mock_project_doc
    mock_project_ref.collection.return_value = mock_tasks_collection

    mock_projects_collection = MagicMock()
    mock_projects_collection.document.return_value = mock_project_ref

    # Setup collection routing
    def mock_collection_router(collection_name):
        if collection_name == "projects":
            return mock_projects_collection
        return MagicMock()

    mock_firestore.collection.side_effect = mock_collection_router

    # Step 1 & 2: Open projects tab and view project details (already tested)
    # Step 3: Select timeline tab and get tasks
    response = client.get(f'/api/projects/{project_id}/tasks?assignedTo={user_id}')

    # Assertions
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"

    response_data = response.get_json()
    assert response_data is not None, "Response should contain JSON data"
    assert isinstance(response_data, list), "Response should be a list of tasks"

    # Step 4: Select the circle for 07/11/2025 - filter tasks by due date
    # The frontend would filter tasks with dueDate matching the selected date
    assert len(response_data) >= 1, "Should have at least 1 task"

    # Filter tasks due on 07/11/2025
    target_date = datetime(2025, 11, 7, tzinfo=timezone.utc)
    tasks_due_on_date = []

    for task in response_data:
        if "dueDate" in task and task["dueDate"]:
            if isinstance(task["dueDate"], str):
                from email.utils import parsedate_to_datetime
                task_due_date = parsedate_to_datetime(task["dueDate"])
            else:
                task_due_date = task["dueDate"]

            if (task_due_date.year == target_date.year and
                task_due_date.month == target_date.month and
                task_due_date.day == target_date.day):
                tasks_due_on_date.append(task)

    # Expected results: Timeline expands to show task details for 07/11/2025
    assert len(tasks_due_on_date) == 1, "Should have exactly 1 task due on 07/11/2025"

    task1 = tasks_due_on_date[0]
    # Verify all task details are present for expanded view
    assert task1["name"] == "Task 1", "Task name should be 'Task 1'"
    assert task1["description"] == "John's first task", "Task description should match"
    assert task1["status"] == "to-do", "Task status should be 'to-do'"
    assert task1["priority"] == 5, "Task priority should be 5"
    assert task1["assigneeId"] == john_id, "Task should be assigned to John"

    # Verify all required fields are present for timeline expansion
    assert "name" in task1, "Task should have name field"
    assert "description" in task1, "Task should have description field"
    assert "status" in task1, "Task should have status field"
    assert "priority" in task1, "Task should have priority field"
    assert "assigneeId" in task1, "Task should have assigneeId field"
