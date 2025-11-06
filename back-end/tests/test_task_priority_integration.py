"""
Integration Tests for SCRUM-325: Add greater granularity to priority for tasks
User Story: As a staff, I want to set task priority levels from 1-10 so that I can distinguish critical work from less urgent tasks.

Test Coverage:
- AC1: Task priority level ranges from 1-10 (end-to-end validation)
- AC2: Task priority level should be set during the time of task creation (via API)
- AC3: Levels can be edited afterwards by staff (via API)
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
import sys
import os
import json
from conftest import make_response

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))


@pytest.fixture
def mock_firebase_setup():
    """Mock Firebase/Firestore for integration tests"""
    with patch('projects.db') as mock_db, \
         patch('projects.now_utc') as mock_now, \
         patch('projects.add_notification') as mock_notif:
        
        mock_now.return_value = "2025-11-02T00:00:00Z"
        
        # Mock Firestore collections
        mock_projects_col = MagicMock()
        mock_tasks_col = MagicMock()
        
        # Setup project mock
        mock_project_doc = MagicMock()
        mock_project_doc.exists = True
        mock_project_doc.to_dict.return_value = {
            "name": "Test Project",
            "ownerId": "user123",
            "teamIds": ["user123"]
        }
        mock_project_doc.id = "project123"
        
        mock_project_ref = MagicMock()
        mock_project_ref.get.return_value = mock_project_doc
        mock_project_ref.collection.return_value = mock_tasks_col
        
        mock_projects_col.document.return_value = mock_project_ref
        
        def collection_router(name):
            if name == "projects":
                return mock_projects_col
            return MagicMock()
        
        mock_db.collection.side_effect = collection_router
        
        yield {
            'db': mock_db,
            'now': mock_now,
            'notification': mock_notif,
            'project_ref': mock_project_ref,
            'tasks_col': mock_tasks_col
        }


class Test_325_AC1_PriorityRange_Integration:
    """
    SCRUM-325 AC1: Task priority level ranges from 1-10 (Integration)
    Tests end-to-end validation through API endpoints
    """
    
    def test_325_1_1_create_task_with_valid_priorities(self, mock_firebase_setup):
        """Scrum-325.1.1: Test creating tasks with all valid priority values 1-10 via API"""
        from projects import projects_bp
        from flask import Flask
        
        app = Flask(__name__)
        app.register_blueprint(projects_bp, url_prefix='/projects')
        
        mocks = mock_firebase_setup
        
        # Mock task creation
        mock_task_ref = MagicMock()
        mock_task_ref.id = "task123"
        mocks['tasks_col'].add.return_value = (None, mock_task_ref)
        
        with app.test_client() as client:
            for priority in range(1, 11):
                response = client.post(
                    '/projects/project123/tasks',
                    json={
                        "title": f"Task Priority {priority}",
                        "description": "Test task",
                        "status": "to-do",
                        "priority": priority,
                        "assigneeId": "user123",
                        "dueDate": "2025-12-01T00:00:00Z"
                    }
                )
                
                assert response.status_code == 201, f"Task with priority {priority} should be created successfully"
                
                # Verify the task was created with correct priority
                call_args = mocks['tasks_col'].add.call_args[0][0]
                assert call_args['priority'] == priority, f"Priority should be {priority}"
    
    def test_325_1_2_create_task_priority_below_range(self, mock_firebase_setup):
        """Scrum-325.1.2: Test creating task with priority 0 (below range) is clamped to 1"""
        from projects import projects_bp
        from flask import Flask
        
        app = Flask(__name__)
        app.register_blueprint(projects_bp, url_prefix='/projects')
        
        mocks = mock_firebase_setup
        
        # Mock task creation
        mock_task_ref = MagicMock()
        mock_task_ref.id = "task123"
        mocks['tasks_col'].add.return_value = (None, mock_task_ref)
        
        with app.test_client() as client:
            response = client.post(
                '/projects/project123/tasks',
                json={
                    "title": "Low Priority Task",
                    "description": "Test task",
                    "status": "to-do",
                    "priority": 0,  # Below valid range
                    "assigneeId": "user123",
                    "dueDate": "2025-12-01T00:00:00Z"
                }
            )
            
            assert response.status_code == 201, "Task should be created successfully"
            
            # Verify priority was clamped to 1
            call_args = mocks['tasks_col'].add.call_args[0][0]
            assert call_args['priority'] == 1, "Priority 0 should be clamped to 1"
    
    def test_325_1_3_create_task_priority_above_range(self, mock_firebase_setup):
        """Scrum-325.1.3: Test creating task with priority 15 (above range) is clamped to 10"""
        from projects import projects_bp
        from flask import Flask
        
        app = Flask(__name__)
        app.register_blueprint(projects_bp, url_prefix='/projects')
        
        mocks = mock_firebase_setup
        
        # Mock task creation
        mock_task_ref = MagicMock()
        mock_task_ref.id = "task123"
        mocks['tasks_col'].add.return_value = (None, mock_task_ref)
        
        with app.test_client() as client:
            response = client.post(
                '/projects/project123/tasks',
                json={
                    "title": "High Priority Task",
                    "description": "Test task",
                    "status": "to-do",
                    "priority": 15,  # Above valid range
                    "assigneeId": "user123",
                    "dueDate": "2025-12-01T00:00:00Z"
                }
            )
            
            assert response.status_code == 201, "Task should be created successfully"
            
            # Verify priority was clamped to 10
            call_args = mocks['tasks_col'].add.call_args[0][0]
            assert call_args['priority'] == 10, "Priority 15 should be clamped to 10"
    
    def test_325_1_4_create_task_priority_negative(self, mock_firebase_setup):
        """Scrum-325.1.4: Test creating task with negative priority is clamped to 1"""
        from projects import projects_bp
        from flask import Flask
        
        app = Flask(__name__)
        app.register_blueprint(projects_bp, url_prefix='/projects')
        
        mocks = mock_firebase_setup
        
        # Mock task creation
        mock_task_ref = MagicMock()
        mock_task_ref.id = "task123"
        mocks['tasks_col'].add.return_value = (None, mock_task_ref)
        
        with app.test_client() as client:
            response = client.post(
                '/projects/project123/tasks',
                json={
                    "title": "Negative Priority Task",
                    "description": "Test task",
                    "status": "to-do",
                    "priority": -5,
                    "assigneeId": "user123",
                    "dueDate": "2025-12-01T00:00:00Z"
                }
            )
            
            assert response.status_code == 201, "Task should be created successfully"
            
            # Verify priority was clamped to 1
            call_args = mocks['tasks_col'].add.call_args[0][0]
            assert call_args['priority'] == 1, "Negative priority should be clamped to 1"


class Test_325_AC2_PriorityOnCreation_Integration:
    """
    SCRUM-325 AC2: Task priority level should be set during the time of task creation (Integration)
    Tests priority setting during task creation through full request flow
    """
    
    def test_325_2_1_create_task_with_specific_priority(self, mock_firebase_setup):
        """Scrum-325.2.1: Test task is created with specified priority value via API"""
        from projects import projects_bp
        from flask import Flask
        
        app = Flask(__name__)
        app.register_blueprint(projects_bp, url_prefix='/projects')
        
        mocks = mock_firebase_setup
        
        # Mock task creation
        mock_task_ref = MagicMock()
        mock_task_ref.id = "task456"
        mocks['tasks_col'].add.return_value = (None, mock_task_ref)
        
        with app.test_client() as client:
            response = client.post(
                '/projects/project123/tasks',
                json={
                    "title": "Specific Priority Task",
                    "description": "This task has priority 7",
                    "status": "to-do",
                    "priority": 7,  # Specific priority
                    "assigneeId": "user123",
                    "dueDate": "2025-12-01T00:00:00Z"
                }
            )
            
            assert response.status_code == 201, "Task should be created successfully"
            response_data = json.loads(response.data)
            assert 'id' in response_data or 'taskId' in response_data, "Response should contain task ID"
            
            # Verify task was created with priority 7
            call_args = mocks['tasks_col'].add.call_args[0][0]
            assert call_args['priority'] == 7, "Task should be created with priority 7"
            assert call_args['title'] == "Specific Priority Task"
    
    def test_325_2_2_create_task_without_priority_uses_default(self, mock_firebase_setup):
        """Scrum-325.2.2: Test task created without priority uses default value 5"""
        from projects import projects_bp, DEFAULT_TASK_PRIORITY
        from flask import Flask
        
        app = Flask(__name__)
        app.register_blueprint(projects_bp, url_prefix='/projects')
        
        mocks = mock_firebase_setup
        
        # Mock task creation
        mock_task_ref = MagicMock()
        mock_task_ref.id = "task789"
        mocks['tasks_col'].add.return_value = (None, mock_task_ref)
        
        with app.test_client() as client:
            response = client.post(
                '/projects/project123/tasks',
                json={
                    "title": "Default Priority Task",
                    "description": "No priority specified",
                    "status": "to-do",
                    # priority not included
                    "assigneeId": "user123",
                    "dueDate": "2025-12-01T00:00:00Z"
                }
            )
            
            assert response.status_code == 201, "Task should be created successfully"
            
            # Verify task was created with default priority
            call_args = mocks['tasks_col'].add.call_args[0][0]
            assert call_args['priority'] == DEFAULT_TASK_PRIORITY, f"Task should use default priority {DEFAULT_TASK_PRIORITY}"
    
    def test_325_2_3_create_multiple_tasks_different_priorities(self, mock_firebase_setup):
        """Scrum-325.2.3: Test creating multiple tasks with different priorities in sequence"""
        from projects import projects_bp
        from flask import Flask
        
        app = Flask(__name__)
        app.register_blueprint(projects_bp, url_prefix='/projects')
        
        mocks = mock_firebase_setup
        
        task_priorities = [1, 5, 10, 3, 8]
        
        with app.test_client() as client:
            for i, priority in enumerate(task_priorities):
                # Mock task creation for each iteration
                mock_task_ref = MagicMock()
                mock_task_ref.id = f"task{i}"
                mocks['tasks_col'].add.return_value = (None, mock_task_ref)
                
                response = client.post(
                    '/projects/project123/tasks',
                    json={
                        "title": f"Task {i}",
                        "description": f"Task with priority {priority}",
                        "status": "to-do",
                        "priority": priority,
                        "assigneeId": "user123",
                        "dueDate": "2025-12-01T00:00:00Z"
                    }
                )
                
                assert response.status_code == 201, f"Task {i} should be created successfully"
                
                # Verify each task has correct priority
                call_args = mocks['tasks_col'].add.call_args[0][0]
                assert call_args['priority'] == priority, f"Task {i} should have priority {priority}"


class Test_325_AC3_PriorityEditable_Integration:
    """
    SCRUM-325 AC3: Levels can be edited afterwards by staff (Integration)
    Tests priority editing through full API flow
    """
    
    def test_325_3_1_update_task_priority_via_api(self, mock_firebase_setup):
        """Scrum-325.3.1: Test updating task priority from 5 to 9 via PATCH API"""
        from projects import projects_bp
        from flask import Flask
        
        app = Flask(__name__)
        app.register_blueprint(projects_bp, url_prefix='/projects')
        
        mocks = mock_firebase_setup
        
        # Mock existing task
        mock_task_doc = MagicMock()
        mock_task_doc.exists = True
        mock_task_doc.to_dict.return_value = {
            "title": "Existing Task",
            "priority": 5,
            "status": "in-progress",
            "assigneeId": "user123"
        }
        
        mock_task_ref = MagicMock()
        mock_task_ref.get.return_value = mock_task_doc
        mocks['tasks_col'].document.return_value = mock_task_ref
        
        with app.test_client() as client:
            response = client.patch(
                '/projects/project123/tasks/task123',
                json={"priority": 9}
            )
            
            assert response.status_code == 200, "Task update should succeed"
            
            # Verify priority was updated
            update_call = mock_task_ref.update.call_args[0][0]
            assert update_call['priority'] == 9, "Priority should be updated to 9"
            assert 'updatedAt' in update_call, "UpdatedAt timestamp should be set"
    
    def test_325_3_2_update_task_priority_with_validation(self, mock_firebase_setup):
        """Scrum-325.3.2: Test updating task priority with out-of-range value is clamped"""
        from projects import projects_bp
        from flask import Flask
        
        app = Flask(__name__)
        app.register_blueprint(projects_bp, url_prefix='/projects')
        
        mocks = mock_firebase_setup
        
        # Mock existing task
        mock_task_doc = MagicMock()
        mock_task_doc.exists = True
        mock_task_doc.to_dict.return_value = {
            "title": "Existing Task",
            "priority": 5,
            "status": "to-do"
        }
        
        mock_task_ref = MagicMock()
        mock_task_ref.get.return_value = mock_task_doc
        mocks['tasks_col'].document.return_value = mock_task_ref
        
        with app.test_client() as client:
            response = client.patch(
                '/projects/project123/tasks/task123',
                json={"priority": 25}  # Out of range
            )
            
            assert response.status_code == 200, "Task update should succeed with clamping"
            
            # Verify priority was clamped to 10
            update_call = mock_task_ref.update.call_args[0][0]
            assert update_call['priority'] == 10, "Priority 25 should be clamped to 10"
    
    def test_325_3_3_update_priority_multiple_times(self, mock_firebase_setup):
        """Scrum-325.3.3: Test updating task priority multiple times in sequence"""
        from projects import projects_bp
        from flask import Flask
        
        app = Flask(__name__)
        app.register_blueprint(projects_bp, url_prefix='/projects')
        
        mocks = mock_firebase_setup
        
        # Initial task state
        current_priority = 5
        
        with app.test_client() as client:
            priority_sequence = [7, 3, 10, 1, 6]
            
            for new_priority in priority_sequence:
                # Mock task with current priority
                mock_task_doc = MagicMock()
                mock_task_doc.exists = True
                mock_task_doc.to_dict.return_value = {
                    "title": "Task",
                    "priority": current_priority,
                    "status": "in-progress"
                }
                
                mock_task_ref = MagicMock()
                mock_task_ref.get.return_value = mock_task_doc
                mocks['tasks_col'].document.return_value = mock_task_ref
                
                response = client.patch(
                    '/projects/project123/tasks/task123',
                    json={"priority": new_priority}
                )
                
                assert response.status_code == 200, f"Update to priority {new_priority} should succeed"
                
                # Verify priority was updated
                update_call = mock_task_ref.update.call_args[0][0]
                assert update_call['priority'] == new_priority, f"Priority should be updated to {new_priority}"
                
                current_priority = new_priority
    
    def test_325_3_4_update_priority_along_with_other_fields(self, mock_firebase_setup):
        """Scrum-325.3.4: Test updating priority along with other task fields"""
        from projects import projects_bp
        from flask import Flask
        
        app = Flask(__name__)
        app.register_blueprint(projects_bp, url_prefix='/projects')
        
        mocks = mock_firebase_setup
        
        # Mock existing task
        mock_task_doc = MagicMock()
        mock_task_doc.exists = True
        mock_task_doc.to_dict.return_value = {
            "title": "Old Title",
            "description": "Old Description",
            "priority": 5,
            "status": "to-do"
        }
        
        mock_task_ref = MagicMock()
        mock_task_ref.get.return_value = mock_task_doc
        mocks['tasks_col'].document.return_value = mock_task_ref
        
        with app.test_client() as client:
            response = client.patch(
                '/projects/project123/tasks/task123',
                json={
                    "title": "New Title",
                    "description": "New Description",
                    "priority": 8,
                    "status": "in-progress"
                }
            )
            
            assert response.status_code == 200, "Task update should succeed"
            
            # Verify all fields were updated
            update_call = mock_task_ref.update.call_args[0][0]
            assert update_call['title'] == "New Title", "Title should be updated"
            assert update_call['description'] == "New Description", "Description should be updated"
            assert update_call['priority'] == 8, "Priority should be updated to 8"
            assert update_call['status'] == "in-progress", "Status should be updated"
    
    def test_325_3_5_update_priority_from_legacy_to_numeric(self, mock_firebase_setup):
        """Scrum-325.3.5: Test updating task priority from legacy string to new numeric value"""
        from projects import projects_bp
        from flask import Flask
        
        app = Flask(__name__)
        app.register_blueprint(projects_bp, url_prefix='/projects')
        
        mocks = mock_firebase_setup
        
        # Mock existing task with legacy priority
        mock_task_doc = MagicMock()
        mock_task_doc.exists = True
        mock_task_doc.to_dict.return_value = {
            "title": "Legacy Task",
            "priority": "high",  # Legacy string priority
            "status": "to-do"
        }
        
        mock_task_ref = MagicMock()
        mock_task_ref.get.return_value = mock_task_doc
        mocks['tasks_col'].document.return_value = mock_task_ref
        
        with app.test_client() as client:
            response = client.patch(
                '/projects/project123/tasks/task123',
                json={"priority": 9}  # New numeric priority
            )
            
            assert response.status_code == 200, "Task update should succeed"
            
            # Verify priority was updated to numeric value
            update_call = mock_task_ref.update.call_args[0][0]
            assert update_call['priority'] == 9, "Priority should be updated from 'high' to 9"
            assert isinstance(update_call['priority'], int), "Priority should be stored as integer"


class Test_325_EdgeCases_Integration:
    """
    SCRUM-325: Edge cases and error scenarios (Integration)
    """
    
    def test_325_edge_1_create_subtask_with_priority(self, mock_firebase_setup):
        """Scrum-325.E.1: Test creating subtask with priority value"""
        from projects import projects_bp
        from flask import Flask
        
        app = Flask(__name__)
        app.register_blueprint(projects_bp, url_prefix='/projects')
        
        mocks = mock_firebase_setup
        
        # Mock parent task
        mock_parent_doc = MagicMock()
        mock_parent_doc.exists = True
        mock_parent_doc.to_dict.return_value = {
            "title": "Parent Task",
            "status": "in-progress"
        }
        
        mock_parent_ref = MagicMock()
        mock_parent_ref.get.return_value = mock_parent_doc
        
        mock_subtasks_col = MagicMock()
        mock_parent_ref.collection.return_value = mock_subtasks_col
        mocks['tasks_col'].document.return_value = mock_parent_ref
        
        # Mock subtask creation
        mock_subtask_ref = MagicMock()
        mock_subtask_ref.id = "subtask123"
        mock_subtasks_col.add.return_value = (None, mock_subtask_ref)
        
        with app.test_client() as client:
            response = client.post(
                '/projects/project123/tasks/parentTask123/subtasks',
                json={
                    "title": "Subtask with Priority",
                    "description": "This is a subtask",
                    "status": "to-do",
                    "priority": 8,  # Subtask should also support priority
                    "assigneeId": "user456",
                    "dueDate": "2025-12-01T00:00:00Z"
                }
            )
            
            assert response.status_code == 201, "Subtask should be created successfully"
            
            # Verify subtask was created with priority
            call_args = mock_subtasks_col.add.call_args[0][0]
            assert call_args['priority'] == 8, "Subtask should be created with priority 8"
    
    def test_325_edge_2_priority_persists_after_status_change(self, mock_firebase_setup):
        """Scrum-325.E.2: Test priority persists when task status is changed"""
        from projects import projects_bp
        from flask import Flask
        
        app = Flask(__name__)
        app.register_blueprint(projects_bp, url_prefix='/projects')
        
        mocks = mock_firebase_setup
        
        # Mock existing task
        mock_task_doc = MagicMock()
        mock_task_doc.exists = True
        mock_task_doc.to_dict.return_value = {
            "title": "Task",
            "priority": 8,  # High priority
            "status": "to-do"
        }
        
        mock_task_ref = MagicMock()
        mock_task_ref.get.return_value = mock_task_doc
        mocks['tasks_col'].document.return_value = mock_task_ref
        
        with app.test_client() as client:
            # Change status only
            response = client.patch(
                '/projects/project123/tasks/task123',
                json={"status": "completed"}  # Only changing status
            )
            
            assert response.status_code == 200, "Status update should succeed"
            
            # Verify priority was NOT changed
            update_call = mock_task_ref.update.call_args[0][0]
            assert update_call['status'] == "completed", "Status should be updated"
            assert 'priority' not in update_call or update_call.get('priority') == 8, "Priority should remain unchanged"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
