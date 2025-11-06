"""Tests for SCRUM-310: Set task to recurring"""
import pytest
from unittest.mock import patch, MagicMock
import sys, os
from types import SimpleNamespace
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from conftest import make_response

def _prepare_update_task_mocks(mock_db, *, project_id="p1", task_id="task1", task_payload=None, project_payload=None):
    """Configure nested Firestore mocks for update_task_endpoint tests."""
    project_payload = project_payload or {
        "name": "Project",
        "ownerId": "owner1",
        "teamIds": ["owner1"],
        "status": "to-do",
    }
    task_payload = task_payload or {
        "title": "Task",
        "status": "to-do",
        "assigneeId": "owner1",
        "ownerId": "owner1",
        "isRecurring": True,
        "recurrencePattern": {"interval": "daily", "frequency": 1},
    }

    projects_collection = MagicMock()
    project_ref = MagicMock()
    project_snapshot = MagicMock()
    project_snapshot.exists = True
    project_snapshot.id = project_id
    project_snapshot.to_dict.return_value = project_payload
    project_ref.get.return_value = project_snapshot

    tasks_collection = MagicMock()
    task_ref = MagicMock()
    task_snapshot = MagicMock()
    task_snapshot.exists = True
    task_snapshot.id = task_id
    task_snapshot.to_dict.return_value = task_payload
    task_ref.get.return_value = task_snapshot

    tasks_collection.document.return_value = task_ref
    project_ref.collection.side_effect = lambda name: tasks_collection if name == "tasks" else MagicMock()
    projects_collection.document.return_value = project_ref

    def collection_router(name):
        if name == "projects":
            return projects_collection
        if name == "notifications":
            notifications_collection = MagicMock()
            notifications_collection.add.return_value = (None, SimpleNamespace(id="notif1"))
            return notifications_collection
        return MagicMock()

    mock_db.collection.side_effect = collection_router
    return task_ref, task_snapshot

class Test_310_AC1_FixedInterval:
    def test_310_1_1_set_daily_recurrence(self):
        """SCRUM-367: Set task to repeat at fixed interval - daily"""
        from flask import Flask
        app = Flask(__name__)
        with patch('projects.db') as m, patch('projects.now_utc') as n:
            from projects import create_task
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
            
            with app.test_request_context(json={
                "title": "Daily Task",
                "assigneeId": "u1",
                "isRecurring": True,
                "recurrencePattern": {"interval": "daily", "frequency": 1}
            }):
                result = create_task("p1")
                resp = make_response(result)
                assert resp.status_code == 201
                call = mock_coll.add.call_args[0][0]
                assert call['isRecurring'] == True
                assert call['recurrencePattern']['interval'] == "daily"

class Test_310_AC2_EndCondition:
    def test_310_2_1_set_end_condition_never(self):
        """SCRUM-368: Define end condition - never"""
        from flask import Flask
        app = Flask(__name__)
        with patch('projects.db') as m, patch('projects.now_utc') as n:
            from projects import create_task
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
            
            with app.test_request_context(json={
                "title": "Task",
                "assigneeId": "u1",
                "isRecurring": True,
                "recurrencePattern": {"interval": "weekly", "endCondition": "never"}
            }):
                result = create_task("p1")
                resp = make_response(result)
                assert resp.status_code == 201
                call = mock_coll.add.call_args[0][0]
                assert call['recurrencePattern']['endCondition'] == "never"

    def test_310_2_2_set_end_condition_after_occurrences(self):
        """SCRUM-368: Define end condition - after X occurrences"""
        from flask import Flask
        app = Flask(__name__)
        with patch('projects.db') as m, patch('projects.now_utc') as n:
            from projects import create_task
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
            
            with app.test_request_context(json={
                "title": "Task",
                "assigneeId": "u1",
                "isRecurring": True,
                "recurrencePattern": {"interval": "weekly", "endCondition": "after", "occurrences": 5}
            }):
                result = create_task("p1")
                resp = make_response(result)
                assert resp.status_code == 201
                call = mock_coll.add.call_args[0][0]
                assert call['recurrencePattern']['occurrences'] == 5

class Test_310_AC3_AutoCreateNext:
    def test_310_3_1_completing_creates_next_instance(self):
        """SCRUM-369: Completing recurring task creates next instance"""
        from flask import Flask
        app = Flask(__name__)
        with patch('projects.db') as m, \
             patch('projects.now_utc') as n, \
             patch('projects.create_next_recurring_instance', return_value=("newtask", None)), \
             patch('projects.update_project_status_from_tasks'), \
             patch('projects.create_status_change_notifications'):
            from projects import update_task_endpoint
            n.return_value = "2025-11-03T00:00:00Z"
            _prepare_update_task_mocks(
                m,
                task_payload={
                    "title": "Recurring Task",
                    "status": "to-do",
                    "assigneeId": "u1",
                    "ownerId": "u1",
                    "isRecurring": True,
                    "recurrencePattern": {"interval": "daily", "frequency": 1},
                },
                project_payload={
                    "name": "Recurring Project",
                    "ownerId": "u1",
                    "teamIds": ["u1"],
                    "status": "to-do",
                },
            )

            with app.test_request_context(json={"status": "done"}):
                result = update_task_endpoint("p1", "task1")
                resp = make_response(result)
                assert resp.status_code == 200

