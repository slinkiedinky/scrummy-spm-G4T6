"""
Unit & Integration Tests for SCRUM-11: View Task Details
User Story: As a user, I want to view task details so that I can see all information about a task.

Test Coverage:
- AC1: Upon clicking the task, display title, description, created date, due date, collaborators, and status
"""

import pytest
from unittest.mock import patch, MagicMock
import sys
import os
from conftest import make_response

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))


class Test_11_AC1_ViewTaskDetails_Unit:
    """SCRUM-11 AC1: Display task details (Unit Tests)"""
    
    def test_11_1_1_get_task_returns_title(self):
        """Scrum-11.1.1: Verify task title is returned"""
        from projects import get_task
        from flask import Flask
        
        app = Flask(__name__)
        with patch('projects.db') as mock_db:
            # Mock task document
            mock_task_doc = MagicMock()
            mock_task_doc.exists = True
            mock_task_doc.to_dict.return_value = {
                "title": "Test Task Title",
                "status": "to-do",
                "priority": 5
            }
            mock_task_ref = MagicMock()
            mock_task_ref.get.return_value = mock_task_doc
            
            # Mock project
            mock_project_doc = MagicMock()
            mock_project_doc.exists = True
            mock_project_doc.to_dict.return_value = {"name": "Project", "teamIds": ["user123"]}
            mock_project_ref = MagicMock()
            mock_project_ref.get.return_value = mock_project_doc
            mock_project_ref.collection.return_value.document.return_value = mock_task_ref
            
            mock_db.collection.return_value.document.return_value = mock_project_ref
            
            with app.test_request_context(query_string="userId=user123"):
                result = get_task("project123", "task123")
                response = make_response(result)
                assert response.status_code == 200
                data = response.get_json()
                assert data['title'] == "Test Task Title"
    
    def test_11_1_2_get_task_returns_description(self):
        """Scrum-11.1.2: Verify task description is returned"""
        from projects import get_task
        from flask import Flask
        
        app = Flask(__name__)
        with patch('projects.db') as mock_db:
            mock_task_doc = MagicMock()
            mock_task_doc.exists = True
            mock_task_doc.to_dict.return_value = {
                "title": "Task",
                "description": "This is the full task description",
                "status": "to-do",
                "priority": 5
            }
            mock_task_ref = MagicMock()
            mock_task_ref.get.return_value = mock_task_doc
            
            mock_project_doc = MagicMock()
            mock_project_doc.exists = True
            mock_project_doc.to_dict.return_value = {"name": "Project", "teamIds": ["user123"]}
            mock_project_ref = MagicMock()
            mock_project_ref.get.return_value = mock_project_doc
            mock_project_ref.collection.return_value.document.return_value = mock_task_ref
            
            mock_db.collection.return_value.document.return_value = mock_project_ref
            
            with app.test_request_context(query_string="userId=user123"):
                result = get_task("project123", "task123")
                response = make_response(result)
                assert response.status_code == 200
                data = response.get_json()
                assert data['description'] == "This is the full task description"
    
    def test_11_1_3_get_task_returns_created_date(self):
        """Scrum-11.1.3: Verify task createdAt date is returned"""
        from projects import get_task
        from flask import Flask
        
        app = Flask(__name__)
        with patch('projects.db') as mock_db:
            mock_task_doc = MagicMock()
            mock_task_doc.exists = True
            mock_task_doc.to_dict.return_value = {
                "title": "Task",
                "status": "to-do",
                "priority": 5,
                "createdAt": "2025-11-01T10:00:00Z"
            }
            mock_task_ref = MagicMock()
            mock_task_ref.get.return_value = mock_task_doc
            
            mock_project_doc = MagicMock()
            mock_project_doc.exists = True
            mock_project_doc.to_dict.return_value = {"name": "Project", "teamIds": ["user123"]}
            mock_project_ref = MagicMock()
            mock_project_ref.get.return_value = mock_project_doc
            mock_project_ref.collection.return_value.document.return_value = mock_task_ref
            
            mock_db.collection.return_value.document.return_value = mock_project_ref
            
            with app.test_request_context(query_string="userId=user123"):
                result = get_task("project123", "task123")
                response = make_response(result)
                assert response.status_code == 200
                data = response.get_json()
                assert 'createdAt' in data
                assert data['createdAt'] == "2025-11-01T10:00:00Z"
    
    def test_11_1_4_get_task_returns_due_date(self):
        """Scrum-11.1.4: Verify task dueDate is returned"""
        from projects import get_task
        from flask import Flask
        
        app = Flask(__name__)
        with patch('projects.db') as mock_db:
            mock_task_doc = MagicMock()
            mock_task_doc.exists = True
            mock_task_doc.to_dict.return_value = {
                "title": "Task",
                "status": "to-do",
                "priority": 5,
                "dueDate": "2025-12-01T23:59:59Z"
            }
            mock_task_ref = MagicMock()
            mock_task_ref.get.return_value = mock_task_doc
            
            mock_project_doc = MagicMock()
            mock_project_doc.exists = True
            mock_project_doc.to_dict.return_value = {"name": "Project", "teamIds": ["user123"]}
            mock_project_ref = MagicMock()
            mock_project_ref.get.return_value = mock_project_doc
            mock_project_ref.collection.return_value.document.return_value = mock_task_ref
            
            mock_db.collection.return_value.document.return_value = mock_project_ref
            
            with app.test_request_context(query_string="userId=user123"):
                result = get_task("project123", "task123")
                response = make_response(result)
                assert response.status_code == 200
                data = response.get_json()
                assert 'dueDate' in data
                assert data['dueDate'] == "2025-12-01T23:59:59Z"
    
    def test_11_1_5_get_task_returns_collaborators(self):
        """Scrum-11.1.5: Verify task collaborators are returned"""
        from projects import get_task
        from flask import Flask
        
        app = Flask(__name__)
        with patch('projects.db') as mock_db:
            mock_task_doc = MagicMock()
            mock_task_doc.exists = True
            mock_task_doc.to_dict.return_value = {
                "title": "Task",
                "status": "to-do",
                "priority": 5,
                "collaboratorsIds": ["user1", "user2", "user3"]
            }
            mock_task_ref = MagicMock()
            mock_task_ref.get.return_value = mock_task_doc
            
            mock_project_doc = MagicMock()
            mock_project_doc.exists = True
            mock_project_doc.to_dict.return_value = {"name": "Project", "teamIds": ["user123"]}
            mock_project_ref = MagicMock()
            mock_project_ref.get.return_value = mock_project_doc
            mock_project_ref.collection.return_value.document.return_value = mock_task_ref
            
            mock_db.collection.return_value.document.return_value = mock_project_ref
            
            with app.test_request_context(query_string="userId=user123"):
                result = get_task("project123", "task123")
                response = make_response(result)
                assert response.status_code == 200
                data = response.get_json()
                assert 'collaboratorsIds' in data
                assert len(data['collaboratorsIds']) == 3
    
    def test_11_1_6_get_task_returns_status(self):
        """Scrum-11.1.6: Verify task status is returned"""
        from projects import get_task
        from flask import Flask
        
        app = Flask(__name__)
        with patch('projects.db') as mock_db:
            mock_task_doc = MagicMock()
            mock_task_doc.exists = True
            mock_task_doc.to_dict.return_value = {
                "title": "Task",
                "status": "in-progress",
                "priority": 5
            }
            mock_task_ref = MagicMock()
            mock_task_ref.get.return_value = mock_task_doc
            
            mock_project_doc = MagicMock()
            mock_project_doc.exists = True
            mock_project_doc.to_dict.return_value = {"name": "Project", "teamIds": ["user123"]}
            mock_project_ref = MagicMock()
            mock_project_ref.get.return_value = mock_project_doc
            mock_project_ref.collection.return_value.document.return_value = mock_task_ref
            
            mock_db.collection.return_value.document.return_value = mock_project_ref
            
            with app.test_request_context(query_string="userId=user123"):
                result = get_task("project123", "task123")
                response = make_response(result)
                assert response.status_code == 200
                data = response.get_json()
                assert data['status'] == "to-do"
    
    def test_11_1_7_get_task_returns_all_fields(self):
        """Scrum-11.1.7: Verify all AC fields returned together"""
        from projects import get_task
        from flask import Flask
        
        app = Flask(__name__)
        with patch('projects.db') as mock_db:
            mock_task_doc = MagicMock()
            mock_task_doc.exists = True
            mock_task_doc.to_dict.return_value = {
                "title": "Complete Task",
                "description": "Full description here",
                "status": "to-do",
                "priority": 8,
                "createdAt": "2025-11-01T10:00:00Z",
                "dueDate": "2025-12-01T23:59:59Z",
                "collaboratorsIds": ["user1", "user2"]
            }
            mock_task_ref = MagicMock()
            mock_task_ref.get.return_value = mock_task_doc
            
            mock_project_doc = MagicMock()
            mock_project_doc.exists = True
            mock_project_doc.to_dict.return_value = {"name": "Project", "teamIds": ["user123"]}
            mock_project_ref = MagicMock()
            mock_project_ref.get.return_value = mock_project_doc
            mock_project_ref.collection.return_value.document.return_value = mock_task_ref
            
            mock_db.collection.return_value.document.return_value = mock_project_ref
            
            with app.test_request_context(query_string="userId=user123"):
                result = get_task("project123", "task123")
                response = make_response(result)
                assert response.status_code == 200
                data = response.get_json()
                
                # Verify all AC1 fields present
                assert data['title'] == "Complete Task"
                assert data['description'] == "Full description here"
                assert data['status'] == "to-do"
                assert data['createdAt'] == "2025-11-01T10:00:00Z"
                assert data['dueDate'] == "2025-12-01T23:59:59Z"
                assert len(data['collaboratorsIds']) == 2
    
    def test_11_1_8_get_nonexistent_task_returns_404(self):
        """Scrum-11.1.8: Verify 404 for non-existent task"""
        from projects import get_task
        from flask import Flask
        
        app = Flask(__name__)
        with patch('projects.db') as mock_db:
            mock_task_doc = MagicMock()
            mock_task_doc.exists = False
            mock_task_ref = MagicMock()
            mock_task_ref.get.return_value = mock_task_doc
            
            mock_project_doc = MagicMock()
            mock_project_doc.exists = True
            mock_project_doc.to_dict.return_value = {"name": "Project", "teamIds": ["user123"]}
            mock_project_ref = MagicMock()
            mock_project_ref.get.return_value = mock_project_doc
            mock_project_ref.collection.return_value.document.return_value = mock_task_ref
            
            mock_db.collection.return_value.document.return_value = mock_project_ref
            
            with app.test_request_context(query_string="userId=user123"):
                result = get_task("project123", "nonexistent")
                response = make_response(result)
                assert response.status_code == 404


