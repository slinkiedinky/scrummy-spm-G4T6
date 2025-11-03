import pytest
from unittest.mock import MagicMock, patch
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