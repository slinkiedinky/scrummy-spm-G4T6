"""
Global test configuration and fixtures
"""
import pytest
from unittest.mock import Mock, patch, MagicMock
import sys
import os

# Add the back-end directory to the Python path
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

# ADD THIS SECTION - Firebase mocking setup BEFORE any imports
os.environ['FIRESTORE_EMULATOR_HOST'] = 'localhost:8080'
os.environ['FIREBASE_USE_EMULATOR'] = 'true'
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = '/dev/null'

# Mock Firebase modules at import time to prevent credential loading
mock_firestore = MagicMock()
mock_firestore.client.return_value = MagicMock()

mock_firebase_admin = MagicMock()
mock_firebase_admin.firestore = mock_firestore
mock_firebase_admin.initialize_app = MagicMock()
mock_firebase_admin.credentials = MagicMock()

# Install the mocks before any imports
sys.modules['firebase_admin'] = mock_firebase_admin
sys.modules['firebase_admin.firestore'] = mock_firestore
sys.modules['firebase_admin.credentials'] = mock_firebase_admin.credentials

# Mock the firebase module that your app imports
mock_firebase_module = MagicMock()
mock_db = MagicMock()
mock_firebase_module.db = mock_db
sys.modules['firebase'] = mock_firebase_module

# ADD THIS FIXTURE - Session-wide Firebase setup
@pytest.fixture(autouse=True, scope='session')
def setup_firebase_for_testing():
    """Set up Firebase mocking for all tests"""
    with patch('firebase_admin.initialize_app'):
        with patch('firebase_admin.firestore.client', return_value=mock_db):
            with patch('firebase_admin.credentials.Certificate'):
                yield

# EXISTING FIXTURES BELOW - NO CHANGES
@pytest.fixture(autouse=True)
def mock_auth_for_tests():
    """
    Automatically mock authentication for all tests to avoid 403 errors
    """
    # Mock Firebase Admin SDK authentication
    with patch('firebase_admin.auth.verify_id_token') as mock_verify:
        mock_verify.return_value = {
            'uid': 'test-user-uid',
            'email': 'test@example.com'
        }
        
        # Mock any auth decorators or middleware that might exist
        try:
            # Try to mock common auth patterns
            with patch('functools.wraps', side_effect=lambda f: lambda wrapper: wrapper):
                yield
        except Exception:
            # If that fails, just yield without the wraps patch
            yield

@pytest.fixture(autouse=True)
def set_asyncio_default_fixture_loop_scope():
    """Fix asyncio warning"""
    try:
        import pytest_asyncio
        pytest_asyncio.loop_scope = 'function'
    except (ImportError, AttributeError):
        pass

@pytest.fixture(autouse=True)
def mock_firebase():
    """Auto-mock Firebase for all tests"""
    with patch('firebase.db') as mock_db_patched:
        # Mock Firestore collection operations
        mock_collection = MagicMock()
        mock_doc = MagicMock()
        mock_doc.id = "test-doc-id"
        mock_doc.to_dict.return_value = {"id": "test-doc-id", "name": "Test"}
        
        # Mock add operation to return proper structure - FIX THE TUPLE ISSUE
        mock_add_result = (None, mock_doc)
        mock_collection.add.return_value = mock_add_result
        mock_collection.document.return_value = mock_doc
        mock_collection.where.return_value = mock_collection
        mock_collection.get.return_value = [mock_doc]
        
        mock_db_patched.collection.return_value = mock_collection
        
        yield mock_db_patched

@pytest.fixture(scope='session')
def app():
    """Create Flask app for testing"""
    try:
        from app import app as flask_app
        flask_app.config['TESTING'] = True
        return flask_app
    except Exception:
        return None

@pytest.fixture
def client(app):
    """Create test client"""
    if app:
        return app.test_client()
    return None

@pytest.fixture
def project_with_tasks(client):
    # Setup code to create a project and tasks for testing
    # This should return the necessary context for the tests
    pass

