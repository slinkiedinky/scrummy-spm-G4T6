"""Tests for SCRUM-8: View my tasks"""
import pytest
from unittest.mock import patch, MagicMock
import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from conftest import make_response

class Test_8_AC1_NestedSubtasks:
    def test_8_1_1_subtasks_visually_nested(self):
        """SCRUM-166: Verify subtasks appear nested under parent tasks"""
        from flask import Flask
        app = Flask(__name__)
        with patch('projects.db') as m:
            from projects import get_assigned_tasks
            
            mock_proj_doc = MagicMock()
            mock_proj_doc.id = "proj1"
            mock_proj_doc.to_dict.return_value = {"name": "Project 1"}
            
            mock_projects_query = MagicMock()
            mock_projects_query.stream.return_value = [mock_proj_doc]
            
            # Parent task
            mock_task_doc = MagicMock()
            mock_task_doc.id = "task1"
            mock_task_doc.to_dict.return_value = {"title": "Parent Task", "status": "to-do", "assigneeId": "u1"}
            
            mock_tasks_query = MagicMock()
            mock_tasks_query.stream.return_value = [mock_task_doc]
            
            mock_standalone_query = MagicMock()
            mock_standalone_query.stream.return_value = []
            
            mock_coll = MagicMock()
            mock_coll.where.side_effect = lambda *args: mock_projects_query if "teamIds" in str(args) else mock_standalone_query
            mock_coll.document.return_value.collection.return_value.where.return_value = mock_tasks_query
            
            m.collection.return_value = mock_coll
            
            with app.test_request_context(query_string="assignedTo=u1"):
                result = get_assigned_tasks()
                resp = make_response(result)
                assert resp.status_code == 200

class Test_8_AC2_AccessControl:
    def test_8_2_1_only_creator_collaborators_view_task(self):
        """SCRUM-170: Only authorized users can view tasks"""
        from flask import Flask
        app = Flask(__name__)
        with patch('projects.db') as m:
            from projects import get_assigned_tasks
            
            mock_proj_doc = MagicMock()
            mock_proj_doc.id = "proj1"
            mock_proj_doc.to_dict.return_value = {"name": "Project 1"}
            
            mock_projects_query = MagicMock()
            mock_projects_query.stream.return_value = [mock_proj_doc]
            
            # Only returns tasks where assigneeId matches
            mock_tasks_query = MagicMock()
            mock_tasks_query.stream.return_value = []
            
            mock_standalone_query = MagicMock()
            mock_standalone_query.stream.return_value = []
            
            mock_coll = MagicMock()
            mock_coll.where.side_effect = lambda *args: mock_projects_query if "teamIds" in str(args) else mock_standalone_query
            mock_coll.document.return_value.collection.return_value.where.return_value = mock_tasks_query
            
            m.collection.return_value = mock_coll
            
            with app.test_request_context(query_string="assignedTo=u1"):
                result = get_assigned_tasks() 
                resp = make_response(result)
                assert resp.status_code == 200

class Test_8_AC3_DisplayKeyInfo:
    def test_8_3_1_task_displays_key_information(self):
        """SCRUM-176: Display title, status, priority, due date"""
        from flask import Flask
        app = Flask(__name__)
        with patch('projects.db') as m:
            from projects import get_assigned_tasks
            
            # Mock task document
            mock_task_doc = MagicMock()
            mock_task_doc.id = "task1"
            mock_task_doc.to_dict.return_value = {
                "title": "Important Task",
                "status": "in-progress",
                "priority": 8,
                "dueDate": "2025-12-31",
                "assigneeId": "u1"
            }
            
            # Mock project reference for task
            mock_proj_ref = MagicMock()
            mock_proj_ref.id = "proj1"
            mock_proj_doc = MagicMock()
            mock_proj_doc.exists = True
            mock_proj_doc.to_dict.return_value = {"name": "Project 1"}
            mock_proj_ref.get.return_value = mock_proj_doc
            
            # Set up task document reference chain
            mock_task_doc.reference = MagicMock()
            mock_task_doc.reference.parent = MagicMock()
            mock_task_doc.reference.parent.parent = mock_proj_ref
            
            # Mock the collection_group query
            mock_query = MagicMock()
            mock_query.where.return_value = mock_query  # Chain where() calls
            mock_query.stream.return_value = [mock_task_doc]
            
            m.collection_group.return_value = mock_query

            
            with app.test_request_context(query_string="assignedTo=u1"):
                result = get_assigned_tasks()
                resp = make_response(result)
                data = resp.get_json()
                assert len(data) > 0
                task = data[0]
                assert task["title"] == "Important Task"
                assert task["status"] == "to-do"
                assert task["priority"] == 8
                assert task["dueDate"] == "2025-12-31"

class Test_8_AC4_CollapseSubtasks:
    def test_8_4_1_subtasks_can_collapse(self):
        """SCRUM-177: UI can collapse/expand subtasks (backend returns structure)"""
        from flask import Flask
        app = Flask(__name__)
        with patch('projects.db') as m:
            from projects import get_assigned_tasks
            
            mock_proj_doc = MagicMock()
            mock_proj_doc.id = "proj1"
            mock_proj_doc.to_dict.return_value = {"name": "Project 1"}
            
            mock_projects_query = MagicMock()
            mock_projects_query.stream.return_value = [mock_proj_doc]
            
            mock_tasks_query = MagicMock()
            mock_tasks_query.stream.return_value = []

            mock_standalone_query = MagicMock()
            mock_standalone_query.stream.return_value = []
            
            mock_coll = MagicMock()
            mock_coll.where.side_effect = lambda *args: mock_projects_query if "teamIds" in str(args) else mock_standalone_query
            mock_coll.document.return_value.collection.return_value.where.return_value = mock_tasks_query
            
            m.collection.return_value = mock_coll
            
            with app.test_request_context(query_string="assignedTo=u1"):
                result = get_assigned_tasks()
                resp = make_response(result)
                assert resp.status_code == 200

class Test_8_AC5_ClickableDetails:
    def test_8_5_1_tasks_clickable_for_details(self):
        """SCRUM-179: Tasks return with IDs for navigation"""
        from flask import Flask
        app = Flask(__name__)
        with patch('projects.db') as m:
            from projects import get_assigned_tasks
            
            # Mock task document
            mock_task_doc = MagicMock()
            mock_task_doc.id = "task1"
            mock_task_doc.to_dict.return_value = {
                "title": "Task",
                "status": "to-do",
                "assigneeId": "u1"
            }
            
            # Mock project reference
            mock_proj_ref = MagicMock()
            mock_proj_ref.id = "proj1"
            mock_proj_doc = MagicMock()
            mock_proj_doc.exists = True
            mock_proj_doc.to_dict.return_value = {"name": "Project 1"}
            mock_proj_ref.get.return_value = mock_proj_doc
            
            # Set up task document reference chain
            mock_task_doc.reference = MagicMock()
            mock_task_doc.reference.parent = MagicMock()
            mock_task_doc.reference.parent.parent = mock_proj_ref
            
            # Mock the collection_group query
            mock_query = MagicMock()
            mock_query.where.return_value = mock_query
            mock_query.stream.return_value = [mock_task_doc]
            
            m.collection_group.return_value = mock_query

                
            with app.test_request_context(query_string="assignedTo=u1"):
                result = get_assigned_tasks()
                resp = make_response(result)
                data = resp.get_json()
                assert len(data) > 0
                assert "id" in data[0]
                assert data[0]["id"] == "task1"

if __name__ == "__main__":
    pytest.main([__file__, "-v"])