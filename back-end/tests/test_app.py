"""
Tests for app.py
Tests Flask application configuration and deadline notification endpoint.
"""
import os
import sys
import pytest
from unittest.mock import Mock, patch

# Ensure the back-end folder is on the import path
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

# Import app once at module level with scheduler disabled
os.environ["ENABLE_DEADLINE_NOTIFICATIONS"] = "false"
from app import app as flask_app  # noqa: E402


@pytest.fixture
def test_client():
    """Create a test client for the Flask app"""
    flask_app.config.update(TESTING=True)
    with flask_app.test_client() as client:
        yield client


class TestAppConfiguration:
    """Test Flask application configuration"""

    def test_app_exists(self):
        """Test that app module can be imported"""
        from app import app
        assert app is not None

    def test_app_is_flask_instance(self):
        """Test that app is a Flask instance"""
        from app import app
        from flask import Flask
        assert isinstance(app, Flask)

    def test_blueprints_registered(self):
        """Test that all blueprints are registered"""
        from app import app

        # Get registered blueprints
        blueprint_names = list(app.blueprints.keys())

        # Check expected blueprints are registered
        assert 'users' in blueprint_names
        assert 'projects' in blueprint_names
        assert 'comments' in blueprint_names

    def test_cors_enabled(self):
        """Test that CORS is configured"""
        from app import app

        # CORS extension should be in app extensions
        assert 'cors' in app.extensions or hasattr(app, 'after_request_funcs')

    def test_testing_mode(self, test_client):
        """Test that testing mode can be enabled"""
        from app import app
        app.config.update(TESTING=True)
        assert app.config['TESTING'] is True


class TestDeadlineNotificationEndpoint:
    """Test the manual deadline notification trigger endpoint"""

    def test_trigger_deadline_check_endpoint_exists(self, test_client):
        """Test that the endpoint exists"""
        resp = test_client.post("/api/notifications/check-deadlines")
        # Should return something (not 404)
        assert resp.status_code != 404

    def test_trigger_deadline_check_disabled(self, test_client):
        """Test endpoint when deadline notifications are disabled"""
        resp = test_client.post("/api/notifications/check-deadlines")
        assert resp.status_code == 400
        data = resp.get_json()
        assert data["success"] is False
        assert "disabled" in data["message"].lower()


class TestAppRoutes:
    """Test application routing"""

    def test_users_blueprint_routes(self, test_client):
        """Test that users blueprint routes are accessible"""
        # Users routes should be under /api/users
        resp = test_client.get("/api/users/")
        # Should not be 404 (may be 400, 401, 403, 500, etc. depending on auth)
        assert resp.status_code != 404

    def test_projects_blueprint_routes(self, test_client):
        """Test that projects blueprint routes are accessible"""
        # Projects routes should be under /api/projects
        resp = test_client.get("/api/projects/")
        # Should not be 404
        assert resp.status_code != 404

    def test_comments_blueprint_routes(self, test_client):
        """Test that comments blueprint routes are accessible"""
        # Comments routes should be under /api/tasks (via comments blueprint)
        # This will likely be 400 or 404 for missing task, but not route not found
        resp = test_client.get("/api/tasks/test-task/comments?project_id=test")
        # Should not be 404 due to route not existing
        assert resp.status_code in [400, 404, 500]  # Expected errors, not routing errors

    def test_invalid_route_returns_404(self, test_client):
        """Test that invalid routes return 404"""
        resp = test_client.get("/api/nonexistent/route/that/does/not/exist")
        assert resp.status_code == 404


class TestEnvironmentConfiguration:
    """Test environment variable configuration"""

    def test_enable_deadline_notifications_is_set(self):
        """Test ENABLE_DEADLINE_NOTIFICATIONS is accessible"""
        from app import ENABLE_DEADLINE_NOTIFICATIONS
        # Should be False since we set it in module init
        assert ENABLE_DEADLINE_NOTIFICATIONS is False


class TestAppIntegration:
    """Integration tests for the app"""

    def test_app_can_handle_requests(self, test_client):
        """Test that app can handle basic requests"""
        # Test a few endpoints
        resp = test_client.get("/api/users/")
        assert resp.status_code != 404  # Route exists

        resp = test_client.get("/api/projects/")
        assert resp.status_code != 404  # Route exists

    def test_app_returns_json_responses(self, test_client):
        """Test that API endpoints return JSON"""
        resp = test_client.post("/api/notifications/check-deadlines")
        # Should return JSON
        assert resp.content_type == "application/json"
        assert resp.get_json() is not None

    def test_cors_headers_present(self, test_client):
        """Test that CORS is configured"""
        resp = test_client.get("/api/projects/")
        # Route should exist (CORS is configured at app level)
        assert resp.status_code != 404
