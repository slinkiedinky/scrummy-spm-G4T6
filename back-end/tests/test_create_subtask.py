"""Tests for SCRUM-7: Create a Subtask"""
import pytest
from unittest.mock import patch, MagicMock # Removed PropertyMock as we no longer need it
import sys, os, json
from types import SimpleNamespace
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

class Test_7_AC1_AddSubtask:
    def test_7_1_1_create_subtask(self):
        from flask import Flask
        app = Flask(__name__)
        with patch('projects.db') as m, patch('projects.now_utc') as n, patch('projects.add_notification'):
            from projects import create_subtask
            n.return_value = "2025-11-02T00:00:00Z"
            parent_doc = MagicMock()
            parent_doc.exists = True
            parent_ref = MagicMock()
            parent_ref.get.return_value = parent_doc
            parent_doc.to_dict.return_value = {"status": "to-do", "isRecurring": False}
            proj_doc = MagicMock()
            proj_doc.exists = True
            proj_doc.to_dict.return_value = {"teamIds": ["u1"]}
            proj_ref = MagicMock()
            proj_ref.get.return_value = proj_doc
            
            mock_collection = MagicMock()
            mock_collection.add.return_value = (None, SimpleNamespace(id="sub1"))
            parent_ref.collection.return_value = mock_collection

            proj_coll = MagicMock()
            proj_coll.document.return_value = parent_ref
            proj_ref.collection.return_value = proj_coll

            m.collection.return_value.document.return_value = proj_ref
            
            with app.test_request_context(json={"title": "Subtask", "assigneeId": "u1"}):
                resp = create_subtask("p1", "t1")
                assert resp.status_code == 201

class Test_7_AC2_FixedParent:
    def test_7_2_1_parent_fixed(self):
        from flask import Flask
        app = Flask(__name__)
        with patch('projects.db') as m, patch('projects.now_utc') as n, patch('projects.add_notification'):
            from projects import create_subtask
            n.return_value = "2025-11-02T00:00:00Z"
            parent_doc = MagicMock()
            parent_doc.exists = True
            parent_ref = MagicMock()
            parent_ref.get.return_value = parent_doc
            parent_doc.to_dict.return_value = {"status": "to-do", "isRecurring": False}
            proj_doc = MagicMock()
            proj_doc.exists = True
            proj_doc.to_dict.return_value = {"teamIds": ["u1"]}
            proj_ref = MagicMock()
            proj_ref.get.return_value = proj_doc
                        
            mock_collection = MagicMock()
            mock_collection.add.return_value = (None, SimpleNamespace(id="sub1"))
            parent_ref.collection.return_value = mock_collection

            proj_coll = MagicMock()
            proj_coll.document.return_value = parent_ref
            proj_ref.collection.return_value = proj_coll

            m.collection.return_value.document.return_value = proj_ref

            with app.test_request_context(json={"title": "Sub", "assigneeId": "u1"}):
                create_subtask("p1", "t1")
                parent_ref.collection.assert_called_with("subtasks")

class Test_7_AC3_SameBehavior:
    def test_7_3_1_same_as_task(self):
        from flask import Flask
        app = Flask(__name__)
        with patch('projects.db') as m, patch('projects.now_utc') as n, patch('projects.add_notification'):
            from projects import create_subtask
            n.return_value = "2025-11-02T00:00:00Z"
            parent_doc = MagicMock()
            parent_doc.exists = True
            parent_ref = MagicMock()
            parent_ref.get.return_value = parent_doc
            parent_doc.to_dict.return_value = {"status": "to-do", "isRecurring": False}
            proj_doc = MagicMock()
            proj_doc.exists = True
            proj_doc.to_dict.return_value = {"teamIds": ["u1"]}
            proj_ref = MagicMock()
            proj_ref.get.return_value = proj_doc
                        
            mock_collection = MagicMock()
            mock_collection.add.return_value = (None, SimpleNamespace(id="sub1"))
            parent_ref.collection.return_value = mock_collection

            proj_coll = MagicMock()
            proj_coll.document.return_value = parent_ref
            proj_ref.collection.return_value = proj_coll

            m.collection.return_value.document.return_value = proj_ref
            
            with app.test_request_context(json={"title": "Sub", "description": "Desc", "status": "to-do", "priority": 5, "assigneeId": "u1"}):
                resp = create_subtask("p1", "t1")
                assert resp.status_code == 201

if __name__ == "__main__":
    pytest.main([__file__, "-v"])