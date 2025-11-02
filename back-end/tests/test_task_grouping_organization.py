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


# Scrum-10.1: Create project with valid details
def test_create_project_with_valid_details(client, mock_firestore):
    # Setup test data
    owner_id = "user123"

    # Mock Firestore responses
    mock_project_ref = MagicMock()
    mock_project_ref.id = "project123"

    # Mock add() to return (timestamp, document_reference)
    mock_projects_collection = MagicMock()
    mock_projects_collection.add.return_value = (None, mock_project_ref)

    mock_firestore.collection.return_value = mock_projects_collection

    # Prepare request payload
    payload = {
        "name": "Project 1",
        "description": "My first project",
        "priority": "medium",
        "ownerId": owner_id
    }

    # Send POST request to create project
    response = client.post(
        '/api/projects/',
        json=payload,
        headers={'Content-Type': 'application/json'}
    )

    # Assertions
    assert response.status_code == 201, f"Expected 201, got {response.status_code}"

    response_data = response.get_json()
    assert response_data is not None, "Response should contain JSON data"
    assert "id" in response_data, "Response should contain project ID"
    assert response_data["id"] == "project123", "Project ID should match"
    assert "message" in response_data, "Response should contain message"

    # Verify add was called with correct data
    mock_projects_collection.add.assert_called_once()
    project_data = mock_projects_collection.add.call_args[0][0]

    # Verify project details
    assert project_data["name"] == "Project 1", "Project name should match"
    assert project_data["description"] == "My first project", "Description should match"
    assert project_data["priority"] == "medium", "Priority should be medium"
    assert project_data["ownerId"] == owner_id, "Owner ID should match"

    # Verify progress is initialized to 0
    assert project_data["progress"] == 0, "Progress should be initialized to 0%"

    # Verify team has 1 member (the owner)
    assert "teamIds" in project_data, "Project should have teamIds"
    assert owner_id in project_data["teamIds"], "Owner should be in team"
    assert len(project_data["teamIds"]) == 1, "Team should have exactly 1 member"

    # Verify timestamps are set
    assert "createdAt" in project_data, "Project should have createdAt"
    assert "updatedAt" in project_data, "Project should have updatedAt"


# Scrum-10.2: Input validation for new project details
def test_create_project_without_name_validation(client, mock_firestore):
    # Setup test data
    owner_id = "user123"

    # Mock Firestore responses
    mock_project_ref = MagicMock()
    mock_project_ref.id = "project123"

    # Mock add() to return (timestamp, document_reference)
    mock_projects_collection = MagicMock()
    mock_projects_collection.add.return_value = (None, mock_project_ref)

    mock_firestore.collection.return_value = mock_projects_collection

    # Prepare request payload with empty name
    payload = {
        "name": "",  # Empty name - should be converted to "Untitled Project"
        "description": "My first project",
        "priority": "medium",
        "ownerId": owner_id
    }

    # Send POST request to create project
    response = client.post(
        '/api/projects/',
        json=payload,
        headers={'Content-Type': 'application/json'}
    )

    # Assertions
    # Backend accepts but converts empty name to "Untitled Project"
    assert response.status_code == 201, f"Expected 201, got {response.status_code}"

    response_data = response.get_json()
    assert response_data is not None, "Response should contain JSON data"
    assert "id" in response_data, "Response should contain project ID"

    # Verify add was called with "Untitled Project" as the name
    mock_projects_collection.add.assert_called_once()
    project_data = mock_projects_collection.add.call_args[0][0]

    # Verify empty name was converted to "Untitled Project"
    assert project_data["name"] == "Untitled Project", "Empty name should be converted to 'Untitled Project'"

    # Note: The frontend should prevent this scenario by disabling the
    # "Create Project" button when name is empty (tested in frontend tests)


# Scrum-122.1: Search for collaborators to be added to project
def test_search_users_for_project_collaboration(client, mock_firestore):
    # Setup test data
    john_user = {
        "uid": "john123",
        "fullName": "John",
        "email": "john@example.com",
        "status": "new",
        "priority": "medium",
        "collaboratorsIds": [],
        "tags": [],
        "ownerId": "",
        "description": "",
        "title": ""
    }

    other_user = {
        "uid": "mary456",
        "fullName": "Mary",
        "email": "mary@example.com",
        "status": "new",
        "priority": "medium",
        "collaboratorsIds": [],
        "tags": [],
        "ownerId": "",
        "description": "",
        "title": ""
    }

    # Mock Firestore responses
    mock_john_doc = MagicMock()
    mock_john_doc.id = "john123"
    mock_john_doc.to_dict.return_value = john_user.copy()

    mock_mary_doc = MagicMock()
    mock_mary_doc.id = "mary456"
    mock_mary_doc.to_dict.return_value = other_user.copy()

    mock_users_collection = MagicMock()
    mock_users_collection.stream.return_value = [mock_john_doc, mock_mary_doc]

    mock_firestore.collection.return_value = mock_users_collection

    # Send GET request to fetch users
    with patch('users.db', mock_firestore):
        response = client.get('/api/users/')

    # Assertions
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"

    response_data = response.get_json()
    assert response_data is not None, "Response should contain JSON data"
    assert isinstance(response_data, list), "Response should be a list of users"
    assert len(response_data) >= 1, "Should have at least 1 user"

    # Find John in the results
    john_results = [user for user in response_data if "John" in user.get("fullName", "")]
    assert len(john_results) > 0, "John should appear in search results"

    # Verify John's data
    john_data = john_results[0]
    assert john_data["fullName"] == "John", "John's fullName should match"
    assert john_data["email"] == "john@example.com", "John's email should match"
    assert "id" in john_data, "User should have an id field"

    # Verify search results can be filtered by name
    # (Frontend will implement the actual search/filter logic)
    all_users = response_data
    search_term = "john"
    filtered_users = [u for u in all_users if search_term.lower() in u.get("fullName", "").lower()]
    assert len(filtered_users) > 0, "Search for 'john' should return results"
    assert any(u["fullName"] == "John" for u in filtered_users), "John should be in filtered results"


