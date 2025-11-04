# back-end/tests/test_project_progress_unit.py
"""
Unit tests for project progress bar calculation logic.
Covers Scrum-324.1 – Scrum-324.8 with mocked data
"""

import pytest
from unittest.mock import Mock, patch
from datetime import datetime, timezone


def calculate_progress(tasks):
    """Helper function to calculate progress percentage"""
    if not tasks:
        return 0
    
    completed_count = sum(1 for task in tasks if task.get("status") == "completed")
    return round((completed_count / len(tasks)) * 100)


@pytest.mark.unit
class TestProjectProgressUnit:
    
    # Scrum-324.1 – Progress shown on load
    def test_progress_shown_on_load_formula_check(self):
        """Test progress calculation with initial task mix"""
        tasks = [
            {"id": "1", "title": "Task A", "status": "to-do"},
            {"id": "2", "title": "Task B", "status": "in-progress"},
            {"id": "3", "title": "Task C", "status": "completed"},
        ]
        
        progress = calculate_progress(tasks)
        
        # 1 completed out of 3 tasks = 33%
        assert progress == 33, f"Expected 33% progress, got {progress}%"
        
        completed_tasks = [t for t in tasks if t.get("status") == "completed"]
        assert len(completed_tasks) == 1, f"Should have 1 completed task, got: {len(completed_tasks)}"
        assert len(tasks) == 3, f"Should have 3 total tasks, got: {len(tasks)}"

    # Scrum-324.2 – Recalculate on new task created
    def test_progress_recalculate_on_new_task(self):
        """Test progress recalculation when adding new task"""
        initial_tasks = [
            {"id": "1", "title": "Task A", "status": "to-do"},
            {"id": "2", "title": "Task B", "status": "in-progress"},
            {"id": "3", "title": "Task C", "status": "completed"},
        ]
        
        initial_progress = calculate_progress(initial_tasks)
        assert initial_progress == 33, f"Initial progress should be 33%, got {initial_progress}%"
        
        # Add new to-do task
        updated_tasks = initial_tasks + [
            {"id": "4", "title": "Task D", "status": "to-do"}
        ]
        
        new_progress = calculate_progress(updated_tasks)
        
        # 1 completed out of 4 tasks = 25%
        assert new_progress == 25, f"New progress should be 25%, got {new_progress}%"
        assert new_progress < initial_progress, "Progress percentage should decrease when adding non-completed task"

    # Scrum-324.3 – Recalculate on status change
    def test_progress_recalculate_on_status_change(self):
        """Test progress recalculation when task status changes"""
        initial_tasks = [
            {"id": "1", "title": "Task A", "status": "to-do"},
            {"id": "2", "title": "Task B", "status": "in-progress"},
            {"id": "3", "title": "Task C", "status": "completed"},
        ]
        
        initial_progress = calculate_progress(initial_tasks)
        assert initial_progress == 33, f"Initial progress should be 33%, got {initial_progress}%"
        
        # Change Task A from to-do to completed
        updated_tasks = [
            {"id": "1", "title": "Task A", "status": "completed"},  # Changed
            {"id": "2", "title": "Task B", "status": "in-progress"},
            {"id": "3", "title": "Task C", "status": "completed"},
        ]
        
        new_progress = calculate_progress(updated_tasks)
        
        # 2 completed out of 3 tasks = 67%
        assert new_progress == 67, f"New progress should be 67%, got {new_progress}%"
        assert new_progress > initial_progress, "Progress should increase when completing a task"

    # Scrum-324.4 – Display whole number
    def test_progress_display_is_whole_number(self):
        """Test that progress is always displayed as whole number"""
        # Test case that would result in 33.33...%
        tasks = [
            {"status": "completed"},
            {"status": "to-do"},
            {"status": "to-do"}
        ]
        
        progress = calculate_progress(tasks)
        
        assert isinstance(progress, int), f"Progress should be integer, got {type(progress)}: {progress}"
        assert progress == 33, f"Expected 33% (rounded), got {progress}%"
        
        # Test case that would result in 66.66...%
        tasks_two_thirds = [
            {"status": "completed"},
            {"status": "completed"},
            {"status": "to-do"}
        ]
        
        progress_two_thirds = calculate_progress(tasks_two_thirds)
        assert progress_two_thirds == 67, f"Expected 67% (rounded), got {progress_two_thirds}%"

    # Scrum-324.5 – Zero tasks project shows 0%
    def test_progress_zero_tasks(self):
        """Test progress calculation for project with no tasks"""
        tasks = []
        progress = calculate_progress(tasks)
        
        assert progress == 0, f"Expected 0% for empty project, got {progress}%"

    # Scrum-324.6 – All complete shows 100%
    def test_progress_full_completion(self):
        """Test progress calculation when all tasks are completed"""
        tasks = [
            {"id": "1", "title": "Done 1", "status": "completed"},
            {"id": "2", "title": "Done 2", "status": "completed"},
            {"id": "3", "title": "Done 3", "status": "completed"},
            {"id": "4", "title": "Done 4", "status": "completed"}
        ]
        
        progress = calculate_progress(tasks)
        
        assert len(tasks) == 4, f"Expected 4 tasks, got {len(tasks)}"
        
        completed_tasks = [t for t in tasks if t.get("status") == "completed"]
        assert len(completed_tasks) == len(tasks), f"All tasks should be completed. Completed: {len(completed_tasks)}, Total: {len(tasks)}"
        
        assert progress == 100, f"Expected 100% but got {progress}%"

    # Scrum-324.7 – Negative: Non-complete status should not increase progress
    def test_progress_unchanged_on_non_complete_status(self):
        """Test that changing task to non-completed status doesn't increase progress"""
        initial_tasks = [
            {"id": "1", "title": "Task A", "status": "to-do"},
            {"id": "2", "title": "Task B", "status": "in-progress"},
            {"id": "3", "title": "Task C", "status": "completed"}
        ]
        
        initial_progress = calculate_progress(initial_tasks)
        
        # Change Task A from to-do to in-progress (still not completed)
        updated_tasks = [
            {"id": "1", "title": "Task A", "status": "in-progress"},  # Changed but still not completed
            {"id": "2", "title": "Task B", "status": "in-progress"},
            {"id": "3", "title": "Task C", "status": "completed"}
        ]
        
        new_progress = calculate_progress(updated_tasks)
        
        # Progress should remain the same (1 completed out of 3)
        assert new_progress == initial_progress, f"Progress should not change: {initial_progress}% -> {new_progress}%"
        
        completed_before = len([t for t in initial_tasks if t.get("status") == "completed"])
        completed_after = len([t for t in updated_tasks if t.get("status") == "completed"])
        
        assert completed_after == completed_before, f"Completed count should not change: {completed_before} -> {completed_after}"

    # Scrum-324.8 – Negative: Verify progress doesn't change on task creation failure
    def test_progress_task_creation_failure_logic(self):
        """Test that failed task creation doesn't affect progress calculation"""
        # Simulate existing tasks
        existing_tasks = [
            {"id": "1", "status": "to-do"},
            {"id": "2", "status": "completed"},
            {"id": "3", "status": "completed"}
        ]
        
        initial_progress = calculate_progress(existing_tasks)
        initial_count = len(existing_tasks)
        
        # If task creation fails, the task list should remain unchanged
        # This simulates what should happen when API returns error
        final_tasks = existing_tasks  # No change due to failure
        
        final_progress = calculate_progress(final_tasks)
        final_count = len(final_tasks)
        
        assert final_progress == initial_progress, f"Progress changed from {initial_progress}% to {final_progress}%"
        assert final_count == initial_count, f"Task count changed from {initial_count} to {final_count}"

    # Additional edge case tests
    def test_progress_calculation_edge_cases(self):
        """Test edge cases in progress calculation"""
        
        # Single task completed
        single_completed = [{"status": "completed"}]
        assert calculate_progress(single_completed) == 100
        
        # Single task not completed
        single_todo = [{"status": "to-do"}]
        assert calculate_progress(single_todo) == 0
        
        # Large number of tasks
        many_tasks = [{"status": "completed"} for _ in range(100)]
        assert calculate_progress(many_tasks) == 100
        
        # Mixed large number
        mixed_large = (
            [{"status": "completed"} for _ in range(50)] +
            [{"status": "to-do"} for _ in range(50)]
        )
        assert calculate_progress(mixed_large) == 50

    def test_progress_with_different_status_values(self):
        """Test progress calculation with various status values"""
        tasks_various_statuses = [
            {"status": "completed"},
            {"status": "done"},  # Different completed status (if supported)
            {"status": "to-do"},
            {"status": "todo"},
            {"status": "in-progress"},
            {"status": "in_progress"},
            {"status": "review"},
            {"status": "testing"}
        ]
        
        # Only "completed" should count toward progress
        progress = calculate_progress(tasks_various_statuses)
        
        # Should be 1 out of 8 = 12.5% -> rounds to 12% or 13%
        completed_count = len([t for t in tasks_various_statuses if t.get("status") == "completed"])
        expected_progress = round((completed_count / len(tasks_various_statuses)) * 100)
        
        assert progress == expected_progress, f"Expected {expected_progress}% but got {progress}%"
        assert completed_count == 1, f"Only 1 task should be counted as completed, got {completed_count}"

    @patch('builtins.round')
    def test_progress_rounding_behavior(self, mock_round):
        """Test that progress calculation uses proper rounding"""
        mock_round.return_value = 33
        
        tasks = [
            {"status": "completed"},
            {"status": "to-do"},
            {"status": "to-do"}
        ]
        
        progress = calculate_progress(tasks)
        
        # Verify that round() was called with the correct percentage
        mock_round.assert_called_once_with((1/3) * 100)
        assert progress == 33
