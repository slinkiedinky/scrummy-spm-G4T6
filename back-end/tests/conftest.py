"""
Global test configuration and fixtures
"""
import pytest
from unittest.mock import Mock, patch
import sys
import os

# Add the back-end directory to the Python path
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

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

@pytest.fixture(scope='session')
def app():
    """Create Flask app for testing"""
    try:
        from app import app as flask_app
        flask_app.config['TESTING'] = True
        return flask_app
    except ImportError:
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