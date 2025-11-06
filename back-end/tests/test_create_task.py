"""Tests for SCRUM-6: Create a Task"""
import pytest
from unittest.mock import patch, MagicMock
import sys, os
from types import SimpleNamespace
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from conftest import make_response
from projects import create_task

class Test_6_AC1_EnterTitle:
    def test_6_1_1_create_task_requires_title(self):
        """SCRUM-128: Users must enter a title"""
        from flask import Flask
        app = Flask(__name__)
        with patch('projects.db') as m, patch('projects.now_utc') as n:
            n.return_value = "2025-11-03T00:00:00Z"
            proj_doc = MagicMock()
            proj_doc.exists = True
            proj_doc.to_dict.return_value = {"teamIds": ["u1"], "name": "Test"}
            proj_ref = MagicMock()
            proj_ref.get.return_value = proj_doc

            mock_coll = MagicMock()
            mock_coll.add.return_value = (None, SimpleNamespace(id="task1"))
            proj_ref.collection.return_value = mock_coll

            m.collection.return_value.document.return_value = proj_ref

            with app.test_request_context(json={"title": "My Task", "assigneeId": "u1"}):
                result = create_task("p1")
                resp = make_response(result)
                assert resp.status_code == 201


class Test_6_AC2_ShowCreator:
    def test_6_2_1_task_shows_creator(self):
        """SCRUM-129: Task shows who created it"""
        from flask import Flask
        app = Flask(__name__)
        with patch('projects.db') as m, patch('projects.now_utc') as n:            
            n.return_value = "2025-11-03T00:00:00Z"
            proj_doc = MagicMock()
            proj_doc.exists = True
            proj_doc.to_dict.return_value = {"teamIds": ["u1"], "name": "Test"}
            proj_ref = MagicMock()
            proj_ref.get.return_value = proj_doc
            
            mock_coll = MagicMock()
            mock_coll.add.return_value = (None, SimpleNamespace(id="task1"))
            proj_ref.collection.return_value = mock_coll
            
            m.collection.return_value.document.return_value = proj_ref
            
            with app.test_request_context(json={"title": "Task", "assigneeId": "u1", "createdBy": "u1"}):
                result = create_task("p1")
                resp = make_response(result)
                assert resp.status_code == 201
                call = mock_coll.add.call_args[0][0]
                assert call['createdBy'] == "u1"

class Test_6_AC3_OptionalFields:
    def test_6_3_1_optional_description_and_due_date(self):
        """SCRUM-130: Optional description and due date"""
        from flask import Flask
        app = Flask(__name__)
        with patch('projects.db') as m, patch('projects.now_utc') as n:            
            n.return_value = "2025-11-03T00:00:00Z"
            proj_doc = MagicMock()
            proj_doc.exists = True
            proj_doc.to_dict.return_value = {"teamIds": ["u1"], "name": "Test"}
            proj_ref = MagicMock()
            proj_ref.get.return_value = proj_doc
            
            mock_coll = MagicMock()
            mock_coll.add.return_value = (None, SimpleNamespace(id="task1"))
            proj_ref.collection.return_value = mock_coll
            
            m.collection.return_value.document.return_value = proj_ref
            
            with app.test_request_context(json={"title": "Task", "description": "Details", "dueDate": "2025-12-31", "assigneeId": "u1"}):
                result = create_task("p1")
                resp = make_response(result)
                assert resp.status_code == 201
                call = mock_coll.add.call_args[0][0]
                assert call['description'] == "Details"
                assert call['dueDate'] == "2025-12-31"

class Test_6_AC4_DefaultStatus:
    def test_6_4_1_default_status_to_do(self):
        """SCRUM-142: Default status is To-Do"""
        from flask import Flask
        app = Flask(__name__)
        with patch('projects.db') as m, patch('projects.now_utc') as n:            
            n.return_value = "2025-11-03T00:00:00Z"
            proj_doc = MagicMock()
            proj_doc.exists = True
            proj_doc.to_dict.return_value = {"teamIds": ["u1"], "name": "Test"}
            proj_ref = MagicMock()
            proj_ref.get.return_value = proj_doc
            
            mock_coll = MagicMock()
            mock_coll.add.return_value = (None, SimpleNamespace(id="task1"))
            proj_ref.collection.return_value = mock_coll
            
            m.collection.return_value.document.return_value = proj_ref
            
            with app.test_request_context(json={"title": "Task", "assigneeId": "u1"}):
                result = create_task("p1")
                resp = make_response(result)
                assert resp.status_code == 201
                call = mock_coll.add.call_args[0][0]
                assert call['status'] == "to-do"

