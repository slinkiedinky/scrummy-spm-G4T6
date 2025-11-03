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


# Scrum-123: View all projects that the current user has access to
def test_view_all_projects_user_has_access_to(client, mock_firestore):
    # Setup test data
    user_id = "user123"

    # Mock project data - user is part of both projects
    project1 = {
        "name": "Project 1",
        "description": "My first project",
        "status": "In Progress",
        "priority": "high",
        "ownerId": user_id,
        "teamIds": [user_id],
        "progress": 0,
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc),
    }

    project2 = {
        "name": "Project 2",
        "description": "My second project",
        "status": "To Do",
        "priority": "medium",
        "ownerId": "other_user",
        "teamIds": [user_id, "other_user"],  # User is a team member
        "progress": 0,
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc),
    }

    # Mock Firestore responses
    mock_project1_doc = MagicMock()
    mock_project1_doc.id = "project1_id"
    mock_project1_doc.to_dict.return_value = project1.copy()

    mock_project2_doc = MagicMock()
    mock_project2_doc.id = "project2_id"
    mock_project2_doc.to_dict.return_value = project2.copy()

    # Mock the where().stream() query chain
    mock_query = MagicMock()
    mock_query.stream.return_value = [mock_project1_doc, mock_project2_doc]

    mock_projects_collection = MagicMock()
    mock_projects_collection.where.return_value = mock_query

    mock_firestore.collection.return_value = mock_projects_collection

    # Mock calculate_project_progress to avoid accessing subcollections
    with patch('projects.calculate_project_progress', return_value=0):
        # Send GET request to fetch all projects with userId parameter
        response = client.get(f'/api/projects/?userId={user_id}')

        # Assertions
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        response_data = response.get_json()
        assert response_data is not None, "Response should contain JSON data"
        assert isinstance(response_data, list), "Response should be a list of projects"

        # Filter projects where user is a team member
        user_projects = [p for p in response_data if user_id in p.get("teamIds", [])]
        assert len(user_projects) == 2, "User should have access to 2 projects"

        # Verify Project 1
        project1_results = [p for p in user_projects if p.get("name") == "Project 1"]
        assert len(project1_results) == 1, "Project 1 should be in results"

        project1_data = project1_results[0]
        assert project1_data["name"] == "Project 1", "Project 1 name should match"
        assert project1_data["description"] == "My first project", "Project 1 description should match"
        assert project1_data["status"] == "In Progress", "Project 1 status should be 'In Progress'"
        assert project1_data["priority"] == "high", "Project 1 priority should be 'high'"
        assert project1_data["ownerId"] == user_id, "Project 1 owner should be user"
        assert "id" in project1_data, "Project should have an id field"

        # Verify Project 2
        project2_results = [p for p in user_projects if p.get("name") == "Project 2"]
        assert len(project2_results) == 1, "Project 2 should be in results"

        project2_data = project2_results[0]
        assert project2_data["name"] == "Project 2", "Project 2 name should match"
        assert project2_data["description"] == "My second project", "Project 2 description should match"
        assert project2_data["status"] == "To Do", "Project 2 status should be 'To Do'"
        assert project2_data["priority"] == "medium", "Project 2 priority should be 'medium'"
        assert user_id in project2_data["teamIds"], "User should be in Project 2 team"
        assert "id" in project2_data, "Project should have an id field"


