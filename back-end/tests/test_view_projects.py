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


# Scrum-123: View all projects that the current user has access to
def test_view_all_projects_user_has_access_to(client, mock_firestore):
    # Setup test data
    user_id = "user123"

    # Mock project data - user is part of both projects
    project1 = {
        "name": "Project 1",
        "description": "My first project",
        "status": "in progress",
        "priority": "high",
        "ownerId": user_id,
        "teamIds": [user_id],
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc),
    }

    project2 = {
        "name": "Project 2",
        "description": "My second project",
        "status": "to-do",
        "priority": "medium",
        "ownerId": "other_user",
        "teamIds": [user_id, "other_user"],  # User is a team member
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

    # Send GET request to fetch all projects with assignedTo parameter
    response = client.get(f'/api/projects/?assignedTo={user_id}')

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
    assert project1_data["status"] == "in progress", "Project 1 status should be 'in progress'"
    assert project1_data["priority"] == "high", "Project 1 priority should be 'high'"
    assert project1_data["ownerId"] == user_id, "Project 1 owner should be user"
    assert "id" in project1_data, "Project should have an id field"

    # Verify Project 2
    project2_results = [p for p in user_projects if p.get("name") == "Project 2"]
    assert len(project2_results) == 1, "Project 2 should be in results"

    project2_data = project2_results[0]
    assert project2_data["name"] == "Project 2", "Project 2 name should match"
    assert project2_data["description"] == "My second project", "Project 2 description should match"
    assert project2_data["status"] == "to-do", "Project 2 status should be 'to-do'"
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
        "status": "in progress",
        "priority": "high",
        "ownerId": user_id,
        "teamIds": [user_id],
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

    # Send GET request to fetch all projects with assignedTo parameter
    response = client.get(f'/api/projects/?assignedTo={user_id}')

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
    assert project1_data["status"] == "in progress", "Status should be 'in progress'"
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
        "status": "in progress",
        "priority": "high",
        "ownerId": user_id,
        "teamIds": [user_id],
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

    # Send GET request to fetch all projects with assignedTo parameter
    response = client.get(f'/api/projects/?assignedTo={user_id}')

    # Assertions
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"

    response_data = response.get_json()
    assert response_data is not None, "Response should contain JSON data"
    assert isinstance(response_data, list), "Response should be a list of projects"
    assert len(response_data) >= 1, "Should have at least 1 project"

        # Find Project 1 in the results
    project1_results = [p for p in response_data if p.get("name") == "Project 1"]
    assert len(project1_results) == 1, "Project 1 should be in results"

    # Verify Project 1 is displayed with status 'in progress'
    project1_data = project1_results[0]
    assert project1_data["name"] == "Project 1", "Project name should be 'Project 1'"
    assert project1_data["status"] == "in progress", "Status should be 'in progress'"
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
        "status": "in progress",
        "priority": "high",
        "ownerId": user_id,
        "teamIds": [user_id],
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

    # Send GET request to fetch all projects with assignedTo parameter
    response = client.get(f'/api/projects/?assignedTo={user_id}')

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
    assert project1_data["status"] == "in progress", "Status should match"
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

    # Verify project page displays project name 'Project 1'
    assert response_data["name"] == "Project 1", "Project name should be 'Project 1'"
    assert response_data["description"] == "My first project", "Description should match"
    assert response_data["status"] == "in progress", "Status should match"
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

    # Verify project page displays project description 'My first project'
    assert response_data["description"] == "My first project", "Description should be 'My first project'"
    assert response_data["name"] == "Project 1", "Name should match"
    assert response_data["status"] == "in progress", "Status should match"
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

    # Verify project page displays project status 'in progress'
    assert response_data["status"] == "in progress", "Status should be 'in progress'"
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

    # Verify project page displays project priority 'high'
    assert response_data["priority"] == "high", "Priority should be 'high'"
    assert response_data["name"] == "Project 1", "Name should match"
    assert response_data["description"] == "My first project", "Description should match"
    assert response_data["status"] == "in progress", "Status should match"
    assert response_data["id"] == project_id, "Project ID should match"

    # Verify priority field is present and not empty
    assert "priority" in response_data, "Project should have a priority field"
    assert response_data["priority"].strip() != "", "Project priority should not be empty"
