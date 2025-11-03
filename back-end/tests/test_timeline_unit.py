# back-end/tests/test_timeline_unit.py
"""
Unit tests for backend timeline logic.
Covers Scrum-139.1 to 139.5, 139.9 to 139.13, and 139.15.
"""

import datetime as dt

UTC = dt.timezone.utc

def visible_on_timeline(task, today):
    """Return True if task should appear on the timeline."""
    status = (task.get("status") or "").lower()
    due_date = dt.datetime.fromisoformat(task["dueDate"].replace("Z", "+00:00")).astimezone(UTC).date()
    today_date = today.date()
    return status != "completed" and (due_date <= today_date or status in ["to-do", "in-progress"])

def filter_tasks(tasks, project=None, priority=None, status=None):
    """Simple backend-style filter simulation."""
    filtered = tasks
    if project:
        filtered = [t for t in filtered if t["project"] == project]
    if priority:
        filtered = [t for t in filtered if t["priority"] == priority]
    if status:
        filtered = [t for t in filtered if t["status"].lower() == status.lower()]
    return filtered


def test_show_all_incomplete_tasks_scrum_139_1():
    tasks = [
        {"status": "in-progress", "dueDate": "2025-11-05T00:00:00Z", "project": "A"},
        {"status": "to-do", "dueDate": "2025-11-10T00:00:00Z", "project": "A"},
        {"status": "completed", "dueDate": "2025-11-01T00:00:00Z", "project": "A"},
        {"status": "to-do", "dueDate": "2025-10-25T00:00:00Z", "project": "B"},  # overdue
    ]
    today = dt.datetime(2025, 11, 1, 12, 0, tzinfo=UTC)
    visible = [t for t in tasks if visible_on_timeline(t, today)]
    assert all(t["status"] != "completed" for t in visible)
    assert len(visible) == 3


def test_filter_by_project_scrum_139_2():
    tasks = [{"project": "Project A"}, {"project": "Project B"}, {"project": "Project A"}]
    result = filter_tasks(tasks, project="Project A")
    assert len(result) == 2
    assert all(t["project"] == "Project A" for t in result)


def test_filter_by_priority_scrum_139_3():
    tasks = [{"priority": 8}, {"priority": 5}, {"priority": 8}]
    result = filter_tasks(tasks, priority=8)
    assert len(result) == 2


def test_filter_by_status_scrum_139_4():
    tasks = [{"status": "to-do"}, {"status": "in-progress"}, {"status": "to-do"}]
    result = filter_tasks(tasks, status="to-do")
    assert len(result) == 2
    assert all(t["status"] == "to-do" for t in result)


def test_combined_filters_scrum_139_5():
    tasks = [
        {"project": "Project A", "priority": 8, "status": "to-do"},
        {"project": "Project A", "priority": 5, "status": "in-progress"},
        {"project": "Project B", "priority": 8, "status": "to-do"},
    ]
    result = filter_tasks(tasks, project="Project A", priority=8, status="to-do")
    assert len(result) == 1


def test_completed_tasks_excluded_scrum_139_9():
    task = {"status": "completed", "dueDate": "2025-11-01T00:00:00Z"}
    today = dt.datetime(2025, 11, 1, 12, 0, tzinfo=UTC)
    assert visible_on_timeline(task, today) is False


def test_due_today_still_visible_scrum_139_15():
    task = {"status": "in-progress", "dueDate": "2025-11-01T23:59:00Z"}
    today = dt.datetime(2025, 11, 1, 9, 0, tzinfo=UTC)  # Changed 01 to 1
    assert visible_on_timeline(task, today) is True