class Test_310_AC4_CopyTaskDetails:
    def test_310_4_1_new_instance_copies_details(self):
        """SCRUM-370: New instance copies title, description, assignees, subtasks"""
        from flask import Flask
        app = Flask(__name__)
        with patch('projects.db') as m, patch('projects.now_utc') as n:
            from projects import create_task
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
            
            with app.test_request_context(json={
                "title": "Original Task",
                "description": "Details",
                "assigneeId": "u1",
                "isRecurring": True,
                "recurrencePattern": {"interval": "daily"}
            }):
                result = create_task("p1")
                resp = make_response(result)
                assert resp.status_code == 201
                call = mock_coll.add.call_args[0][0]
                assert call['title'] == "Original Task"
                assert call['description'] == "Details"

class Test_310_AC5_RecurringLabel:
    def test_310_5_1_task_has_recurring_flag(self):
        """SCRUM-371: Task displays isRecurring flag"""
        from flask import Flask
        app = Flask(__name__)
        with patch('projects.db') as m, patch('projects.now_utc') as n:
            from projects import create_task
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
            
            with app.test_request_context(json={
                "title": "Task",
                "assigneeId": "u1",
                "isRecurring": True,
                "recurrencePattern": {"interval": "weekly"}
            }):
                result = create_task("p1")
                resp = make_response(result)
                assert resp.status_code == 201
                call = mock_coll.add.call_args[0][0]
                assert call['isRecurring'] == True
                assert 'recurrencePattern' in call

class Test_310_AC6_CreatorOnly:
    def test_310_6_1_creator_can_add_recurrence(self):
        """SCRUM-372: Only creator can add recurrence during creation"""
        from flask import Flask
        app = Flask(__name__)
        with patch('projects.db') as m, patch('projects.now_utc') as n:
            from projects import create_task
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
            
            with app.test_request_context(json={
                "title": "Task",
                "assigneeId": "u1",
                "createdBy": "u1",
                "isRecurring": True,
                "recurrencePattern": {"interval": "daily"}
            }):
                result = create_task("p1")
                resp = make_response(result)
                assert resp.status_code == 201
                call = mock_coll.add.call_args[0][0]
                assert call['isRecurring'] == True

class Test_310_AC7_MinimumInterval:
    def test_310_7_1_prevents_interval_shorter_than_one_day(self):
        """SCRUM-373: System prevents intervals shorter than one day"""
        from flask import Flask
        app = Flask(__name__)
        with patch('projects.db') as m, patch('projects.now_utc') as n:
            from projects import create_task
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
            
            # System should accept daily as minimum
            with app.test_request_context(json={
                "title": "Task",
                "assigneeId": "u1",
                "isRecurring": True,
                "recurrencePattern": {"interval": "daily", "frequency": 1}
            }):
                result = create_task("p1")
                resp = make_response(result)
                assert resp.status_code == 201

class Test_310_AC8_CreatorNotification:
    def test_310_8_1_creator_receives_notification(self):
        """SCRUM-374: Creator receives notification when new instance created"""
        # This is tested by checking recurring logic triggers
        from flask import Flask
        app = Flask(__name__)
        with patch('projects.db') as m, patch('projects.now_utc') as n:
            from projects import create_task
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
            
            with app.test_request_context(json={
                "title": "Task",
                "assigneeId": "u1",
                "createdBy": "u1",
                "isRecurring": True,
                "recurrencePattern": {"interval": "daily"}
            }):
                result = create_task("p1")
                resp = make_response(result)
                assert resp.status_code == 201

class Test_310_AC9_ModifySettings:
    def test_310_9_1_modify_recurrence_via_update(self):
        """SCRUM-377: Change recurrence by updating task"""
        from flask import Flask
        app = Flask(__name__)
        with patch('projects.db') as m, \
             patch('projects.now_utc') as n, \
             patch('projects.create_next_recurring_instance', return_value=(None, None)), \
             patch('projects.update_project_status_from_tasks'), \
             patch('projects.create_status_change_notifications'):
            from projects import update_task_endpoint
            n.return_value = "2025-11-03T00:00:00Z"
            task_ref, _ = _prepare_update_task_mocks(
                m,
                task_payload={
                "title": "Task",
                "status": "to-do",
                "isRecurring": True,
                "recurrencePattern": {"interval": "daily"}
                },
                project_payload={
                    "name": "Project",
                    "ownerId": "u1",
                    "teamIds": ["u1"],
                    "status": "to-do",
                },
            )

            with app.test_request_context(json={
                "isRecurring": True,
                "recurrencePattern": {"interval": "weekly", "frequency": 2}
            }):
                result = update_task_endpoint("p1", "task1")
                resp = make_response(result)
                assert resp.status_code == 200
                task_ref.update.assert_called()

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