# NEW ADDITIONS BELOW - Enhanced Firebase mocking for timeline tests
@pytest.fixture
def enhanced_firebase_mock():
    """Enhanced Firebase mock with better Firestore simulation"""
    from datetime import datetime
    import uuid
    
    # Create a more sophisticated mock that handles the add() method properly
    def create_mock_collection():
        mock_collection = MagicMock()
        documents = {}  # Store documents in memory
        
        def mock_add(data):
            # Generate a unique ID
            doc_id = str(uuid.uuid4())
            # Store the document
            documents[doc_id] = data
            # Create a mock document reference
            mock_doc_ref = MagicMock()
            mock_doc_ref.id = doc_id
            # Return the tuple format expected by your code: (timestamp, doc_ref)
            return (datetime.now(), mock_doc_ref)
        
        def mock_document(doc_id=None):
            if doc_id is None:
                doc_id = str(uuid.uuid4())
            mock_doc_ref = MagicMock()
            mock_doc_ref.id = doc_id
            
            def mock_set(data):
                documents[doc_id] = data
                return mock_doc_ref
            
            def mock_get():
                mock_doc = MagicMock()
                mock_doc.id = doc_id
                mock_doc.exists = doc_id in documents
                mock_doc.to_dict.return_value = documents.get(doc_id, {})
                return mock_doc
            
            mock_doc_ref.set = mock_set
            mock_doc_ref.get = mock_get
            return mock_doc_ref
        
        def mock_where(field, op, value):
            # Return a query object that can be chained
            mock_query = MagicMock()
            mock_query.where = mock_where
            mock_query.get.return_value = []
            mock_query.stream.return_value = []
            return mock_query
        
        mock_collection.add = mock_add
        mock_collection.document = mock_document
        mock_collection.where = mock_where
        mock_collection.get.return_value = []
        mock_collection.stream.return_value = []
        
        return mock_collection
    
    # Create the main database mock
    enhanced_mock_db = MagicMock()
    enhanced_mock_db.collection.side_effect = lambda name: create_mock_collection()
    
    return enhanced_mock_db

@pytest.fixture
def timeline_test_client(app, enhanced_firebase_mock):
    """Test client with enhanced Firebase mocking specifically for timeline tests"""
    if not app:
        return None
    
    # Patch the Firebase db in your app
    with patch('firebase.db', enhanced_firebase_mock):
        with patch('projects.db', enhanced_firebase_mock):  # Also patch in projects module
            with app.test_client() as client:
                yield client, enhanced_firebase_mock

# Mock timeline data fixture for tests that need consistent data
@pytest.fixture
def mock_timeline_data():
    """Provide mock timeline data for testing"""
    from datetime import datetime, timezone
    
    today = datetime(2025, 11, 1, 10, 0, tzinfo=timezone.utc)
    
    return {
        "projects": [
            {"id": "project-a", "name": "Project A", "ownerId": "user-1", "status": "in-progress"},
            {"id": "project-b", "name": "Project B", "ownerId": "user-1", "status": "todo"}
        ],
        "tasks": [
            {
                "id": "task-1", "projectId": "project-a", "title": "Past Task",
                "status": "completed", "priority": "high", 
                "dueDate": (today.replace(day=25, month=10)).isoformat(),
                "assigneeId": "user-1"
            },
            {
                "id": "task-2", "projectId": "project-a", "title": "Today Task",
                "status": "in-progress", "priority": "high",
                "dueDate": today.isoformat(), "assigneeId": "user-1"
            },
            {
                "id": "task-3", "projectId": "project-a", "title": "Future Task",
                "status": "todo", "priority": "medium",
                "dueDate": (today.replace(day=15, month=11)).isoformat(),
                "assigneeId": "user-1"
            }
        ]
    }

from pytest import fixture

@fixture
def mock_firestore(mock_firebase):
    """Backward-compatible alias: some tests expect 'mock_firestore'."""
    return mock_firebase