# Scrum-124: View project descriptions in projects tab
def test_view_project_description_in_projects_tab(client, mock_firestore):
    # Setup test data
    user_id = "user123"

    # Mock project data with description
    project1 = {
        "name": "Project 1",
        "description": "My first project",
        "status": "In Progress",
        "priority": "high",
        "ownerId": user_id,
        "teamIds": [user_id],
        "progress": 0,
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc),
    }

    # Mock Firestore responses
    mock_project1_doc = MagicMock()
    mock_project1_doc.id = "project1_id"
    mock_project1_doc.to_dict.return_value = project1.copy()

    # Mock the where().stream() query chain
    mock_query = MagicMock()
    mock_query.stream.return_value = [mock_project1_doc]

    mock_projects_collection = MagicMock()
    mock_projects_collection.where.return_value = mock_query

    mock_firestore.collection.return_value = mock_projects_collection

    # Mock calculate_project_progress to avoid accessing subcollections
    with patch('projects.calculate_project_progress', return_value=0):
        # Send GET request to fetch all projects with userId parameter
        response = client.get(f'/api/projects/?userId={user_id}')

        # Assertions
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        response_data = response.get_json()
        assert response_data is not None, "Response should contain JSON data"
        assert isinstance(response_data, list), "Response should be a list of projects"
        assert len(response_data) >= 1, "Should have at least 1 project"

        # Find Project 1 in the results
        project1_results = [p for p in response_data if p.get("name") == "Project 1"]
        assert len(project1_results) == 1, "Project 1 should be in results"

        # Verify Project 1 details including description
        project1_data = project1_results[0]
        assert project1_data["name"] == "Project 1", "Project name should be 'Project 1'"
        assert project1_data["description"] == "My first project", "Description should be 'My first project'"
        assert project1_data["status"] == "In Progress", "Status should be 'In Progress'"
        assert project1_data["priority"] == "high", "Priority should be 'high'"
        assert "id" in project1_data, "Project should have an id field"

        # Verify description field is present and not empty
        assert "description" in project1_data, "Project should have a description field"
        assert project1_data["description"].strip() != "", "Description should not be empty"


# Scrum-125: View project status in projects tab
def test_view_project_status_in_projects_tab(client, mock_firestore):
    # Setup test data
    user_id = "user123"

    # Mock project data with status
    project1 = {
        "name": "Project 1",
        "description": "My first project",
        "status": "In Progress",
        "priority": "high",
        "ownerId": user_id,
        "teamIds": [user_id],
        "progress": 0,
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc),
    }

    # Mock Firestore responses
    mock_project1_doc = MagicMock()
    mock_project1_doc.id = "project1_id"
    mock_project1_doc.to_dict.return_value = project1.copy()

    # Mock the where().stream() query chain
    mock_query = MagicMock()
    mock_query.stream.return_value = [mock_project1_doc]

    mock_projects_collection = MagicMock()
    mock_projects_collection.where.return_value = mock_query

    mock_firestore.collection.return_value = mock_projects_collection

    # Mock calculate_project_progress to avoid accessing subcollections
    with patch('projects.calculate_project_progress', return_value=0):
        # Send GET request to fetch all projects with userId parameter
        response = client.get(f'/api/projects/?userId={user_id}')

        # Assertions
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        response_data = response.get_json()
        assert response_data is not None, "Response should contain JSON data"
        assert isinstance(response_data, list), "Response should be a list of projects"
        assert len(response_data) >= 1, "Should have at least 1 project"

        # Find Project 1 in the results
        project1_results = [p for p in response_data if p.get("name") == "Project 1"]
        assert len(project1_results) == 1, "Project 1 should be in results"

        # Verify Project 1 is displayed with status 'In Progress'
        project1_data = project1_results[0]
        assert project1_data["name"] == "Project 1", "Project name should be 'Project 1'"
        assert project1_data["status"] == "In Progress", "Status should be 'In Progress'"
        assert project1_data["description"] == "My first project", "Description should match"
        assert project1_data["priority"] == "high", "Priority should be 'high'"
        assert "id" in project1_data, "Project should have an id field"

        # Verify status field is present and not empty
        assert "status" in project1_data, "Project should have a status field"
        assert project1_data["status"].strip() != "", "Status should not be empty"


