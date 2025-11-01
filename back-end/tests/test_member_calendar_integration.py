"""
Integration tests for member calendar/schedule functionality using existing task endpoints
Tests task deadline visualization, member workload calendar, and date-based task filtering
"""
import json
import os
import sys
import pytest
from datetime import datetime, timezone, timedelta

# Ensure the back-end folder is on the import path
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from app import app as flask_app
from fake_firestore import FakeFirestore, FakeCollection, FakeDocumentReference
import projects


@pytest.fixture
def test_client(monkeypatch):
    """Create a test client with mocked Firestore database"""
    fake_db = FakeFirestore()
    monkeypatch.setattr(projects, "db", fake_db)
    
    # Mock now_utc to return consistent timestamp
    monkeypatch.setattr(projects, "now_utc", lambda: datetime(2024, 11, 15, tzinfo=timezone.utc))
    
    flask_app.config.update(TESTING=True)
    with flask_app.test_client() as client:
        yield client, fake_db


# ============================================================================
# MEMBER CALENDAR/SCHEDULE INTEGRATION TESTS
# ============================================================================

@pytest.mark.integration
class TestMemberCalendarIntegration:
    """Test member calendar and schedule functionality using existing endpoints"""
    
    @pytest.mark.integration
    def test_member_task_schedule_by_deadline(self, test_client):
        """Test getting a member's task schedule based on deadlines using existing endpoints"""
        client, fake_db = test_client
        
        # Create project (using correct API prefix)
        response = client.post("/api/projects/", json={
            "name": "Calendar Integration Project",
            "ownerId": "user-1"
        })
        assert response.status_code == 201
        project = response.get_json()
        project_id = project["id"]
        
        # Add team member
        response = client.put(f"/api/projects/{project_id}", json={
            "teamIds": ["user-1", "john-doe"],
            "userId": "user-1"
        })
        assert response.status_code == 200
        
        # Create tasks with different deadlines for john-doe
        current_date = datetime(2024, 11, 15, tzinfo=timezone.utc)
        tasks_data = [
            {
                "title": "Task Due Today",
                "description": "Important task due today",
                "dueDate": current_date.isoformat(),
                "status": "in progress",  # Use backend format
                "priority": 8,
                "assigneeId": "john-doe"
            },
            {
                "title": "Task Due Tomorrow",
                "description": "Task for tomorrow",
                "dueDate": (current_date + timedelta(days=1)).isoformat(),
                "status": "to-do",
                "priority": 7,
                "assigneeId": "john-doe"
            },
            {
                "title": "Task Due Next Week",
                "description": "Future task",
                "dueDate": (current_date + timedelta(days=7)).isoformat(),
                "status": "to-do",
                "priority": 5,
                "assigneeId": "john-doe"
            },
            {
                "title": "Overdue Task",
                "description": "Task that's overdue",
                "dueDate": (current_date - timedelta(days=2)).isoformat(),
                "status": "in progress",  # Use backend format
                "priority": 9,
                "assigneeId": "john-doe"
            }
        ]
        
        created_tasks = []
        for task_data in tasks_data:
            response = client.post(f"/api/projects/{project_id}/tasks", json={
                **task_data,
                "userId": "user-1"
            })
            assert response.status_code == 201
            created_tasks.append(response.get_json())
        
        # Get john-doe's tasks (simulating calendar view)
        response = client.get(f"/api/projects/{project_id}/tasks?userId=user-1&assigneeId=john-doe")
        assert response.status_code == 200
        john_tasks = response.get_json()
        
        # Verify calendar-like data structure
        assert len(john_tasks) == 4
        
        # Organize tasks by date (calendar logic)
        tasks_by_date = {}
        for task in john_tasks:
            if task.get("dueDate"):
                due_date = task["dueDate"][:10]  # Extract date part
                if due_date not in tasks_by_date:
                    tasks_by_date[due_date] = []
                tasks_by_date[due_date].append(task)
        
        # Verify calendar structure
        assert len(tasks_by_date) == 4  # 4 different dates
        
        # Verify task data contains calendar-relevant fields
        for task in john_tasks:
            assert "title" in task  # name equivalent
            assert "description" in task
            assert "dueDate" in task  # due_date equivalent
            assert "status" in task
            assert "assigneeId" in task
            assert task["assigneeId"] == "john-doe"

    @pytest.mark.integration
    def test_member_workload_calendar_view(self, test_client):
        """Test member workload distribution across time periods"""
        client, fake_db = test_client
        
        # Create project
        response = client.post("/api/projects/", json={
            "name": "Workload Calendar Project",
            "ownerId": "user-1"
        })
        assert response.status_code == 201
        project = response.get_json()
        project_id = project["id"]
        
        # Add team members
        response = client.put(f"/api/projects/{project_id}", json={
            "teamIds": ["user-1", "john-doe", "jane-smith"],
            "userId": "user-1"
        })
        assert response.status_code == 200
        
        # Create tasks distributed across current month
        current_date = datetime(2024, 11, 15, tzinfo=timezone.utc)
        month_tasks = []
        
        # Week 1 tasks
        for i in range(3):
            response = client.post(f"/api/projects/{project_id}/tasks", json={
                "title": f"John Week 1 Task {i+1}",
                "dueDate": (current_date - timedelta(days=10-i)).isoformat(),
                "assigneeId": "john-doe",
                "status": "completed",
                "userId": "user-1"
            })
            assert response.status_code == 201
            month_tasks.append(response.get_json())
        
        # Week 2 tasks
        for i in range(2):
            response = client.post(f"/api/projects/{project_id}/tasks", json={
                "title": f"John Week 2 Task {i+1}",
                "dueDate": (current_date - timedelta(days=3-i)).isoformat(),
                "assigneeId": "john-doe",
                "status": "in progress",  # Use backend format
                "userId": "user-1"
            })
            assert response.status_code == 201
            month_tasks.append(response.get_json())
        
        # Current week tasks
        for i in range(4):
            response = client.post(f"/api/projects/{project_id}/tasks", json={
                "title": f"John Current Week Task {i+1}",
                "dueDate": (current_date + timedelta(days=i)).isoformat(),
                "assigneeId": "john-doe",
                "status": "to-do",
                "userId": "user-1"
            })
            assert response.status_code == 201
            month_tasks.append(response.get_json())
        
        # Get all john's tasks for the month
        response = client.get(f"/api/projects/{project_id}/tasks?userId=user-1&assigneeId=john-doe")
        assert response.status_code == 200
        john_monthly_tasks = response.get_json()
        
        # Simulate calendar month view logic
        assert len(john_monthly_tasks) == 9  # 3 + 2 + 4 tasks
        
        # Group by week for calendar display
        weeks = {"week1": [], "week2": [], "current_week": []}
        for task in john_monthly_tasks:
            if task.get("dueDate"):
                task_date = datetime.fromisoformat(task["dueDate"].replace("Z", "+00:00"))
                days_diff = (task_date - current_date).days
                
                if days_diff < -7:
                    weeks["week1"].append(task)
                elif -7 <= days_diff < 0:
                    weeks["week2"].append(task)  
                else:
                    weeks["current_week"].append(task)
        
        # Verify workload distribution
        assert len(weeks["week1"]) == 3
        assert len(weeks["week2"]) == 2
        assert len(weeks["current_week"]) == 4

    @pytest.mark.integration
    def test_member_calendar_task_status_colors(self, test_client):
        """Test that tasks in calendar view have proper status colors"""
        client, fake_db = test_client
        
        # Create project
        response = client.post("/api/projects/", json={
            "name": "Calendar Colors Project",
            "ownerId": "user-1"
        })
        assert response.status_code == 201
        project = response.get_json()
        project_id = project["id"]
        
        # Add john-doe to team
        response = client.put(f"/api/projects/{project_id}", json={
            "teamIds": ["user-1", "john-doe"],
            "userId": "user-1"
        })
        assert response.status_code == 200
        
        # Create tasks with different statuses
        status_tasks = [
            {"title": "To-Do Calendar Task", "status": "to-do", "expected_color": "grey"},
            {"title": "In Progress Calendar Task", "status": "in progress", "expected_color": "yellow"},  # Use backend format
            {"title": "Completed Calendar Task", "status": "completed", "expected_color": "green"},
            {"title": "Blocked Calendar Task", "status": "blocked", "expected_color": "red"}
        ]
        
        for task_data in status_tasks:
            response = client.post(f"/api/projects/{project_id}/tasks", json={
                "title": task_data["title"],
                "status": task_data["status"],
                "assigneeId": "john-doe",
                "dueDate": datetime(2024, 11, 15, tzinfo=timezone.utc).isoformat(),
                "userId": "user-1"
            })
            assert response.status_code == 201
        
        # Get tasks for calendar display
        response = client.get(f"/api/projects/{project_id}/tasks?userId=user-1&assigneeId=john-doe")
        assert response.status_code == 200
        calendar_tasks = response.get_json()
        
        # Verify status data is available for color mapping (use backend format)
        status_mapping = {
            "to-do": "grey",
            "in progress": "yellow",  # Use backend format with space
            "completed": "green",
            "blocked": "red"
        }
        
        for task in calendar_tasks:
            expected_color = status_mapping.get(task["status"])
            assert expected_color is not None, f"Unknown status: {task['status']}"
            # In a real calendar, you'd map task["status"] to the color
            # Here we just verify the status is correct for color mapping
            assert task["status"] in status_mapping

    @pytest.mark.integration
    def test_member_calendar_with_task_details(self, test_client):
        """Test calendar tasks include detailed information for modal display"""
        client, fake_db = test_client
        
        # Create project
        response = client.post("/api/projects/", json={
            "name": "Calendar Details Project",
            "ownerId": "user-1"
        })
        assert response.status_code == 201
        project = response.get_json()
        project_id = project["id"]
        
        # Add john-doe to team
        response = client.put(f"/api/projects/{project_id}", json={
            "teamIds": ["user-1", "john-doe"],
            "userId": "user-1"
        })
        assert response.status_code == 200
        
        # Create main calendar task with rich details
        response = client.post(f"/api/projects/{project_id}/tasks", json={
            "title": "Calendar Task with Details",
            "description": "Task to show in calendar modal with detailed information",
            "dueDate": datetime(2024, 11, 15, tzinfo=timezone.utc).isoformat(),
            "status": "in progress",  # Use backend format
            "priority": 8,
            "assigneeId": "john-doe",
            "userId": "user-1"
        })
        assert response.status_code == 201
        main_task = response.get_json()
        task_id = main_task["id"]
        
        # Get task details for calendar modal
        response = client.get(f"/api/projects/{project_id}/tasks/{task_id}?userId=user-1")
        assert response.status_code == 200
        task_details = response.get_json()
        
        # Verify calendar modal fields are present and detailed
        assert "title" in task_details  # name for modal
        assert "description" in task_details  # description for modal
        assert "dueDate" in task_details  # due_date for modal
        assert "status" in task_details
        assert "priority" in task_details
        assert "assigneeId" in task_details  # collaborators info
        assert "createdAt" in task_details  # creation timestamp
        assert "updatedAt" in task_details  # last update timestamp
        
        # Verify the content is correct for calendar display
        assert task_details["title"] == "Calendar Task with Details"
        assert task_details["description"] == "Task to show in calendar modal with detailed information"
        assert task_details["status"] == "in progress"  # Expect backend format
        assert task_details["priority"] == 8
        assert task_details["assigneeId"] == "john-doe"
        
        # Verify date formatting is calendar-friendly
        assert task_details["dueDate"] is not None
        due_date_str = task_details["dueDate"][:10]  # Extract YYYY-MM-DD
        assert due_date_str == "2024-11-15"

    @pytest.mark.integration
    def test_calendar_month_navigation_simulation(self, test_client):
        """Test month navigation by filtering tasks by date ranges"""
        client, fake_db = test_client
        
        # Create project
        response = client.post("/api/projects/", json={
            "name": "Month Navigation Project",
            "ownerId": "user-1"
        })
        assert response.status_code == 201
        project = response.get_json()
        project_id = project["id"]
        
        # Add john-doe to team
        response = client.put(f"/api/projects/{project_id}", json={
            "teamIds": ["user-1", "john-doe"],
            "userId": "user-1"
        })
        assert response.status_code == 200
        
        # Create tasks in different months
        nov_2024 = datetime(2024, 11, 15, tzinfo=timezone.utc)
        oct_2024 = datetime(2024, 10, 15, tzinfo=timezone.utc)
        dec_2024 = datetime(2024, 12, 15, tzinfo=timezone.utc)
        
        monthly_tasks = [
            {
                "title": "November Task",
                "dueDate": nov_2024.isoformat(),
                "assigneeId": "john-doe",
                "month": "nov"
            },
            {
                "title": "October Task",
                "dueDate": oct_2024.isoformat(),
                "assigneeId": "john-doe",
                "month": "oct"
            },
            {
                "title": "December Task",
                "dueDate": dec_2024.isoformat(),
                "assigneeId": "john-doe",
                "month": "dec"
            }
        ]
        
        for task_data in monthly_tasks:
            response = client.post(f"/api/projects/{project_id}/tasks", json={
                "title": task_data["title"],
                "dueDate": task_data["dueDate"],
                "assigneeId": task_data["assigneeId"],
                "status": "to-do",
                "userId": "user-1"
            })
            assert response.status_code == 201
        
        # Simulate calendar month view - get all tasks and filter by month
        response = client.get(f"/api/projects/{project_id}/tasks?userId=user-1&assigneeId=john-doe")
        assert response.status_code == 200
        all_tasks = response.get_json()
        
        # Filter tasks by month (calendar navigation simulation)
        nov_tasks = []
        oct_tasks = []
        dec_tasks = []
        
        for task in all_tasks:
            if task.get("dueDate"):
                task_date = datetime.fromisoformat(task["dueDate"].replace("Z", "+00:00"))
                if task_date.month == 11 and task_date.year == 2024:
                    nov_tasks.append(task)
                elif task_date.month == 10 and task_date.year == 2024:
                    oct_tasks.append(task)
                elif task_date.month == 12 and task_date.year == 2024:
                    dec_tasks.append(task)
        
        # Verify month navigation results
        assert len(nov_tasks) == 1
        assert len(oct_tasks) == 1
        assert len(dec_tasks) == 1
        
        assert nov_tasks[0]["title"] == "November Task"
        assert oct_tasks[0]["title"] == "October Task"
        assert dec_tasks[0]["title"] == "December Task"

    @pytest.mark.integration
    def test_invalid_member_calendar_access(self, test_client):
        """Test calendar access for non-team members"""
        client, fake_db = test_client
        
        # Create project
        response = client.post("/api/projects/", json={
            "name": "Access Control Project",
            "ownerId": "user-1"
        })
        assert response.status_code == 201
        project = response.get_json()
        project_id = project["id"]
        
        # Don't add "sam-user" to team, only add john-doe
        response = client.put(f"/api/projects/{project_id}", json={
            "teamIds": ["user-1", "john-doe"],
            "userId": "user-1"
        })
        assert response.status_code == 200
        
        # Create task for john-doe
        response = client.post(f"/api/projects/{project_id}/tasks", json={
            "title": "John's Task",
            "assigneeId": "john-doe",
            "dueDate": datetime(2024, 11, 15, tzinfo=timezone.utc).isoformat(),
            "userId": "user-1"
        })
        assert response.status_code == 201
        
        # Try to get calendar for sam-user (not in team)
        response = client.get(f"/api/projects/{project_id}/tasks?userId=user-1&assigneeId=sam-user")
        assert response.status_code == 200
        sam_tasks = response.get_json()
        
        # Sam should have no tasks (not assigned any)
        assert len(sam_tasks) == 0
        
        # Verify john-doe has tasks
        response = client.get(f"/api/projects/{project_id}/tasks?userId=user-1&assigneeId=john-doe")
        assert response.status_code == 200
        john_tasks = response.get_json()
        assert len(john_tasks) == 1

    @pytest.mark.integration
    def test_calendar_today_highlighting(self, test_client):
        """Test identifying today's date for calendar highlighting"""
        client, fake_db = test_client
        
        # Create project
        response = client.post("/api/projects/", json={
            "name": "Today Highlight Project",
            "ownerId": "user-1"
        })
        assert response.status_code == 201
        project = response.get_json()
        project_id = project["id"]
        
        # Add john-doe to team
        response = client.put(f"/api/projects/{project_id}", json={
            "teamIds": ["user-1", "john-doe"],
            "userId": "user-1"
        })
        assert response.status_code == 200
        
        # Create tasks for today, past, and future
        current_date = datetime(2024, 11, 15, tzinfo=timezone.utc)
        time_tasks = [
            {
                "title": "Today's Task",
                "dueDate": current_date.isoformat(),
                "period": "today"
            },
            {
                "title": "Yesterday's Task", 
                "dueDate": (current_date - timedelta(days=1)).isoformat(),
                "period": "past"
            },
            {
                "title": "Tomorrow's Task",
                "dueDate": (current_date + timedelta(days=1)).isoformat(),
                "period": "future"
            }
        ]
        
        for task_data in time_tasks:
            response = client.post(f"/api/projects/{project_id}/tasks", json={
                "title": task_data["title"],
                "dueDate": task_data["dueDate"],
                "assigneeId": "john-doe",
                "status": "to-do",
                "userId": "user-1"
            })
            assert response.status_code == 201
        
        # Get all tasks and identify today's tasks
        response = client.get(f"/api/projects/{project_id}/tasks?userId=user-1&assigneeId=john-doe")
        assert response.status_code == 200
        all_tasks = response.get_json()
        
        # Simulate calendar "today" logic
        today_str = current_date.strftime("%Y-%m-%d")
        today_tasks = []
        
        for task in all_tasks:
            if task.get("dueDate"):
                task_date = task["dueDate"][:10]  # Extract YYYY-MM-DD
                if task_date == today_str:
                    today_tasks.append(task)
        
        # Verify today identification
        assert len(today_tasks) == 1
        assert today_tasks[0]["title"] == "Today's Task"
        
        # Verify today date format (for calendar highlighting)
        today_formatted = current_date.strftime("%Y-%m-%d")
        assert today_formatted == "2024-11-15"
        assert today_formatted.count("-") == 2  # Valid date format

    @pytest.mark.integration 
    def test_calendar_task_priority_visualization(self, test_client):
        """Test calendar tasks include priority information for visual indicators"""
        client, fake_db = test_client
        
        # Create project
        response = client.post("/api/projects/", json={
            "name": "Priority Calendar Project",
            "ownerId": "user-1"
        })
        assert response.status_code == 201
        project = response.get_json()
        project_id = project["id"]
        
        # Add john-doe to team
        response = client.put(f"/api/projects/{project_id}", json={
            "teamIds": ["user-1", "john-doe"],
            "userId": "user-1"
        })
        assert response.status_code == 200
        
        # Create tasks with different priorities for calendar visualization
        priority_tasks = [
            {"title": "Critical Priority Task", "priority": 10, "status": "to-do"},
            {"title": "High Priority Task", "priority": 8, "status": "in progress"},  # Use backend format
            {"title": "Medium Priority Task", "priority": 5, "status": "to-do"},
            {"title": "Low Priority Task", "priority": 2, "status": "completed"}
        ]
        
        for task_data in priority_tasks:
            response = client.post(f"/api/projects/{project_id}/tasks", json={
                **task_data,
                "assigneeId": "john-doe",
                "dueDate": datetime(2024, 11, 15, tzinfo=timezone.utc).isoformat(),
                "userId": "user-1"
            })
            assert response.status_code == 201
        
        # Get tasks for calendar priority visualization
        response = client.get(f"/api/projects/{project_id}/tasks?userId=user-1&assigneeId=john-doe")
        assert response.status_code == 200
        calendar_tasks = response.get_json()
        
        # Verify priority data is available for calendar visual indicators
        priority_levels = {}
        for task in calendar_tasks:
            priority = task.get("priority", 0)
            if priority >= 8:
                priority_level = "high"
            elif priority >= 5:
                priority_level = "medium"
            else:
                priority_level = "low"
            
            priority_levels[task["title"]] = {
                "level": priority_level,
                "value": priority,
                "status": task["status"]
            }
        
        # Verify priority categorization for calendar display
        assert priority_levels["Critical Priority Task"]["level"] == "high"
        assert priority_levels["Critical Priority Task"]["value"] == 10
        
        assert priority_levels["High Priority Task"]["level"] == "high"
        assert priority_levels["High Priority Task"]["value"] == 8
        
        assert priority_levels["Medium Priority Task"]["level"] == "medium"
        assert priority_levels["Medium Priority Task"]["value"] == 5
        
        assert priority_levels["Low Priority Task"]["level"] == "low"
        assert priority_levels["Low Priority Task"]["value"] == 2
        
        # Verify task data includes all calendar visualization fields
        for task in calendar_tasks:
            assert "title" in task
            assert "priority" in task
            assert "status" in task
            assert "dueDate" in task
            assert "assigneeId" in task
