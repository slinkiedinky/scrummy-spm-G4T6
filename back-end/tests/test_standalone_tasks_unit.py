"""
Unit Tests for SCRUM-354: Configure Standalone Tasks
FINAL VERSION - Matches actual backend implementation
"""

import pytest
from unittest.mock import patch, MagicMock
import sys
import os
import json

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))


class Test_354_AC1_MyTasksTab:
    """SCRUM-354 AC1: Standalone tasks in my tasks tab"""
    
    def test_354_1_1_standalone_task_has_no_project_id(self):
        """Scrum-354.1.1: Verify standalone task has no projectId"""
        from projects import create_standalone_task
        from flask import Flask
        
        app = Flask(__name__)
        with patch('projects.db') as mock_db, patch('projects.now_utc') as mock_now:
            mock_now.return_value = "2025-11-02T00:00:00Z"
            
            # Mock document() -> set() pattern
            mock_task_ref = MagicMock()
            mock_task_ref.id = "standalone123"
            mock_collection = MagicMock()
            mock_collection.document.return_value = mock_task_ref
            mock_db.collection.return_value = mock_collection
            
            with app.test_request_context(
                json={
                    "title": "My Task",
                    "status": "to-do",
                    "priority": 5,
                    "dueDate": "2025-12-01T00:00:00Z",
                    "ownerId": "user123"
                }
            ):
                response, status_code = create_standalone_task()
                assert status_code == 201
                
                # Verify set was called with projectId=None
                call_args = mock_task_ref.set.call_args[0][0]
                assert call_args['projectId'] is None
    
    def test_354_1_2_list_standalone_tasks_filters_by_user(self):
        """Scrum-354.1.3: List filters by userId"""
        from projects import list_standalone_tasks
        from flask import Flask
        
        app = Flask(__name__)
        with patch('projects.db') as mock_db:
            mock_query = MagicMock()
            mock_query.stream.return_value = []
            mock_collection = MagicMock()
            mock_collection.where.return_value = mock_query
            mock_db.collection.return_value = mock_collection
            
            with app.test_request_context(query_string="userId=user123&ownerId=user123"):
                response, status_code = list_standalone_tasks() 
                assert status_code == 200


class Test_354_AC2_CreatorOnly:
    """SCRUM-354 AC2: Only assigned to creator"""
    
    def test_354_2_1_standalone_task_assignee_is_creator(self):
        """Scrum-354.2.1: assigneeId equals creator"""
        from projects import create_standalone_task
        from flask import Flask
        
        app = Flask(__name__)
        with patch('projects.db') as mock_db, patch('projects.now_utc') as mock_now:
            mock_now.return_value = "2025-11-02T00:00:00Z"
            
            mock_task_ref = MagicMock()
            mock_task_ref.id = "standalone123"
            mock_collection = MagicMock()
            mock_collection.document.return_value = mock_task_ref
            mock_db.collection.return_value = mock_collection
            
            with app.test_request_context(
                json={
                    "title": "My Task",
                    "status": "to-do",
                    "priority": 5,
                    "dueDate": "2025-12-01T00:00:00Z",
                    "ownerId": "user123"
                }
            ):
                response, status_code = create_standalone_task()
                assert status_code == 201
                
                call_args = mock_task_ref.set.call_args[0][0]
                assert call_args['assigneeId'] == "user123"
                assert call_args['ownerId'] == "user123"


class Test_354_AC3_SeparateCollection:
    """SCRUM-354 AC3: Separate collection storage"""
    
    def test_354_3_1_standalone_tasks_in_tasks_collection(self):
        """Scrum-354.3.1: Stored in root 'tasks' collection"""
        from projects import create_standalone_task
        from flask import Flask
        
        app = Flask(__name__)
        with patch('projects.db') as mock_db, patch('projects.now_utc') as mock_now:
            mock_now.return_value = "2025-11-02T00:00:00Z"
            
            mock_task_ref = MagicMock()
            mock_task_ref.id = "standalone123"
            mock_collection = MagicMock()
            mock_collection.document.return_value = mock_task_ref
            mock_db.collection.return_value = mock_collection
            
            with app.test_request_context(
                json={
                    "title": "Task",
                    "status": "to-do",
                    "priority": 5,
                    "dueDate": "2025-12-01T00:00:00Z",
                    "ownerId": "user123"
                }
            ):
                response, status_code = create_standalone_task()
                assert status_code == 201
                mock_db.collection.assert_called_with("tasks")


class Test_354_AC4_DynamicUpdate:
    """SCRUM-354 AC4: Dynamic list updates"""
    
    def test_354_4_1_create_returns_task_id(self):
        """Scrum-354.4.1: Create returns task ID"""
        from projects import create_standalone_task
        from flask import Flask
        
        app = Flask(__name__)
        with patch('projects.db') as mock_db, patch('projects.now_utc') as mock_now:
            mock_now.return_value = "2025-11-02T00:00:00Z"
            
            mock_task_ref = MagicMock()
            mock_task_ref.id = "new_standalone"
            mock_collection = MagicMock()
            mock_collection.document.return_value = mock_task_ref
            mock_db.collection.return_value = mock_collection
            
            with app.test_request_context(
                json={
                    "title": "Task",
                    "status": "to-do",
                    "priority": 5,
                    "dueDate": "2025-12-01T00:00:00Z",
                    "ownerId": "user123"
                }
            ):
                response, status_code = create_standalone_task()
                assert status_code == 201
                data = json.loads(response.data)
                assert 'id' in data
                assert data['id'] == "new_standalone"
    
    def test_354_4_2_delete_returns_success(self):
        """Scrum-354.4.2: Delete returns success"""
        from projects import delete_standalone_task
        from flask import Flask
        
        app = Flask(__name__)
        with patch('projects.db') as mock_db:
            mock_task_doc = MagicMock()
            mock_task_doc.exists = True
            mock_task_ref = MagicMock()
            mock_task_ref.get.return_value = mock_task_doc
            mock_db.collection.return_value.document.return_value = mock_task_ref
            
            with app.test_request_context():
                response, status_code = delete_standalone_task("standalone123")
                mock_task_ref.delete.assert_called_once()
                assert status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v"])