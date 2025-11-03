# back-end/tests/test_project_dashboard_unit.py
"""
Unit tests for Project Dashboard logic (Scrum-298.x).
Pure functions / data shaping (no HTTP).
"""

import pytest
from collections import defaultdict

def categorize_tasks_by_status(tasks):
    """
    Groups tasks into { 'to-do': [...], 'in-progress': [...], 'completed': [...], 'blocked': [...] }
    Unknown/missing statuses go to 'to-do' by default.
    """
    norm = {
        "todo": "to-do", "to do": "to-do", "to-do": "to-do",
        "in progress": "in-progress", "in-progress": "in-progress",
        "completed": "completed",
        "blocked": "blocked",
    }
    buckets = defaultdict(list)
    for t in tasks:
        raw = (t.get("status") or "").strip().lower()
        key = norm.get(raw, "to-do")
        buckets[key].append(t)
    # ensure all keys exist
    for k in ["to-do", "in-progress", "completed", "blocked"]:
        buckets[k] = buckets.get(k, [])
    return dict(buckets)

def dashboard_header(project):
    """
    Returns the summary header view-model:
    title, description, status, priority, tags, teamCount, overdueCount
    """
    return {
        "title": project.get("name"),
        "description": project.get("description"),
        "status": project.get("status"),
        "priority": project.get("priority"),
        "tags": project.get("tags", []),
        "teamCount": len(project.get("teamIds", [])),
        "overdueCount": project.get("overdueCount", 0),
    }

# Scrum-298.1 — Title & description
def test_scrum_298_1_title_description_unit():
    p = {"name": "Website Redesign", "description": "UI/UX revamp for 2025 launch"}
    hdr = dashboard_header(p)
    assert hdr["title"] == "Website Redesign"
    assert hdr["description"] == "UI/UX revamp for 2025 launch"

# Scrum-298.2 — Status & priority
def test_scrum_298_2_status_priority_unit():
    p = {"status": "In Progress", "priority": "High"}
    hdr = dashboard_header(p)
    assert hdr["status"] == "In Progress"
    assert hdr["priority"] == "High"

# Scrum-298.3 — Tags, team count, overdue count
def test_scrum_298_3_tags_team_overdue_unit():
    p = {"tags": ["UI/UX", "Frontend"], "teamIds": ["u1","u2","u3","u4","u5"], "overdueCount": 2}
    hdr = dashboard_header(p)
    assert hdr["tags"] == ["UI/UX", "Frontend"]
    assert hdr["teamCount"] == 5
    assert hdr["overdueCount"] == 2

# Scrum-298.6 — Categorize by status
def test_scrum_298_6_categorize_tasks_unit():
    tasks = [
        {"title":"A","status":"To Do"},
        {"title":"B","status":"In Progress"},
        {"title":"C","status":"Completed"},
        {"title":"D","status":"Blocked"},
        {"title":"E","status":"todo"},
        {"title":"F","status":""},  # default bucket
    ]
    buckets = categorize_tasks_by_status(tasks)
    assert len(buckets["to-do"]) == 2 + 1  # "To Do", "todo", "" -> default
    assert len(buckets["in-progress"]) == 1
    assert len(buckets["completed"]) == 1
    assert len(buckets["blocked"]) == 1

# Scrum-298.7 — No tasks
def test_scrum_298_7_no_tasks_unit():
    buckets = categorize_tasks_by_status([])
    assert all(len(v) == 0 for v in buckets.values())

# Scrum-298.8 — No tags fallback
def test_scrum_298_8_no_tags_unit():
    p = {"tags": []}
    hdr = dashboard_header(p)
    assert hdr["tags"] == []
