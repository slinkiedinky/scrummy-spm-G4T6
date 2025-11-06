"""Tests for SCRUM-18: Update a task"""
import pytest
from unittest.mock import patch, MagicMock
import sys, os, json
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from conftest import make_response

class Test_18_UpdateTask_Unit:
    def test_18_1_1_update_title(self):
        from projects import update_task_endpoint
        from flask import Flask
        app = Flask(__name__)
        with patch('projects.db') as m, patch('projects.now_utc') as n:
            n.return_value = "2025-11-02T00:00:00Z"
            doc = MagicMock()
            doc.exists = True
            doc.to_dict.return_value = {"title": "Old", "status": "to-do"}
            ref = MagicMock()
            ref.get.return_value = doc
            m.collection.return_value.document.return_value.collection.return_value.document.return_value = ref
            with app.test_request_context(json={"title": "New Title"}):
                result = update_task_endpoint("p1", "t1")
                resp = make_response(result)
                assert resp.status_code == 200
                ref.update.assert_called()
                args = ref.update.call_args[0][0]
                assert args['title'] == "New Title"
    
    def test_18_2_1_update_description(self):
        from projects import update_task_endpoint
        from flask import Flask
        app = Flask(__name__)
        with patch('projects.db') as m, patch('projects.now_utc') as n:
            n.return_value = "2025-11-02T00:00:00Z"
            doc = MagicMock()
            doc.exists = True
            doc.to_dict.return_value = {"description": "Old", "status": "to-do"}
            ref = MagicMock()
            ref.get.return_value = doc
            m.collection.return_value.document.return_value.collection.return_value.document.return_value = ref
            with app.test_request_context(json={"description": "New Desc"}):
                result = update_task_endpoint("p1", "t1")
                resp = make_response(result)
                assert resp.status_code == 200
                args = ref.update.call_args[0][0]
                assert args['description'] == "New Desc"
    
    def test_18_3_1_update_status(self):
        from projects import update_task_endpoint
        from flask import Flask
        app = Flask(__name__)
        with patch('projects.db') as m, patch('projects.now_utc') as n:
            n.return_value = "2025-11-02T00:00:00Z"
            doc = MagicMock()
            doc.exists = True
            doc.to_dict.return_value = {"status": "to-do"}
            ref = MagicMock()
            ref.get.return_value = doc
            m.collection.return_value.document.return_value.collection.return_value.document.return_value = ref
            with app.test_request_context(json={"status": "in-progress"}):
                result = update_task_endpoint("p1", "t1")
                resp = make_response(result)
                assert resp.status_code == 200
                args = ref.update.call_args[0][0]
                assert args['status'] == "in-progress"
    
    def test_18_4_1_update_dueDate(self):
        from projects import update_task_endpoint
        from flask import Flask
        app = Flask(__name__)
        with patch('projects.db') as m, patch('projects.now_utc') as n:
            n.return_value = "2025-11-02T00:00:00Z"
            doc = MagicMock()
            doc.exists = True
            doc.to_dict.return_value = {"dueDate": "2025-01-01", "status": "to-do"}
            ref = MagicMock()
            ref.get.return_value = doc
            m.collection.return_value.document.return_value.collection.return_value.document.return_value = ref
            with app.test_request_context(json={"dueDate": "2025-12-31"}):
                result = update_task_endpoint("p1", "t1")
                resp = make_response(result)
                assert resp.status_code == 200
                args = ref.update.call_args[0][0]
                assert args['dueDate'] == "2025-12-31"
    
    def test_18_5_1_update_priority(self):
        from projects import update_task_endpoint
        from flask import Flask
        app = Flask(__name__)
        with patch('projects.db') as m, patch('projects.now_utc') as n:
            n.return_value = "2025-11-02T00:00:00Z"
            doc = MagicMock()
            doc.exists = True
            doc.to_dict.return_value = {"priority": 5, "status": "to-do"}
            ref = MagicMock()
            ref.get.return_value = doc
            m.collection.return_value.document.return_value.collection.return_value.document.return_value = ref
            with app.test_request_context(json={"priority": 8}):
                result = update_task_endpoint("p1", "t1")
                resp = make_response(result)
                assert resp.status_code == 200
                args = ref.update.call_args[0][0]
                assert args['priority'] == 8
    
    def test_18_6_1_nonexistent_task_404(self):
        from projects import update_task_endpoint
        from flask import Flask
        app = Flask(__name__)
        with patch('projects.db') as m:
            doc = MagicMock()
            doc.exists = False
            ref = MagicMock()
            ref.get.return_value = doc
            m.collection.return_value.document.return_value.collection.return_value.document.return_value = ref
            with app.test_request_context(json={"title": "New"}):
                result = update_task_endpoint("p1", "t1")
                resp = make_response(result)
                assert resp.status_code == 404

class Test_18_UpdateTask_Integration:
    def test_18_7_1_update_via_api(self):
        from projects import projects_bp
        from flask import Flask
        app = Flask(__name__)
        app.register_blueprint(projects_bp, url_prefix='/projects')
        with patch('projects.db') as m, patch('projects.now_utc') as n:
            n.return_value = "2025-11-02T00:00:00Z"
            doc = MagicMock()
            doc.exists = True
            doc.to_dict.return_value = {"title": "Old", "status": "to-do", "priority": 5}
            ref = MagicMock()
            ref.get.return_value = doc
            m.collection.return_value.document.return_value.collection.return_value.document.return_value = ref
            with app.test_client() as c:
                resp = c.put('/projects/p1/tasks/t1', json={"title": "Updated", "priority": 9})
                assert resp.status_code == 200

if __name__ == "__main__":
    pytest.main([__file__, "-v"])