import pytest
from unittest.mock import MagicMock, patch
import sys
import os

# Add parent directory to path to import the app
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import app


@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


@pytest.fixture
def mock_firestore():
    with patch('projects.db') as mock_db:
        yield mock_db


def _make_project_doc(pid, data):
    doc = MagicMock()
    doc.id = pid
    doc.to_dict.return_value = data.copy()
    return doc


# Scrum-171.1.1: Search by project name or keyword (case-insensitive).
def test_search_projects_by_name_case_insensitive(client, mock_firestore):
    p1 = {"id": "p1", "name": "Alpha Project", "priority": 3, "status": "new", "progress": 10, "ownerId": "user123", "teamIds": ["user123"]}
    p3 = {"id": "p3", "name": "Gamma ALPHA Initiative", "priority": 1, "status": "completed", "progress": 100, "ownerId": "user123", "teamIds": ["user123"]}

    doc1 = _make_project_doc("p1", p1)
    doc3 = _make_project_doc("p3", p3)

    mock_projects_collection = MagicMock()
    mock_projects_collection.where.return_value = mock_projects_collection
    mock_projects_collection.stream.return_value = [doc1, doc3]
    mock_firestore.collection.return_value = mock_projects_collection

    resp = client.get('/api/projects/', query_string={'q': 'alpha', 'userId': 'user123'})
    assert resp.status_code == 200
    data = resp.get_json()
    ids = {p.get("id") for p in data}
    assert ids == {"p1", "p3"}


# Scrum-171.1.2: Search with unmatched term returns empty list.
def test_search_unmatched_term_returns_empty(client, mock_firestore):
    mock_projects_collection = MagicMock()
    mock_projects_collection.where.return_value.stream.return_value = []
    mock_firestore.collection.return_value = mock_projects_collection

    resp = client.get('/api/projects/', query_string={'q': 'no-such-project', 'userId': 'user123'})
    assert resp.status_code == 200
    data = resp.get_json()
    assert isinstance(data, list)
    assert len(data) == 0


# Scrum-171.2.1: Filter by project status.
def test_filter_projects_by_status(client, mock_firestore):
    p_in = {"id": "s1", "name": "InProg", "status": "in-progress", "ownerId": "user123", "teamIds": ["user123"]}
    doc_in = _make_project_doc("s1", p_in)

    mock_projects_collection = MagicMock()
    mock_projects_collection.where.return_value.stream.return_value = [doc_in]
    mock_firestore.collection.return_value = mock_projects_collection

    resp = client.get('/api/projects/', query_string={'status': 'in-progress', 'userId': 'user123'})
    assert resp.status_code == 200
    data = resp.get_json()
    assert {p.get("id") for p in data} == {"s1"}


# Scrum-171.2.2: Filter by completion percentage.
def test_filter_by_completion_bucket_min_progress(client, mock_firestore):
    p_high = {"id": "c1", "progress": 75, "ownerId": "user123", "teamIds": ["user123"]}
    doc_high = _make_project_doc("c1", p_high)

    mock_projects_collection = MagicMock()
    mock_projects_collection.where.return_value = mock_projects_collection
    mock_projects_collection.stream.return_value = [doc_high]
    mock_firestore.collection.return_value = mock_projects_collection

    resp = client.get('/api/projects/', query_string={'minProgress': '50', 'userId': 'user123'})
    assert resp.status_code == 200
    data = resp.get_json()
    assert {p.get("id") for p in data} == {"c1"}


# Scrum-171.2.3: Filter by numeric priority (stringified numbers allowed)
def test_filter_by_priority_numeric(client, mock_firestore):
    p_high = {"id": "p_high", "priority": 1, "ownerId": "user123", "teamIds": ["user123"]}
    doc_high = _make_project_doc("p_high", p_high)

    mock_projects_collection = MagicMock()
    mock_projects_collection.where.return_value = mock_projects_collection
    mock_projects_collection.stream.return_value = [doc_high]
    mock_firestore.collection.return_value = mock_projects_collection

    resp = client.get('/api/projects/', query_string={'priority': '1', 'userId': 'user123'})
    assert resp.status_code == 200
    assert {p.get("id") for p in resp.get_json()} == {"p_high"}

    mock_projects_collection.stream.return_value = [doc_high]
    resp2 = client.get('/api/projects/', query_string={'priority': '01', 'userId': 'user123'})
    assert resp2.status_code == 200
    assert {p.get("id") for p in resp2.get_json()} == {"p_high"}


# Scrum-171.2.4: Combine filters (status + completion + priority).
def test_combine_multiple_filters_status_completion_priority(client, mock_firestore):
    p = {"id": "m1", "status": "in-progress", "priority": 1, "progress": 60, "ownerId": "user123", "teamIds": ["user123"]}
    doc = _make_project_doc("m1", p)

    mock_projects_collection = MagicMock()
    mock_projects_collection.where.return_value = mock_projects_collection
    mock_projects_collection.stream.return_value = [doc]
    mock_firestore.collection.return_value = mock_projects_collection

    resp = client.get('/api/projects/', query_string={'status': 'in-progress', 'priority': '1', 'minProgress': '50', 'userId': 'user123'})
    assert resp.status_code == 200
    assert {p.get("id") for p in resp.get_json()} == {"m1"}


# Scrum-171.3.1: Real-time: newly created project appears in subsequent fetch.
def test_realtime_new_project_that_matches_filter_appears(client, mock_firestore):
    new_proj = {"id": "r1", "name": "Realtime", "priority": 1, "ownerId": "user123", "teamIds": ["user123"]}
    doc_new = _make_project_doc("r1", new_proj)

    mock_projects_collection = MagicMock()
    mock_projects_collection.where.return_value = mock_projects_collection
    mock_projects_collection.stream.side_effect = [[], [doc_new]]
    mock_new_ref = MagicMock()
    mock_new_ref.id = "r1"
    mock_projects_collection.add.return_value = (None, mock_new_ref)
    mock_firestore.collection.return_value = mock_projects_collection

    resp1 = client.get('/api/projects/', query_string={'q': 'realtime', 'userId': 'user123'})
    assert resp1.status_code == 200
    assert resp1.get_json() == []

    resp_post = client.post('/api/projects/', json={"name": "Realtime", "priority": 1, "ownerId": "owner1"})
    assert resp_post.status_code == 201

    resp2 = client.get('/api/projects/', query_string={'q': 'realtime', 'userId': 'user123'})
    assert resp2.status_code == 200
    ids = {p.get("id") for p in resp2.get_json()}
    assert "r1" in ids


# Scrum-171.3.2: Real-time: project leaving filter disappears.
def test_realtime_project_leaving_filter_disappears(client, mock_firestore):
    p = {"id": "leave1", "name": "Leave", "status": "in-progress", "priority": 1, "ownerId": "user123", "teamIds": ["user123"]}
    doc = _make_project_doc("leave1", p)

    mock_projects_collection = MagicMock()
    mock_projects_collection.where.return_value.stream.side_effect = [[doc], []]
    mock_firestore.collection.return_value = mock_projects_collection

    resp1 = client.get('/api/projects/', query_string={'status': 'in-progress', 'userId': 'user123'})
    assert resp1.status_code == 200
    assert {p.get("id") for p in resp1.get_json()} == {"leave1"}

    resp2 = client.get('/api/projects/', query_string={'status': 'in-progress', 'userId': 'user123'})
    assert resp2.status_code == 200
    assert resp2.get_json() == []
