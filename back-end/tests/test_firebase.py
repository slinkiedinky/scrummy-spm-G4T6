"""
Tests for firebase.py
Tests Firebase initialization logic and configuration.
"""
import os
import sys
import pytest

# Ensure the back-end folder is on the import path
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

# Import firebase at module level to avoid reloading issues
import firebase  # noqa: E402


class TestFirebaseConfiguration:
    """Test Firebase configuration"""

    def test_firebase_constants_exist(self):
        """Test that all expected constants are defined"""
        assert hasattr(firebase, 'DEFAULT_SERVICE_ACCOUNT_PATH')
        assert hasattr(firebase, 'SERVICE_ACCOUNT_PATH')
        assert hasattr(firebase, 'USE_EMULATOR')
        assert hasattr(firebase, 'PROJECT_ID')

    def test_firebase_use_emulator_is_boolean(self):
        """Test that USE_EMULATOR is a boolean"""
        assert isinstance(firebase.USE_EMULATOR, bool)

    def test_firebase_project_id_is_string(self):
        """Test that PROJECT_ID is a string"""
        assert isinstance(firebase.PROJECT_ID, str)
        assert len(firebase.PROJECT_ID) > 0

    def test_firebase_service_account_path_is_string(self):
        """Test that SERVICE_ACCOUNT_PATH is a string"""
        assert isinstance(firebase.SERVICE_ACCOUNT_PATH, str)
        assert len(firebase.SERVICE_ACCOUNT_PATH) > 0

    def test_firebase_module_exports_db(self):
        """Test that firebase module exports db object"""
        assert hasattr(firebase, 'db')
        assert firebase.db is not None

    def test_firebase_default_service_account_path(self):
        """Test default service account path value"""
        assert firebase.DEFAULT_SERVICE_ACCOUNT_PATH == "./scrummy-be0d6-firebase-adminsdk-fbsvc-9b33421a7f.json"

    def test_firebase_db_is_firestore_client(self):
        """Test that db is a Firestore client"""
        # Just verify it has the expected methods
        assert hasattr(firebase.db, 'collection')

    def test_firebase_project_id_from_env_or_default(self):
        """Test that PROJECT_ID comes from env or uses default"""
        # Either from environment or default
        assert firebase.PROJECT_ID in ["scrummy-be0d6", "scrummy-test"] or firebase.PROJECT_ID.startswith("scrummy")


class TestFirebaseIntegration:
    """Integration tests for Firebase module"""

    def test_firebase_can_create_collection_reference(self):
        """Test that we can create collection references"""
        # This should not fail
        col_ref = firebase.db.collection("test_collection")
        assert col_ref is not None

    def test_firebase_environment_variables_used(self):
        """Test that environment variables are being read"""
        # These should match what's set in conftest.py
        if os.environ.get("FIREBASE_USE_EMULATOR") == "1":
            assert firebase.USE_EMULATOR is True

        if os.environ.get("FIREBASE_PROJECT_ID"):
            # If env var is set, it should be used
            assert firebase.PROJECT_ID == os.environ.get("FIREBASE_PROJECT_ID")
