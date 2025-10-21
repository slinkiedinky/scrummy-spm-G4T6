import os
import sys
from unittest.mock import Mock, patch

import pytest

# Add tests directory to path for fake_firestore import
TEST_DIR = os.path.dirname(__file__)
if TEST_DIR not in sys.path:
    sys.path.insert(0, TEST_DIR)

# Force the application to run against the Firestore emulator (or our fake implementation)
os.environ.setdefault("FIREBASE_USE_EMULATOR", "1")
os.environ.setdefault("FIREBASE_PROJECT_ID", "scrummy-test")
os.environ.setdefault("FIRESTORE_EMULATOR_HOST", "localhost:8080")

# Mock firestore.client() at module level to prevent hanging during test collection
from fake_firestore import FakeFirestore
_firestore_patcher = patch('firebase_admin.firestore.client', return_value=FakeFirestore())
_firestore_patcher.start()


@pytest.fixture(autouse=True, scope="session")
def _firebase_emulator_env():
    """Ensure emulator environment variables are in place for every test session."""
    return True