class Test_11_AC1_ViewTaskDetails_Integration:
    """SCRUM-11 AC1: Display task details (Integration Tests)"""
    
    def test_11_1_9_get_task_via_api(self):
        """Scrum-11.1.9: Get task details via GET API"""
        from projects import projects_bp
        from flask import Flask
        
        app = Flask(__name__)
        app.register_blueprint(projects_bp, url_prefix='/projects')
        
        with patch('projects.db') as mock_db:
            mock_task_doc = MagicMock()
            mock_task_doc.exists = True
            mock_task_doc.to_dict.return_value = {
                "title": "API Test Task",
                "description": "Testing via API",
                "status": "to-do",
                "priority": 5,
                "createdAt": "2025-11-01T10:00:00Z",
                "dueDate": "2025-12-01T23:59:59Z",
                "collaboratorsIds": ["user1"]
            }
            mock_task_ref = MagicMock()
            mock_task_ref.get.return_value = mock_task_doc
            
            mock_project_doc = MagicMock()
            mock_project_doc.exists = True
            mock_project_doc.to_dict.return_value = {"name": "Project", "teamIds": ["user123"]}
            mock_project_ref = MagicMock()
            mock_project_ref.get.return_value = mock_project_doc
            mock_project_ref.collection.return_value.document.return_value = mock_task_ref
            
            mock_db.collection.return_value.document.return_value = mock_project_ref
            
            with app.test_client() as client:
                response = client.get('/projects/project123/tasks/task123?userId=user123')
                assert response.status_code == 200
                data = response.get_json()
                
                # Verify all AC1 fields
                assert data['title'] == "API Test Task"
                assert data['description'] == "Testing via API"
                assert data['status'] == "to-do"
                assert 'createdAt' in data
                assert 'dueDate' in data
                assert 'collaboratorsIds' in data


if __name__ == "__main__":
    pytest.main([__file__, "-v"])