# Scrum-126: View project priority in projects tab
def test_view_project_priority_in_projects_tab(client, mock_firestore):
    # Setup test data
    user_id = "user123"

    # Mock project data with priority
    project1 = {
        "name": "Project 1",
        "description": "My first project",
        "status": "In Progress",
        "priority": "high",
        "ownerId": user_id,
        "teamIds": [user_id],
        "progress": 0,
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc),
    }

    # Mock Firestore responses
    mock_project1_doc = MagicMock()
    mock_project1_doc.id = "project1_id"
    mock_project1_doc.to_dict.return_value = project1.copy()

    # Mock the where().stream() query chain
    mock_query = MagicMock()
    mock_query.stream.return_value = [mock_project1_doc]

    mock_projects_collection = MagicMock()
    mock_projects_collection.where.return_value = mock_query

    mock_firestore.collection.return_value = mock_projects_collection

    # Mock calculate_project_progress to avoid accessing subcollections
    with patch('projects.calculate_project_progress', return_value=0):
        # Send GET request to fetch all projects with userId parameter
        response = client.get(f'/api/projects/?userId={user_id}')

        # Assertions
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        response_data = response.get_json()
        assert response_data is not None, "Response should contain JSON data"
        assert isinstance(response_data, list), "Response should be a list of projects"
        assert len(response_data) >= 1, "Should have at least 1 project"

        # Find Project 1 in the results
        project1_results = [p for p in response_data if p.get("name") == "Project 1"]
        assert len(project1_results) == 1, "Project 1 should be in results"

        # Verify Project 1 is displayed with priority 'high'
        project1_data = project1_results[0]
        assert project1_data["name"] == "Project 1", "Project name should be 'Project 1'"
        assert project1_data["priority"] == "high", "Priority should be 'high'"
        assert project1_data["description"] == "My first project", "Description should match"
        assert project1_data["status"] == "In Progress", "Status should match"
        assert "id" in project1_data, "Project should have an id field"

        # Verify priority field is present and not empty
        assert "priority" in project1_data, "Project should have a priority field"
        assert project1_data["priority"] in ["low", "medium", "high"], "Priority should be valid"


