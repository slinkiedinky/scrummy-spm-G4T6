"""
Unit Tests for SCRUM-325: Add greater granularity to priority for tasks
User Story: As a staff, I want to set task priority levels from 1-10 so that I can distinguish critical work from less urgent tasks.

Test Coverage:
- AC1: Task priority level ranges from 1-10
- AC2: Task priority level should be set during the time of task creation
- AC3: Levels can be edited afterwards by staff
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projects import canon_task_priority, DEFAULT_TASK_PRIORITY
from conftest import make_response


class Test_325_AC1_PriorityRange:
    """
    SCRUM-325 AC1: Task priority level ranges from 1-10
    Tests validation of priority values within the valid range
    """
    
    def test_325_1_1_priority_valid_range(self):
        """Scrum-325.1.1: Test all valid priority values 1-10 are accepted"""
        for priority in range(1, 11):
            result = canon_task_priority(priority)
            assert result == priority, f"Priority {priority} should be accepted as-is"
    
    def test_325_1_2_priority_boundary_min(self):
        """Scrum-325.1.2: Test boundary value 1 (minimum valid priority)"""
        result = canon_task_priority(1)
        assert result == 1, "Priority 1 should be the minimum valid value"
    
    def test_325_1_3_priority_boundary_max(self):
        """Scrum-325.1.3: Test boundary value 10 (maximum valid priority)"""
        result = canon_task_priority(10)
        assert result == 10, "Priority 10 should be the maximum valid value"
    
    def test_325_1_4_priority_invalid_below_range(self):
        """Scrum-325.1.4: Test invalid value 0 (below range) is clamped to 1"""
        result = canon_task_priority(0)
        assert result == 1, "Priority 0 should be clamped to minimum value 1"
    
    def test_325_1_5_priority_invalid_above_range(self):
        """Scrum-325.1.5: Test invalid value 11 (above range) is clamped to 10"""
        result = canon_task_priority(11)
        assert result == 10, "Priority 11 should be clamped to maximum value 10"
    
    def test_325_1_6_priority_negative_value(self):
        """Scrum-325.1.6: Test negative priority value is clamped to 1"""
        result = canon_task_priority(-5)
        assert result == 1, "Negative priority should be clamped to 1"
    
    def test_325_1_7_priority_large_positive_value(self):
        """Scrum-325.1.7: Test large positive value is clamped to 10"""
        result = canon_task_priority(999)
        assert result == 10, "Priority 999 should be clamped to 10"
    
    def test_325_1_8_priority_float_rounded_down(self):
        """Scrum-325.1.8: Test float value 5.3 is converted to integer 5"""
        result = canon_task_priority(5.3)
        assert result == 5, "Priority 5.3 should be converted to integer 5"
    
    def test_325_1_9_priority_float_rounded_up(self):
        """Scrum-325.1.9: Test float value 5.7 is converted to integer 5 (truncation not rounding)"""
        result = canon_task_priority(5.7)
        assert result == 5, "Priority 5.7 should be truncated to integer 5"
    
    def test_325_1_10_priority_string_numeric(self):
        """Scrum-325.1.10: Test numeric string '7' is converted to integer 7"""
        result = canon_task_priority("7")
        assert result == 7, "String '7' should convert to int 7"

    def test_325_1_11_priority_string_invalid(self):
        """Scrum-325.1.11: Test invalid string returns default priority (5)"""
        result = canon_task_priority("invalid")
        assert result == DEFAULT_TASK_PRIORITY, "Invalid string should return default priority"
    
    def test_325_1_12_priority_none_returns_default(self):
        """Scrum-325.1.12: Test None returns default priority (5)"""
        result = canon_task_priority(None)
        assert result == DEFAULT_TASK_PRIORITY, "None should return default priority 5"
    
    def test_325_1_13_priority_empty_string(self):
        """Scrum-325.1.13: Test empty string returns default priority"""
        result = canon_task_priority("")
        assert result == DEFAULT_TASK_PRIORITY, "Empty string should return default priority"
    
    def test_325_1_14_priority_legacy_low(self):
        """Scrum-325.1.14: Test legacy 'low' priority maps correctly"""
        result = canon_task_priority("low")
        assert result in range(1, 11), "Legacy 'low' should map to valid priority"
    
    def test_325_1_15_priority_legacy_medium(self):
        """Scrum-325.1.15: Test legacy 'medium' priority maps correctly"""
        result = canon_task_priority("medium")
        assert result in range(1, 11), "Legacy 'medium' should map to valid priority"
    
    def test_325_1_16_priority_legacy_high(self):
        """Scrum-325.1.16: Test legacy 'high' priority maps correctly"""
        result = canon_task_priority("high")
        assert result in range(1, 11), "Legacy 'high' should map to valid priority"


class Test_325_AC2_PriorityOnCreation:
    """
    SCRUM-325 AC2: Task priority level should be set during the time of task creation
    Tests that priority can be set when creating a task
    """
    
    @patch('projects.db')
    @patch('projects.now_utc')
    def test_325_2_1_priority_set_on_task_creation(self, mock_now, mock_db):
        """Scrum-325.2.1: Test priority is set when creating a task with specified priority"""
        from projects import create_task
        from flask import Flask
        
        app = Flask(__name__)
        mock_now.return_value = "2025-11-02T00:00:00Z"
        
        # Mock Firestore
        mock_collection = MagicMock()
        mock_doc_ref = MagicMock()
        mock_doc_ref.id = "task123"
        mock_collection.add.return_value = (None, mock_doc_ref)
        mock_db.collection.return_value.document.return_value.collection.return_value = mock_collection
        
        with app.test_request_context(
            json={
                "title": "Test Task",
                "description": "Test Description",
                "status": "to-do",
                "priority": 8,  # Explicitly setting priority to 8
                "assigneeId": "user123",
                "dueDate": "2025-12-01T00:00:00Z"
            }
        ):
            result = create_task("project123")
            response = make_response(result)
            # Verify the task was created with correct priority
            call_args = mock_collection.add.call_args[0][0]
            assert call_args['priority'] == 8, "Task should be created with priority 8"
            assert response.status_code == 201, "Task creation should succeed"
    
    @patch('projects.db')
    @patch('projects.now_utc')
    def test_325_2_2_priority_defaults_when_not_specified(self, mock_now, mock_db):
        """Scrum-325.2.2: Test priority defaults to 5 when not specified during creation"""
        from projects import create_task
        from flask import Flask
        
        app = Flask(__name__)
        mock_now.return_value = "2025-11-02T00:00:00Z"
        
        # Mock Firestore
        mock_collection = MagicMock()
        mock_doc_ref = MagicMock()
        mock_doc_ref.id = "task123"
        mock_collection.add.return_value = (None, mock_doc_ref)
        mock_db.collection.return_value.document.return_value.collection.return_value = mock_collection
        
        with app.test_request_context(
            json={
                "title": "Test Task",
                "description": "Test Description",
                "status": "to-do",
                # priority not specified
                "assigneeId": "user123",
                "dueDate": "2025-12-01T00:00:00Z"
            }
        ):
            result = create_task("project123")
            response = make_response(result)
            # Verify the task was created with default priority
            call_args = mock_collection.add.call_args[0][0]
            assert call_args['priority'] == DEFAULT_TASK_PRIORITY, "Task should be created with default priority 5"
            assert response.status_code == 201, "Task creation should succeed"
    
    @patch('projects.db')
    @patch('projects.now_utc')
    def test_325_2_3_priority_clamped_on_creation_above_max(self, mock_now, mock_db):
        """Scrum-325.2.3: Test priority is clamped to 10 when value above 10 provided on creation"""
        from projects import create_task
        from flask import Flask
        
        app = Flask(__name__)
        mock_now.return_value = "2025-11-02T00:00:00Z"
        
        # Mock Firestore
        mock_collection = MagicMock()
        mock_doc_ref = MagicMock()
        mock_doc_ref.id = "task123"
        mock_collection.add.return_value = (None, mock_doc_ref)
        mock_db.collection.return_value.document.return_value.collection.return_value = mock_collection
        
        with app.test_request_context(
            json={
                "title": "Test Task",
                "description": "Test Description",
                "status": "to-do",
                "priority": 15,  # Above maximum
                "assigneeId": "user123",
                "dueDate": "2025-12-01T00:00:00Z"
            }
        ):
            result = create_task("project123")
            response = make_response(result)
            # Verify the priority was clamped to 10
            call_args = mock_collection.add.call_args[0][0]
            assert call_args['priority'] == 10, "Priority should be clamped to 10"
            assert response.status_code == 201, "Task creation should succeed"
    
    @patch('projects.db')
    @patch('projects.now_utc')
    def test_325_2_4_priority_clamped_on_creation_below_min(self, mock_now, mock_db):
        """Scrum-325.2.4: Test priority is clamped to 1 when value below 1 provided on creation"""
        from projects import create_task
        from flask import Flask
        
        app = Flask(__name__)
        mock_now.return_value = "2025-11-02T00:00:00Z"
        
        # Mock Firestore
        mock_collection = MagicMock()
        mock_doc_ref = MagicMock()
        mock_doc_ref.id = "task123"
        mock_collection.add.return_value = (None, mock_doc_ref)
        mock_db.collection.return_value.document.return_value.collection.return_value = mock_collection
        
        with app.test_request_context(
            json={
                "title": "Test Task",
                "description": "Test Description",
                "status": "to-do",
                "priority": 0,  # Below minimum
                "assigneeId": "user123",
                "dueDate": "2025-12-01T00:00:00Z"
            }
        ):
            result = create_task("project123")
            response = make_response(result)
            # Verify the priority was clamped to 1
            call_args = mock_collection.add.call_args[0][0]
            assert call_args['priority'] == 1, "Priority should be clamped to 1"
            assert response.status_code == 201, "Task creation should succeed"


class Test_325_AC3_PriorityEditable:
    """
    SCRUM-325 AC3: Levels can be edited afterwards by staff
    Tests that priority can be updated after task creation
    """
    
    @patch('projects.db')
    @patch('projects.now_utc')
    def test_325_3_1_priority_can_be_edited(self, mock_now, mock_db):
        """Scrum-325.3.1: Test task priority can be updated after creation"""
        from projects import update_task_endpoint
        from flask import Flask
        
        app = Flask(__name__)
        mock_now.return_value = "2025-11-02T00:00:00Z"
        
        # Mock existing task
        mock_task_doc = MagicMock()
        mock_task_doc.exists = True
        mock_task_doc.to_dict.return_value = {
            "title": "Test Task",
            "priority": 5,
            "status": "to-do"
        }
        
        mock_task_ref = MagicMock()
        mock_task_ref.get.return_value = mock_task_doc

        # Mock project document
        mock_project_doc = MagicMock()
        mock_project_doc.exists = True
        mock_project_doc.id = "project123"
        mock_project_doc.to_dict.return_value = {"name": "Project 1", "status": "in progress"}
        mock_project_ref = MagicMock()
        mock_project_ref.get.return_value = mock_project_doc
        mock_project_ref.collection.return_value.document.return_value = mock_task_ref

        mock_db.collection.return_value.document.return_value = mock_project_ref

        with app.test_request_context(
            json={"priority": 9}  # Updating priority from 5 to 9
        ):
            result = update_task_endpoint("project123", "task123")
            response = make_response(result)
            # Verify update was called with new priority
            update_call = mock_task_ref.update.call_args[0][0]
            assert update_call['priority'] == 9, "Priority should be updated to 9"
            assert response.status_code == 200, "Task update should succeed"
    
    @patch('projects.db')
    @patch('projects.now_utc')
    def test_325_3_2_priority_edit_validates_range(self, mock_now, mock_db):
        """Scrum-325.3.2: Test priority update validates range (clamps to 1-10)"""
        from projects import update_task_endpoint
        from flask import Flask
        
        app = Flask(__name__)
        mock_now.return_value = "2025-11-02T00:00:00Z"
        
        # Mock existing task
        mock_task_doc = MagicMock()
        mock_task_doc.exists = True
        mock_task_doc.to_dict.return_value = {
            "title": "Test Task",
            "priority": 5,
            "status": "to-do"
        }
        
        mock_task_ref = MagicMock()
        mock_task_ref.get.return_value = mock_task_doc

        # Mock project document
        mock_project_doc = MagicMock()
        mock_project_doc.exists = True
        mock_project_doc.id = "project123"
        mock_project_doc.to_dict.return_value = {"name": "Project 1", "status": "in progress"}
        mock_project_ref = MagicMock()
        mock_project_ref.get.return_value = mock_project_doc
        mock_project_ref.collection.return_value.document.return_value = mock_task_ref

        mock_db.collection.return_value.document.return_value = mock_project_ref
        
        with app.test_request_context(
            json={"priority": 20}  # Invalid priority above 10
        ):
            result = update_task_endpoint("project123", "task123")
            response = make_response(result)
            # Verify priority was clamped to 10
            update_call = mock_task_ref.update.call_args[0][0]
            assert update_call['priority'] == 10, "Priority should be clamped to 10"
            assert response.status_code == 200, "Task update should succeed"
    
    @patch('projects.db')
    @patch('projects.now_utc')
    def test_325_3_3_priority_edit_from_low_to_high(self, mock_now, mock_db):
        """Scrum-325.3.3: Test priority can be edited from low (2) to high (9)"""
        from projects import update_task_endpoint
        from flask import Flask
        
        app = Flask(__name__)
        mock_now.return_value = "2025-11-02T00:00:00Z"
        
        # Mock existing task with low priority
        mock_task_doc = MagicMock()
        mock_task_doc.exists = True
        mock_task_doc.to_dict.return_value = {
            "title": "Test Task",
            "priority": 2,  # Low priority
            "status": "to-do"
        }
        
        mock_task_ref = MagicMock()
        mock_task_ref.get.return_value = mock_task_doc

        # Mock project document
        mock_project_doc = MagicMock()
        mock_project_doc.exists = True
        mock_project_doc.id = "project123"
        mock_project_doc.to_dict.return_value = {"name": "Project 1", "status": "in progress"}
        mock_project_ref = MagicMock()
        mock_project_ref.get.return_value = mock_project_doc
        mock_project_ref.collection.return_value.document.return_value = mock_task_ref

        mock_db.collection.return_value.document.return_value = mock_project_ref
        
        with app.test_request_context(
            json={"priority": 9}  # Updating to high priority
        ):
            result = update_task_endpoint("project123", "task123")
            response = make_response(result)
            # Verify priority was updated
            update_call = mock_task_ref.update.call_args[0][0]
            assert update_call['priority'] == 9, "Priority should be updated from 2 to 9"
            assert response.status_code == 200, "Task update should succeed"
    
    @patch('projects.db')
    @patch('projects.now_utc')
    def test_325_3_4_priority_edit_preserves_other_fields(self, mock_now, mock_db):
        """Scrum-325.3.4: Test editing priority does not affect other task fields"""
        from projects import update_task_endpoint
        from flask import Flask
        
        app = Flask(__name__)
        mock_now.return_value = "2025-11-02T00:00:00Z"
        
        # Mock existing task
        mock_task_doc = MagicMock()
        mock_task_doc.exists = True
        original_task = {
            "title": "Important Task",
            "description": "This is important",
            "priority": 5,
            "status": "in-progress",
            "assigneeId": "user123"
        }
        mock_task_doc.to_dict.return_value = original_task
        
        mock_task_ref = MagicMock()
        mock_task_ref.get.return_value = mock_task_doc

        # Mock project document
        mock_project_doc = MagicMock()
        mock_project_doc.exists = True
        mock_project_doc.id = "project123"
        mock_project_doc.to_dict.return_value = {"name": "Project 1", "status": "in progress"}
        mock_project_ref = MagicMock()
        mock_project_ref.get.return_value = mock_project_doc
        mock_project_ref.collection.return_value.document.return_value = mock_task_ref

        mock_db.collection.return_value.document.return_value = mock_project_ref
        
        with app.test_request_context(
            json={"priority": 8}  # Only updating priority
        ):
            result = update_task_endpoint("project123", "task123")
            response = make_response(result)
            # Verify only priority and updatedAt were updated
            update_call = mock_task_ref.update.call_args[0][0]
            assert update_call['priority'] == 8, "Priority should be updated"
            assert 'updatedAt' in update_call, "UpdatedAt should be set"
            assert 'title' not in update_call, "Title should not be in update"
            assert 'description' not in update_call, "Description should not be in update"
            assert response.status_code == 200, "Task update should succeed"
    
    @patch('projects.db')
    @patch('projects.now_utc')
    def test_325_3_5_priority_edit_with_string_value(self, mock_now, mock_db):
        """Scrum-325.3.5: Test priority can be edited with string numeric value"""
        from projects import update_task_endpoint
        from flask import Flask
        
        app = Flask(__name__)
        mock_now.return_value = "2025-11-02T00:00:00Z"
        
        # Mock existing task
        mock_task_doc = MagicMock()
        mock_task_doc.exists = True
        mock_task_doc.to_dict.return_value = {
            "title": "Test Task",
            "priority": 5,
            "status": "to-do"
        }
        
        mock_task_ref = MagicMock()
        mock_task_ref.get.return_value = mock_task_doc

        # Mock project document
        mock_project_doc = MagicMock()
        mock_project_doc.exists = True
        mock_project_doc.id = "project123"
        mock_project_doc.to_dict.return_value = {"name": "Project 1", "status": "in progress"}
        mock_project_ref = MagicMock()
        mock_project_ref.get.return_value = mock_project_doc
        mock_project_ref.collection.return_value.document.return_value = mock_task_ref

        mock_db.collection.return_value.document.return_value = mock_project_ref
        
        with app.test_request_context(
            json={"priority": "7"}  # String value
        ):
            result = update_task_endpoint("project123", "task123")
            response = make_response(result)
            # Verify string was converted to int
            update_call = mock_task_ref.update.call_args[0][0]
            assert update_call['priority'] == 7, "String '7' should convert to int 7"
            assert isinstance(update_call['priority'], int), "Priority should be an integer"
            assert response.status_code == 200, "Task update should succeed"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])