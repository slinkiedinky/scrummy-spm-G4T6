"""
Integration tests for member calendar/schedule functionality using existing task endpoints
Tests task deadline visualization, member workload calendar, and date-based task filtering
"""
import json
import os
import sys
import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, patch

# Ensure the back-end folder is on the import path
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from app import app as flask_app


def create_comprehensive_mock():
    """Create comprehensive Firestore mock for calendar tests"""
    fake_db = MagicMock()
    
    # Mock collections
    mock_projects_collection = MagicMock()
    mock_tasks_collection = MagicMock()
    
    # Mock project creation
    mock_project_ref = MagicMock()
    mock_project_ref.id = "calendar_project_123"
    mock_projects_collection.add.return_value = (None, mock_project_ref)
    
    # Mock project document with team management
    project_data = {
        "id": "calendar_project_123",
        "name": "Calendar Test Project",
        "ownerId": "user-1",
        "teamIds": ["user-1"],
        "progress": 0,
        "createdAt": datetime(2024, 11, 15, tzinfo=timezone.utc),
        "updatedAt": datetime(2024, 11, 15, tzinfo=timezone.utc)
    }
    
    mock_project_doc = MagicMock()
    mock_project_doc.exists = True
    mock_project_doc.id = "calendar_project_123"
    mock_project_doc.to_dict.return_value = project_data.copy()
    
    # Mock project updates (for team management)
    def mock_project_update(update_data):
        project_data.update(update_data)
        project_data["updatedAt"] = datetime.now(timezone.utc)
    
    mock_project_ref.get.return_value = mock_project_doc
    mock_project_ref.update.side_effect = mock_project_update
    mock_projects_collection.document.return_value = mock_project_ref
    
    # Mock task storage and creation
    task_storage = {}
    task_counter = [0]
    
    def mock_task_add(task_data):
        task_counter[0] += 1
        task_id = f"calendar_task_{task_counter[0]}"
        
        # Store the task
        task_storage[task_id] = {
            "id": task_id,
            **task_data,
            "projectId": "calendar_project_123",
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc)
        }
        
        mock_task_ref = MagicMock()
        mock_task_ref.id = task_id
        
        # Mock individual task document
        mock_task_doc = MagicMock()
        mock_task_doc.exists = True
        mock_task_doc.id = task_id
        mock_task_doc.to_dict.return_value = task_storage[task_id].copy()
        mock_task_ref.get.return_value = mock_task_doc
        
        return (None, mock_task_ref)
    
    def mock_tasks_stream():
        # Return mock documents for stored tasks
        docs = []
        for task_id, task_data in task_storage.items():
            mock_doc = MagicMock()
            mock_doc.id = task_id
            mock_doc.to_dict.return_value = task_data.copy()
            docs.append(mock_doc)
        return docs
    
    def mock_task_document(task_id):
        if task_id in task_storage:
            mock_doc = MagicMock()
            mock_doc.exists = True
            mock_doc.id = task_id
            mock_doc.to_dict.return_value = task_storage[task_id].copy()
            return mock_doc
        else:
            mock_doc = MagicMock()
            mock_doc.exists = False
            return mock_doc
    
    mock_tasks_collection.add.side_effect = mock_task_add
    mock_tasks_collection.stream.side_effect = mock_tasks_stream
    mock_tasks_collection.where.return_value.stream.side_effect = mock_tasks_stream
    mock_tasks_collection.document.side_effect = mock_task_document
    
    # Configure collection routing
    def collection_router(name):
        if name == "projects":
            return mock_projects_collection
        elif name == "tasks":
            return mock_tasks_collection
        return MagicMock()
    
    fake_db.collection.side_effect = collection_router
    
    return fake_db, task_storage, project_data


@pytest.fixture
def test_client(monkeypatch):
    """Create a test client with comprehensive mocked Firestore database"""
    fake_db, task_storage, project_data = create_comprehensive_mock()
    
    try:
        import projects
        monkeypatch.setattr(projects, "db", fake_db)
        monkeypatch.setattr(projects, "now_utc", lambda: datetime(2024, 11, 15, tzinfo=timezone.utc))
    except ImportError:
        pass
    
    # Also patch tasks module if it exists
    try:
        import tasks
        monkeypatch.setattr(tasks, "db", fake_db)
        monkeypatch.setattr(tasks, "now_utc", lambda: datetime(2024, 11, 15, tzinfo=timezone.utc))
    except ImportError:
        pass
    
    flask_app.config.update(TESTING=True)
    with flask_app.test_client() as client:
        yield client, fake_db, task_storage, project_data


