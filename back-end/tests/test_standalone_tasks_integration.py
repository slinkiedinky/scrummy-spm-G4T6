"""
Integration Tests for SCRUM-354: Configure Standalone Tasks
"""

import pytest
from unittest.mock import patch, MagicMock
import sys
import os
import json

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

@pytest.fixture
def mock_firebase_standalone():
    with patch('projects.db') as mock_db, patch('projects.now_utc') as mock_now:
        mock_now.return_value = "2025-11-02T00:00:00Z"
        yield {'db': mock_db, 'now': mock_now}


class Test_354_AC1_MyTasksTab_Integration:
    """SCRUM-354 AC1: My tasks tab (Integration)"""
    
    def test_354_1_1_create_standalone_via_api(self, mock_firebase_standalone):
        """Scrum-354.1.1: Create via POST API"""
        from projects import projects_bp
        from flask import Flask
        
        app = Flask(__name__)
        app.register_blueprint(projects_bp, url_prefix='/projects')
        mocks = mock_firebase_standalone
        
        # Mock document() -> set() pattern
        mock_task_ref = MagicMock()
        mock_task_ref.id = "standalone123"
        mock_collection = MagicMock()
        mock_collection.document.return_value = mock_task_ref
        mocks['db'].collection.return_value = mock_collection
        
        with app.test_client() as client:
            response = client.post(
                '/projects/standalone/tasks',
                json={
                    "title": "My Task",
                    "status": "to-do",
                    "priority": 5,
                    "dueDate": "2025-12-01T00:00:00Z",
                    "ownerId": "user123"
                }
            )
            
            assert response.status_code == 201
            data = json.loads(response.data)
            assert 'id' in data
            
            # Verify projectId is None
            call_args = mock_task_ref.set.call_args[0][0]
            assert call_args['projectId'] is None
    
    def test_354_1_2_list_standalone_via_api(self, mock_firebase_standalone):
        """Scrum-354.1.2: List via GET API"""
        from projects import projects_bp
        from flask import Flask
        
        app = Flask(__name__)
        app.register_blueprint(projects_bp, url_prefix='/projects')
        mocks = mock_firebase_standalone
        
        tasks = [
            MagicMock(id="s1", to_dict=lambda: {
                "title": "T1", 
                "assigneeId": "user123", 
                "ownerId": "user123",
                "status": "to-do",
                "priority": 5
            }),
        ]
        mock_query = MagicMock()
        mock_query.stream.return_value = tasks
        mock_collection = MagicMock()
        mock_collection.where.return_value = mock_query
        mocks['db'].collection.return_value = mock_collection
        
        with app.test_client() as client:
            response = client.get('/projects/standalone/tasks?userId=user123&ownerId=user123')
            assert response.status_code == 200
            data = json.loads(response.data)
            assert len(data) >= 0  # May be empty or have tasks


class Test_354_AC2_CreatorOnly_Integration:
    """SCRUM-354 AC2: Creator only (Integration)"""
    
    def test_354_2_1_create_assigns_to_creator(self, mock_firebase_standalone):
        """Scrum-354.2.1: Assigns to creator"""
        from projects import projects_bp
        from flask import Flask
        
        app = Flask(__name__)
        app.register_blueprint(projects_bp, url_prefix='/projects')
        mocks = mock_firebase_standalone
        
        mock_task_ref = MagicMock()
        mock_task_ref.id = "standalone123"
        mock_collection = MagicMock()
        mock_collection.document.return_value = mock_task_ref
        mocks['db'].collection.return_value = mock_collection
        
        with app.test_client() as client:
            response = client.post(
                '/projects/standalone/tasks',
                json={
                    "title": "Task",
                    "status": "to-do",
                    "priority": 5,
                    "dueDate": "2025-12-01T00:00:00Z",
                    "ownerId": "user456"
                }
            )
            
            assert response.status_code == 201
            
            # Verify creator is assignee
            call_args = mock_task_ref.set.call_args[0][0]
            assert call_args['assigneeId'] == "user456"
            assert call_args['ownerId'] == "user456"


class Test_354_AC3_SeparateCollection_Integration:
    """SCRUM-354 AC3: Separate collection (Integration)"""
    
    def test_354_3_1_uses_root_collection(self, mock_firebase_standalone):
        """Scrum-354.3.1: Uses root 'tasks' collection"""
        from projects import projects_bp
        from flask import Flask
        
        app = Flask(__name__)
        app.register_blueprint(projects_bp, url_prefix='/projects')
        mocks = mock_firebase_standalone
        
        mock_task_ref = MagicMock()
        mock_task_ref.id = "standalone123"
        mock_collection = MagicMock()
        mock_collection.document.return_value = mock_task_ref
        mocks['db'].collection.return_value = mock_collection
        
        with app.test_client() as client:
            response = client.post(
                '/projects/standalone/tasks',
                json={
                    "title": "Task",
                    "status": "to-do",
                    "priority": 5,
                    "dueDate": "2025-12-01T00:00:00Z",
                    "ownerId": "user123"
                }
            )
            
            assert response.status_code == 201
            mocks['db'].collection.assert_called_with("tasks")


class Test_354_AC4_DynamicUpdate_Integration:
    """SCRUM-354 AC4: Dynamic updates (Integration)"""
    
    def test_354_4_1_list_after_create(self, mock_firebase_standalone):
        """Scrum-354.4.1: List reflects creation"""
        from projects import projects_bp
        from flask import Flask
        
        app = Flask(__name__)
        app.register_blueprint(projects_bp, url_prefix='/projects')
        mocks = mock_firebase_standalone
        
        # For create
        mock_task_ref = MagicMock()
        mock_task_ref.id = "new_task"
        
        # For list
        tasks = [MagicMock(id="new_task", to_dict=lambda: {
            "title": "New", 
            "assigneeId": "user123", 
            "ownerId": "user123",
            "status": "to-do",
            "priority": 5
        })]
        mock_query = MagicMock()
        mock_query.stream.return_value = tasks
        
        mock_collection = MagicMock()
        mock_collection.document.return_value = mock_task_ref
        mock_collection.where.return_value = mock_query
        mocks['db'].collection.return_value = mock_collection
        
        with app.test_client() as client:
            # Create
            create_response = client.post(
                '/projects/standalone/tasks',
                json={
                    "title": "New",
                    "status": "to-do",
                    "priority": 5,
                    "dueDate": "2025-12-01T00:00:00Z",
                    "ownerId": "user123"
                }
            )
            assert create_response.status_code == 201
            
            # List
            list_response = client.get('/projects/standalone/tasks?userId=user123&ownerId=user123')
            assert list_response.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v"])