# Scrum-127: View project page containing project name
def test_view_project_page_with_project_name(client, mock_firestore):
    # Setup test data
    project_id = "project123"
    user_id = "user123"

    # Mock project data
    project_data = {
        "name": "Project 1",
        "description": "My first project",
        "status": "In Progress",
        "priority": "high",
        "ownerId": user_id,
        "teamIds": [user_id],
        "progress": 0,
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

    # Mock calculate_project_progress to avoid accessing subcollections
    with patch('projects.calculate_project_progress', return_value=0):
        # Send GET request to view project details
        response = client.get(f'/api/projects/{project_id}?assignedTo={user_id}')

        # Assertions
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        response_data = response.get_json()
        assert response_data is not None, "Response should contain JSON data"

        # Verify project page displays project name 'Project 1'
        assert response_data["name"] == "Project 1", "Project name should be 'Project 1'"
        assert response_data["description"] == "My first project", "Description should match"
        assert response_data["status"] == "In Progress", "Status should match"
        assert response_data["priority"] == "high", "Priority should match"
        assert response_data["id"] == project_id, "Project ID should match"

        # Verify name field is present and not empty
        assert "name" in response_data, "Project should have a name field"
        assert response_data["name"].strip() != "", "Project name should not be empty"


# Scrum-128: View project page containing project description
def test_view_project_page_with_project_description(client, mock_firestore):
    # Setup test data
    project_id = "project123"
    user_id = "user123"

    # Mock project data
    project_data = {
        "name": "Project 1",
        "description": "My first project",
        "status": "In Progress",
        "priority": "high",
        "ownerId": user_id,
        "teamIds": [user_id],
        "progress": 0,
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

    # Mock calculate_project_progress to avoid accessing subcollections
    with patch('projects.calculate_project_progress', return_value=0):
        # Send GET request to view project details
        response = client.get(f'/api/projects/{project_id}?assignedTo={user_id}')

        # Assertions
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        response_data = response.get_json()
        assert response_data is not None, "Response should contain JSON data"

        # Verify project page displays project description 'My first project'
        assert response_data["description"] == "My first project", "Description should be 'My first project'"
        assert response_data["name"] == "Project 1", "Name should match"
        assert response_data["status"] == "In Progress", "Status should match"
        assert response_data["priority"] == "high", "Priority should match"
        assert response_data["id"] == project_id, "Project ID should match"

        # Verify description field is present and not empty
        assert "description" in response_data, "Project should have a description field"
        assert response_data["description"].strip() != "", "Project description should not be empty"


# Scrum-129: View project page containing project status
def test_view_project_page_with_project_status(client, mock_firestore):
    # Setup test data
    project_id = "project123"
    user_id = "user123"

    # Mock project data
    project_data = {
        "name": "Project 1",
        "description": "My first project",
        "status": "In Progress",
        "priority": "high",
        "ownerId": user_id,
        "teamIds": [user_id],
        "progress": 0,
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

    # Mock calculate_project_progress to avoid accessing subcollections
    with patch('projects.calculate_project_progress', return_value=0):
        # Send GET request to view project details
        response = client.get(f'/api/projects/{project_id}?assignedTo={user_id}')

        # Assertions
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        response_data = response.get_json()
        assert response_data is not None, "Response should contain JSON data"

        # Verify project page displays project status 'In Progress'
        assert response_data["status"] == "In Progress", "Status should be 'In Progress'"
        assert response_data["name"] == "Project 1", "Name should match"
        assert response_data["description"] == "My first project", "Description should match"
        assert response_data["priority"] == "high", "Priority should match"
        assert response_data["id"] == project_id, "Project ID should match"

        # Verify status field is present and not empty
        assert "status" in response_data, "Project should have a status field"
        assert response_data["status"].strip() != "", "Project status should not be empty"


# Scrum-130: View project page containing project priority
def test_view_project_page_with_project_priority(client, mock_firestore):
    # Setup test data
    project_id = "project123"
    user_id = "user123"

    # Mock project data
    project_data = {
        "name": "Project 1",
        "description": "My first project",
        "status": "In Progress",
        "priority": "high",
        "ownerId": user_id,
        "teamIds": [user_id],
        "progress": 0,
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

    # Mock calculate_project_progress to avoid accessing subcollections
    with patch('projects.calculate_project_progress', return_value=0):
        # Send GET request to view project details
        response = client.get(f'/api/projects/{project_id}?assignedTo={user_id}')

        # Assertions
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        response_data = response.get_json()
        assert response_data is not None, "Response should contain JSON data"

        # Verify project page displays project priority 'high'
        assert response_data["priority"] == "high", "Priority should be 'high'"
        assert response_data["name"] == "Project 1", "Name should match"
        assert response_data["description"] == "My first project", "Description should match"
        assert response_data["status"] == "In Progress", "Status should match"
        assert response_data["id"] == project_id, "Project ID should match"

        # Verify priority field is present and not empty
        assert "priority" in response_data, "Project should have a priority field"
        assert response_data["priority"].strip() != "", "Project priority should not be empty"


# Scrum-131: View timeline tab on project page
def test_view_timeline_tab_on_project_page(client, mock_firestore):
    # Setup test data
    project_id = "project123"
    user_id = "user123"

    # Mock project data
    project_data = {
        "name": "Project 1",
        "description": "My first project",
        "status": "In Progress",
        "priority": "high",
        "ownerId": user_id,
        "teamIds": [user_id],
        "progress": 0,
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

    # Mock calculate_project_progress to avoid accessing subcollections
    with patch('projects.calculate_project_progress', return_value=0):
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
        assert response_data["status"] == "In Progress", "Status should match"
        assert response_data["priority"] == "high", "Priority should match"
        assert response_data["id"] == project_id, "Project ID should match"

        # Verify project has the required fields for timeline functionality
        assert "id" in response_data, "Project should have an id field for timeline"
        assert "createdAt" in response_data or response_data.get("id"), "Project should support timeline tracking"


# Scrum-132: View team member's active tasks and due dates on project timeline
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
        "status": "In Progress",
        "priority": "high",
        "ownerId": user_id,
        "teamIds": [user_id, john_id],
        "progress": 0,
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
    response = client.get(f'/api/projects/{project_id}/tasks?userId={user_id}')

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


# Scrum-133: View team member's completed tasks on project timeline
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
        "status": "In Progress",
        "priority": "high",
        "ownerId": user_id,
        "teamIds": [user_id, john_id],
        "progress": 0,
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
    response = client.get(f'/api/projects/{project_id}/tasks?userId={user_id}')

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


# Scrum-134: View due dates for a specific day
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
        "status": "In Progress",
        "priority": "high",
        "ownerId": user_id,
        "teamIds": [user_id, john_id],
        "progress": 0,
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
    response = client.get(f'/api/projects/{project_id}/tasks?userId={user_id}')

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