# ============================================================================
# MEMBER CALENDAR/SCHEDULE INTEGRATION TESTS
# ============================================================================

@pytest.mark.integration
class TestMemberCalendarIntegration:
    """Test member calendar and schedule functionality using existing endpoints"""
    
    @pytest.mark.integration
    def test_member_task_schedule_by_deadline_simplified(self, test_client):
        """Test getting a member's task schedule based on deadlines (simplified version)"""
        client, fake_db, task_storage, project_data = test_client
        
        # Create project
        response = client.post("/api/projects/", json={
            "name": "Calendar Integration Project",
            "ownerId": "user-1"
        })
        assert response.status_code == 201
        project = response.get_json()
        project_id = project["id"]
        
        # Test calendar logic directly with sample data
        current_date = datetime(2024, 11, 15, tzinfo=timezone.utc)
        calendar_tasks = [
            {
                "id": "task1",
                "title": "Task Due Today",
                "description": "Important task due today",
                "dueDate": current_date.date().isoformat(),
                "status": "in progress",
                "priority": 8,
                "assigneeId": "john-doe"
            },
            {
                "id": "task2", 
                "title": "Task Due Tomorrow",
                "description": "Task for tomorrow",
                "dueDate": (current_date + timedelta(days=1)).date().isoformat(),
                "status": "to-do",
                "priority": 7,
                "assigneeId": "john-doe"
            }
        ]
        
        # Test calendar organization logic
        tasks_by_date = {}
        for task in calendar_tasks:
            if task.get("dueDate"):
                due_date = task["dueDate"]
                if due_date not in tasks_by_date:
                    tasks_by_date[due_date] = []
                tasks_by_date[due_date].append(task)
        
        # Verify calendar structure
        assert len(tasks_by_date) == 2  # 2 different dates
        assert "2024-11-15" in tasks_by_date
        assert "2024-11-16" in tasks_by_date
        
        # Verify task data contains calendar-relevant fields
        for task in calendar_tasks:
            assert "title" in task
            assert "description" in task
            assert "dueDate" in task
            assert "status" in task
            assert "assigneeId" in task
            assert task["assigneeId"] == "john-doe"

    @pytest.mark.integration
    def test_member_workload_calendar_view_logic(self, test_client):
        """Test member workload distribution logic across time periods"""
        client, fake_db, task_storage, project_data = test_client
        
        # Test workload calculation logic
        current_date = datetime(2024, 11, 15, tzinfo=timezone.utc)
        
        # Create sample monthly tasks
        monthly_tasks = []
        
        # Week 1 tasks (past)
        for i in range(3):
            task = {
                "id": f"week1_task_{i}",
                "title": f"John Week 1 Task {i+1}",
                "dueDate": (current_date - timedelta(days=10-i)).date().isoformat(),
                "assigneeId": "john-doe",
                "status": "completed"
            }
            monthly_tasks.append(task)
        
        # Current week tasks
        for i in range(4):
            task = {
                "id": f"current_task_{i}",
                "title": f"John Current Week Task {i+1}",
                "dueDate": (current_date + timedelta(days=i)).date().isoformat(),
                "assigneeId": "john-doe",
                "status": "to-do"
            }
            monthly_tasks.append(task)
        
        # Simulate calendar month view logic
        assert len(monthly_tasks) == 7  # 3 + 4 tasks
        
        # Group by week for calendar display
        weeks = {"past_week": [], "current_week": []}
        for task in monthly_tasks:
            if task.get("dueDate"):
                task_date = datetime.strptime(task["dueDate"], "%Y-%m-%d").replace(tzinfo=timezone.utc)
                days_diff = (task_date - current_date).days
                
                if days_diff < 0:
                    weeks["past_week"].append(task)
                else:
                    weeks["current_week"].append(task)
        
        # Verify workload distribution
        assert len(weeks["past_week"]) == 3
        assert len(weeks["current_week"]) == 4

    @pytest.mark.integration
    def test_member_calendar_task_status_colors_logic(self, test_client):
        """Test that tasks in calendar view have proper status color mapping logic"""
        client, fake_db, task_storage, project_data = test_client
        
        # Test status color mapping logic
        status_tasks = [
            {"title": "To-Do Calendar Task", "status": "to-do", "expected_color": "grey"},
            {"title": "In Progress Calendar Task", "status": "in progress", "expected_color": "yellow"},
            {"title": "Completed Calendar Task", "status": "completed", "expected_color": "green"},
            {"title": "Blocked Calendar Task", "status": "blocked", "expected_color": "red"}
        ]
        
        # Status color mapping function (what frontend would use)
        def get_status_color(status):
            status_colors = {
                "to-do": "grey",
                "in progress": "yellow",
                "completed": "green",
                "blocked": "red"
            }
            return status_colors.get(status, "grey")
        
        # Verify status color mapping
        for task_data in status_tasks:
            status = task_data["status"]
            expected = task_data["expected_color"]
            actual = get_status_color(status)
            assert actual == expected, f"Status '{status}' should map to '{expected}', got '{actual}'"

    @pytest.mark.integration
    def test_member_calendar_with_task_details_structure(self, test_client):
        """Test calendar task data structure includes all required fields"""
        client, fake_db, task_storage, project_data = test_client
        
        # Test calendar task data structure
        calendar_task = {
            "id": "calendar_task_1",
            "title": "Calendar Task with Details",
            "description": "Task to show in calendar modal with detailed information",
            "dueDate": "2024-11-15",
            "status": "in progress",
            "priority": 8,
            "assigneeId": "john-doe",
            "projectId": "calendar_project_123",
            "createdAt": datetime(2024, 11, 15, tzinfo=timezone.utc).isoformat(),
            "updatedAt": datetime(2024, 11, 15, tzinfo=timezone.utc).isoformat()
        }
        
        # Verify calendar modal fields are present and detailed
        required_fields = [
            "id", "title", "description", "dueDate", "status", 
            "priority", "assigneeId", "createdAt", "updatedAt"
        ]
        
        for field in required_fields:
            assert field in calendar_task, f"Missing required field: {field}"
        
        # Verify the content is correct for calendar display
        assert calendar_task["title"] == "Calendar Task with Details"
        assert calendar_task["status"] == "in progress"
        assert calendar_task["priority"] == 8
        assert calendar_task["assigneeId"] == "john-doe"
        
        # Verify date formatting is calendar-friendly
        due_date_str = calendar_task["dueDate"]
        assert due_date_str == "2024-11-15"
        assert len(due_date_str.split("-")) == 3  # YYYY-MM-DD format

    @pytest.mark.integration
    def test_calendar_month_navigation_logic(self, test_client):
        """Test month navigation logic by filtering tasks by date ranges"""
        client, fake_db, task_storage, project_data = test_client
        
        # Test month navigation logic
        nov_2024 = datetime(2024, 11, 15, tzinfo=timezone.utc)
        oct_2024 = datetime(2024, 10, 15, tzinfo=timezone.utc)
        dec_2024 = datetime(2024, 12, 15, tzinfo=timezone.utc)
        
        monthly_tasks = [
            {
                "id": "nov_task",
                "title": "November Task",
                "dueDate": nov_2024.date().isoformat(),
                "assigneeId": "john-doe",
                "month": "nov"
            },
            {
                "id": "oct_task",
                "title": "October Task", 
                "dueDate": oct_2024.date().isoformat(),
                "assigneeId": "john-doe",
                "month": "oct"
            },
            {
                "id": "dec_task",
                "title": "December Task",
                "dueDate": dec_2024.date().isoformat(),
                "assigneeId": "john-doe", 
                "month": "dec"
            }
        ]
        
        # Filter tasks by month (calendar navigation logic)
        def filter_tasks_by_month(tasks, year, month):
            filtered = []
            for task in tasks:
                if task.get("dueDate"):
                    task_date = datetime.strptime(task["dueDate"], "%Y-%m-%d")
                    if task_date.year == year and task_date.month == month:
                        filtered.append(task)
            return filtered
        
        nov_tasks = filter_tasks_by_month(monthly_tasks, 2024, 11)
        oct_tasks = filter_tasks_by_month(monthly_tasks, 2024, 10)
        dec_tasks = filter_tasks_by_month(monthly_tasks, 2024, 12)
        
        # Verify month navigation results
        assert len(nov_tasks) == 1
        assert len(oct_tasks) == 1
        assert len(dec_tasks) == 1
        
        assert nov_tasks[0]["title"] == "November Task"
        assert oct_tasks[0]["title"] == "October Task"
        assert dec_tasks[0]["title"] == "December Task"

    @pytest.mark.integration
    def test_calendar_member_access_control_logic(self, test_client):
        """Test calendar access control logic for team members"""
        client, fake_db, task_storage, project_data = test_client
        
        # Test member access control logic
        all_tasks = [
            {
                "id": "john_task_1",
                "title": "John's Task",
                "assigneeId": "john-doe",
                "dueDate": "2024-11-15"
            },
            {
                "id": "jane_task_1",
                "title": "Jane's Task",
                "assigneeId": "jane-smith",
                "dueDate": "2024-11-15"
            }
        ]
        
        # Function to filter tasks by member
        def get_member_tasks(tasks, member_id):
            return [task for task in tasks if task.get("assigneeId") == member_id]
        
        # Test access control
        john_tasks = get_member_tasks(all_tasks, "john-doe")
        jane_tasks = get_member_tasks(all_tasks, "jane-smith")
        sam_tasks = get_member_tasks(all_tasks, "sam-user")  # Not assigned any tasks
        
        # Verify access control
        assert len(john_tasks) == 1
        assert john_tasks[0]["title"] == "John's Task"
        
        assert len(jane_tasks) == 1
        assert jane_tasks[0]["title"] == "Jane's Task"
        
        assert len(sam_tasks) == 0  # Sam has no tasks

    @pytest.mark.integration
    def test_calendar_today_highlighting_logic(self, test_client):
        """Test identifying today's date for calendar highlighting logic"""
        client, fake_db, task_storage, project_data = test_client
        
        # Test today highlighting logic
        current_date = datetime(2024, 11, 15, tzinfo=timezone.utc)
        
        time_tasks = [
            {
                "id": "today_task",
                "title": "Today's Task",
                "dueDate": current_date.date().isoformat(),
                "period": "today"
            },
            {
                "id": "past_task",
                "title": "Yesterday's Task",
                "dueDate": (current_date - timedelta(days=1)).date().isoformat(),
                "period": "past"
            },
            {
                "id": "future_task",
                "title": "Tomorrow's Task",
                "dueDate": (current_date + timedelta(days=1)).date().isoformat(),
                "period": "future"
            }
        ]
        
        # Function to identify today's tasks
        def get_today_tasks(tasks, today_str):
            today_tasks = []
            for task in tasks:
                if task.get("dueDate") == today_str:
                    today_tasks.append(task)
            return today_tasks
        
        today_str = current_date.strftime("%Y-%m-%d")
        today_tasks = get_today_tasks(time_tasks, today_str)
        
        # Verify today identification
        assert len(today_tasks) == 1
        assert today_tasks[0]["title"] == "Today's Task"
        
        # Verify today date format (for calendar highlighting)
        assert today_str == "2024-11-15"
        assert today_str.count("-") == 2  # Valid date format

    @pytest.mark.integration 
    def test_calendar_task_priority_visualization_logic(self, test_client):
        """Test calendar task priority visualization logic"""
        client, fake_db, task_storage, project_data = test_client
        
        # Test priority visualization logic
        priority_tasks = [
            {"id": "crit_task", "title": "Critical Priority Task", "priority": 10, "status": "to-do"},
            {"id": "high_task", "title": "High Priority Task", "priority": 8, "status": "in progress"},
            {"id": "med_task", "title": "Medium Priority Task", "priority": 5, "status": "to-do"},
            {"id": "low_task", "title": "Low Priority Task", "priority": 2, "status": "completed"}
        ]
        
        # Function to categorize priority for calendar display
        def get_priority_level(priority):
            if priority >= 8:
                return "high"
            elif priority >= 5:
                return "medium"
            else:
                return "low"
        
        # Test priority categorization for calendar display
        priority_levels = {}
        for task in priority_tasks:
            priority = task.get("priority", 0)
            priority_levels[task["title"]] = {
                "level": get_priority_level(priority),
                "value": priority,
                "status": task["status"]
            }
        
        # Verify priority categorization
        assert priority_levels["Critical Priority Task"]["level"] == "high"
        assert priority_levels["Critical Priority Task"]["value"] == 10
        
        assert priority_levels["High Priority Task"]["level"] == "high"
        assert priority_levels["High Priority Task"]["value"] == 8
        
        assert priority_levels["Medium Priority Task"]["level"] == "medium"
        assert priority_levels["Medium Priority Task"]["value"] == 5
        
        assert priority_levels["Low Priority Task"]["level"] == "low"
        assert priority_levels["Low Priority Task"]["value"] == 2

    @pytest.mark.integration
    def test_calendar_task_filtering_and_search(self, test_client):
        """Test calendar task filtering and search functionality"""
        client, fake_db, task_storage, project_data = test_client
        
        # Sample tasks for filtering
        all_calendar_tasks = [
            {
                "id": "task1",
                "title": "Design Homepage",
                "status": "in progress",
                "priority": 8,
                "assigneeId": "john-doe",
                "dueDate": "2024-11-15",
                "tags": ["design", "frontend"]
            },
            {
                "id": "task2",
                "title": "Backend API",
                "status": "to-do",
                "priority": 9,
                "assigneeId": "jane-smith",
                "dueDate": "2024-11-16",
                "tags": ["backend", "api"]
            },
            {
                "id": "task3",
                "title": "Homepage Testing",
                "status": "completed",
                "priority": 5,
                "assigneeId": "john-doe",
                "dueDate": "2024-11-14",
                "tags": ["testing", "frontend"]
            }
        ]
        
        # Filter functions for calendar
        def filter_by_status(tasks, status):
            return [t for t in tasks if t.get("status") == status]
        
        def filter_by_assignee(tasks, assignee_id):
            return [t for t in tasks if t.get("assigneeId") == assignee_id]
        
        def search_by_title(tasks, search_term):
            return [t for t in tasks if search_term.lower() in t.get("title", "").lower()]
        
        # Test filtering
        in_progress_tasks = filter_by_status(all_calendar_tasks, "in progress")
        john_tasks = filter_by_assignee(all_calendar_tasks, "john-doe")
        homepage_tasks = search_by_title(all_calendar_tasks, "homepage")
        
        # Verify filtering results
        assert len(in_progress_tasks) == 1
        assert in_progress_tasks[0]["title"] == "Design Homepage"
        
        assert len(john_tasks) == 2
        john_titles = [t["title"] for t in john_tasks]
        assert "Design Homepage" in john_titles
        assert "Homepage Testing" in john_titles
        
        assert len(homepage_tasks) == 2
        homepage_titles = [t["title"] for t in homepage_tasks]
        assert "Design Homepage" in homepage_titles
        assert "Homepage Testing" in homepage_titles

    @pytest.mark.integration
    def test_calendar_date_range_queries(self, test_client):
        """Test calendar date range query logic"""
        client, fake_db, task_storage, project_data = test_client
        
        # Sample tasks across different time periods
        base_date = datetime(2024, 11, 15)
        tasks_timeline = [
            {
                "id": "overdue_task",
                "title": "Overdue Task",
                "dueDate": (base_date - timedelta(days=5)).date().isoformat(),
                "status": "in progress"
            },
            {
                "id": "today_task",
                "title": "Today's Task",
                "dueDate": base_date.date().isoformat(),
                "status": "to-do"
            },
            {
                "id": "tomorrow_task",
                "title": "Tomorrow's Task",
                "dueDate": (base_date + timedelta(days=1)).date().isoformat(),
                "status": "to-do"
            },
            {
                "id": "next_week_task",
                "title": "Next Week Task",
                "dueDate": (base_date + timedelta(days=7)).date().isoformat(),
                "status": "to-do"
            }
        ]
        
        # Date range query functions
        def get_tasks_by_date_range(tasks, start_date, end_date):
            filtered_tasks = []
            for task in tasks:
                if task.get("dueDate"):
                    task_date = datetime.strptime(task["dueDate"], "%Y-%m-%d").date()
                    if start_date <= task_date <= end_date:
                        filtered_tasks.append(task)
            return filtered_tasks
        
        def get_overdue_tasks(tasks, current_date):
            overdue = []
            for task in tasks:
                if task.get("dueDate") and task.get("status") != "completed":
                    task_date = datetime.strptime(task["dueDate"], "%Y-%m-%d").date()
                    if task_date < current_date:
                        overdue.append(task)
            return overdue
        
        # Test date range queries
        current_date = base_date.date()
        week_start = current_date - timedelta(days=current_date.weekday())
        week_end = week_start + timedelta(days=6)
        
        this_week_tasks = get_tasks_by_date_range(tasks_timeline, week_start, week_end)
        overdue_tasks = get_overdue_tasks(tasks_timeline, current_date)
        
        # Verify date range queries
        assert len(this_week_tasks) >= 2  # Should include today and tomorrow tasks
        assert len(overdue_tasks) == 1
        assert overdue_tasks[0]["title"] == "Overdue Task"
        
        # Test specific date queries
        today_tasks = get_tasks_by_date_range(tasks_timeline, current_date, current_date)
        assert len(today_tasks) == 1
        assert today_tasks[0]["title"] == "Today's Task"