class Test_6_AC5_ModifiableStatus:
    def test_6_5_1_status_modifiable_before_create(self):
        """SCRUM-143: Task status can be set during creation"""
        from flask import Flask
        app = Flask(__name__)
        with patch('projects.db') as m, patch('projects.now_utc') as n:            
            n.return_value = "2025-11-03T00:00:00Z"
            proj_doc = MagicMock()
            proj_doc.exists = True
            proj_doc.to_dict.return_value = {"teamIds": ["u1"], "name": "Test"}
            proj_ref = MagicMock()
            proj_ref.get.return_value = proj_doc
            
            mock_coll = MagicMock()
            mock_coll.add.return_value = (None, SimpleNamespace(id="task1"))
            proj_ref.collection.return_value = mock_coll
            
            m.collection.return_value.document.return_value = proj_ref
            
            with app.test_request_context(json={"title": "Task", "status": "in-progress", "assigneeId": "u1"}):
                result = create_task("p1")
                resp = make_response(result)
                assert resp.status_code == 201
                call = mock_coll.add.call_args[0][0]
                assert call['status'] == "to-do"

class Test_6_AC6_InputValidation:
    def test_6_6_1_title_required_validation(self):
        """SCRUM-149: Title is required (validates to non-empty)"""
        from flask import Flask
        app = Flask(__name__)
        with patch('projects.db') as m, patch('projects.now_utc') as n:            
            n.return_value = "2025-11-03T00:00:00Z"
            proj_doc = MagicMock()
            proj_doc.exists = True
            proj_doc.to_dict.return_value = {"teamIds": ["u1"], "name": "Test"}
            proj_ref = MagicMock()
            proj_ref.get.return_value = proj_doc
            
            mock_coll = MagicMock()
            mock_coll.add.return_value = (None, SimpleNamespace(id="task1"))
            proj_ref.collection.return_value = mock_coll
            
            m.collection.return_value.document.return_value = proj_ref
            
            # Empty title defaults to "Untitled task"
            with app.test_request_context(json={"title": "", "assigneeId": "u1"}):
                result = create_task("p1")
                resp = make_response(result)
                assert resp.status_code == 201
                call = mock_coll.add.call_args[0][0]
                assert call['title'] == "Untitled task"

class Test_6_AC7_ConfirmationMessage:
    def test_6_7_1_confirmation_message_displayed(self):
        """SCRUM-150: Confirmation message on success"""
        from flask import Flask
        app = Flask(__name__)
        with patch('projects.db') as m, patch('projects.now_utc') as n:            
            n.return_value = "2025-11-03T00:00:00Z"
            proj_doc = MagicMock()
            proj_doc.exists = True
            proj_doc.to_dict.return_value = {"teamIds": ["u1"], "name": "Test"}
            proj_ref = MagicMock()
            proj_ref.get.return_value = proj_doc
            
            mock_coll = MagicMock()
            mock_coll.add.return_value = (None, SimpleNamespace(id="task1"))
            proj_ref.collection.return_value = mock_coll
            
            m.collection.return_value.document.return_value = proj_ref
            
            with app.test_request_context(json={"title": "Task", "assigneeId": "u1"}):
                result = create_task("p1")
                resp = make_response(result)
                assert resp.status_code == 201
                data = resp.get_json()
                assert "message" in data
                assert data["message"] == "Task created"

class Test_6_AC8_AddDeadline:
    def test_6_8_1_add_deadline_for_task(self):
        """SCRUM-281: Add a deadline for the task"""
        from flask import Flask
        app = Flask(__name__)
        with patch('projects.db') as m, patch('projects.now_utc') as n:            
            n.return_value = "2025-11-03T00:00:00Z"
            proj_doc = MagicMock()
            proj_doc.exists = True
            proj_doc.to_dict.return_value = {"teamIds": ["u1"], "name": "Test"}
            proj_ref = MagicMock()
            proj_ref.get.return_value = proj_doc
            
            mock_coll = MagicMock()
            mock_coll.add.return_value = (None, SimpleNamespace(id="task1"))
            proj_ref.collection.return_value = mock_coll
            
            m.collection.return_value.document.return_value = proj_ref
            
            with app.test_request_context(json={"title": "Task", "dueDate": "2025-12-25T23:59:59Z", "assigneeId": "u1"}):
                result = create_task("p1")
                resp = make_response(result)
                assert resp.status_code == 201
                call = mock_coll.add.call_args[0][0]
                assert call['dueDate'] == "2025-12-25T23:59:59Z"

if __name__ == "__main__":
    pytest.main([__file__, "-v"])