# Scrum-122.2: Search for non-existent collaborators
def test_search_for_nonexistent_user(client, mock_firestore):
    # Setup test data - only John and Mary exist, Bob does NOT exist
    john_user = {
        "uid": "john123",
        "fullName": "John",
        "email": "john@example.com",
        "status": "new",
        "priority": "medium",
        "collaboratorsIds": [],
        "tags": [],
        "ownerId": "",
        "description": "",
        "title": ""
    }

    mary_user = {
        "uid": "mary456",
        "fullName": "Mary",
        "email": "mary@example.com",
        "status": "new",
        "priority": "medium",
        "collaboratorsIds": [],
        "tags": [],
        "ownerId": "",
        "description": "",
        "title": ""
    }

    # Mock Firestore responses - no Bob in the database
    mock_john_doc = MagicMock()
    mock_john_doc.id = "john123"
    mock_john_doc.to_dict.return_value = john_user.copy()

    mock_mary_doc = MagicMock()
    mock_mary_doc.id = "mary456"
    mock_mary_doc.to_dict.return_value = mary_user.copy()

    mock_users_collection = MagicMock()
    mock_users_collection.stream.return_value = [mock_john_doc, mock_mary_doc]

    mock_firestore.collection.return_value = mock_users_collection

    # Send GET request to fetch users
    with patch('users.db', mock_firestore):
        response = client.get('/api/users/')

    # Assertions
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"

    response_data = response.get_json()
    assert response_data is not None, "Response should contain JSON data"
    assert isinstance(response_data, list), "Response should be a list of users"

    # Verify Bob is NOT in the results
    bob_results = [user for user in response_data if "Bob" in user.get("fullName", "")]
    assert len(bob_results) == 0, "Bob should NOT appear in search results"

    # Verify search for 'Bob' returns empty list
    all_users = response_data
    search_term = "bob"
    filtered_users = [u for u in all_users if search_term.lower() in u.get("fullName", "").lower()]
    assert len(filtered_users) == 0, "Search for 'bob' should return no results"

    # Verify only John and Mary exist in the database
    user_names = [u.get("fullName") for u in response_data]
    assert "John" in user_names, "John should be in the results"
    assert "Mary" in user_names, "Mary should be in the results"
    assert "Bob" not in user_names, "Bob should NOT be in the results"
    assert len(response_data) == 2, "Should have exactly 2 users (John and Mary)"


# Scrum-122.3: Collaborator is successfully added to the project
def test_add_collaborator_to_project(client, mock_firestore):
    # Setup test data
    project_id = "project123"
    owner_id = "user123"
    john_id = "john123"

    # Mock existing project data (John is NOT a team member yet)
    existing_project = {
        "name": "Project 1",
        "description": "My first project",
        "priority": "medium",
        "ownerId": owner_id,
        "teamIds": [owner_id],  # Only owner is in team
        "progress": 0,
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc),
    }

    # Expected project data after adding John
    updated_project = {
        **existing_project,
        "teamIds": [owner_id, john_id],  # John is now in team
        "updatedAt": datetime.now(timezone.utc),
    }

    # Setup mock Firestore responses
    mock_project_doc = MagicMock()
    mock_project_doc.exists = True
    mock_project_doc.to_dict.return_value = existing_project.copy()

    mock_project_ref = MagicMock()
    mock_project_ref.get.return_value = mock_project_doc
    mock_project_ref.update = MagicMock()

    # After update, return project with John in team
    mock_updated_doc = MagicMock()
    mock_updated_doc.exists = True
    mock_updated_doc.to_dict.return_value = updated_project.copy()
    mock_updated_doc.id = project_id

    # Configure get() to return different values on successive calls
    mock_project_ref.get.side_effect = [mock_project_doc, mock_updated_doc]

    mock_projects_collection = MagicMock()
    mock_projects_collection.document.return_value = mock_project_ref

    mock_firestore.collection.return_value = mock_projects_collection

    # Prepare request payload - adding John to team
    payload = {
        "userId": owner_id,  # Required field for authorization
        "teamIds": [owner_id, john_id]
    }

    # Send PUT request to update project
    response = client.put(
        f'/api/projects/{project_id}',
        json=payload,
        headers={'Content-Type': 'application/json'}
    )

    # Assertions
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"

    response_data = response.get_json()
    assert response_data is not None, "Response should contain JSON data"
    assert "message" in response_data, "Response should contain success message"
    assert response_data["message"] == "Project updated", "Message should indicate project was updated"

    # Verify update was called with correct data
    mock_project_ref.update.assert_called_once()
    update_call_args = mock_project_ref.update.call_args[0][0]
    assert "teamIds" in update_call_args, "Update should include teamIds"
    assert john_id in update_call_args["teamIds"], "John's ID should be in the update"
    assert owner_id in update_call_args["teamIds"], "Owner should remain in team"
    assert len(update_call_args["teamIds"]) == 2, "Should have exactly 2 team members in update"