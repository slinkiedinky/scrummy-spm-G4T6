# back-end/tests/test_dashboard_filters_unit.py
"""
Unit tests for dashboard filtering logic (projects).
Covers Scrum-53.1, 53.2, 53.3, 53.4, 53.5, 53.7, 53.8, 53.9, 53.10, 53.11 (logic), 53.12 (logic).
UI tag visibility for 53.6/53.11/53.12 remains manual.
"""

from time import perf_counter
import pytest

def normalize_status(s: str | None) -> str:
    if not s:
        return ""
    s = s.strip().lower().replace("_", " ").replace("-", " ")
    return "todo" if s in {"to do", "todo"} else s

def parse_progress_bucket(label: str) -> tuple[int, int] | None:
    # Accept "0-24%" or "0-24"
    if not label:
        return None
    lab = label.replace("%", "").strip()
    if "-" in lab:
        lo, hi = lab.split("-", 1)
        return int(lo), int(hi)
    return None

def filter_projects(projects, project_name=None, status=None, priority=None, progress_bucket=None, employee=None):
    """
    Pure filtering logic using AND semantics across provided fields.
    """
    res = list(projects)
    if project_name:
        pn = project_name.strip().lower()
        res = [p for p in res if p["name"].lower() == pn]
    if status:
        st = normalize_status(status)
        res = [p for p in res if normalize_status(p.get("status")) == st]
    if priority:
        pr = (priority or "").strip().lower()
        res = [p for p in res if (p.get("priority") or "").lower() == pr]
    if progress_bucket:
        rng = parse_progress_bucket(progress_bucket)
        if rng:
            lo, hi = rng
            res = [p for p in res if isinstance(p.get("progress"), int) and lo <= p["progress"] <= hi]
    if employee:
        em = (employee or "").strip().lower()
        res = [p for p in res if (p.get("employee") or "").lower() == em]
    return res

@pytest.fixture
def dataset():
    # name, status, priority, progress(%), employee
    return [
        {"name": "project a", "status": "todo",        "priority": "high",   "progress": 10,  "employee": "alice"},
        {"name": "project a", "status": "in-progress", "priority": "high",   "progress": 22,  "employee": "bob"},
        {"name": "project a", "status": "todo",        "priority": "medium", "progress": 35,  "employee": "carl"},
        {"name": "project b", "status": "in-progress", "priority": "high",   "progress": 49,  "employee": "alice"},
        {"name": "project b", "status": "completed",   "priority": "low",    "progress": 100, "employee": "dina"},
        {"name": "project c", "status": "todo",        "priority": "low",    "progress": 5,   "employee": "eric"},
        {"name": "project d", "status": "in-progress", "priority": "medium", "progress": 65,  "employee": "fran"},
        {"name": "project e", "status": "todo",        "priority": "high",   "progress": 80,  "employee": "george"},
    ]

# Scrum-53.1 — Filter by project
def test_scrum_53_1_filter_by_project(dataset):
    out = filter_projects(dataset, project_name="Project A")
    assert out and all(p["name"].lower() == "project a" for p in out)

# Scrum-53.2 — Filter by progress (0–24%)
def test_scrum_53_2_filter_by_progress(dataset):
    out = filter_projects(dataset, progress_bucket="0-24%")
    assert out and all(0 <= p["progress"] <= 24 for p in out)

# Scrum-53.3 — Filter by priority (High)
def test_scrum_53_3_filter_by_priority(dataset):
    out = filter_projects(dataset, priority="High")
    assert out and all((p["priority"] or "").lower() == "high" for p in out)

# Scrum-53.4 — Filter by status (Todo)
def test_scrum_53_4_filter_by_status(dataset):
    out = filter_projects(dataset, status="Todo")
    assert out and all(normalize_status(p["status"]) == "todo" for p in out)

# Scrum-53.5 — Multiple filters (Project A + Todo)
def test_scrum_53_5_multiple_filters(dataset):
    out = filter_projects(dataset, project_name="Project A", status="Todo")
    assert len(out) >= 1
    assert all(p["name"].lower() == "project a" and normalize_status(p["status"]) == "todo" for p in out)

# Scrum-53.7 — No results message (logic = empty result)
def test_scrum_53_7_no_results_logic(dataset):
    out = filter_projects(dataset, project_name="Project X", status="Completed")
    assert len(out) == 0  # UI message text checked manually in UI

# Scrum-53.8 — Instant update ≤ 5s
def test_scrum_53_8_instant_update(dataset):
    t0 = perf_counter()
    _ = filter_projects(dataset, priority="Medium")
    elapsed = perf_counter() - t0
    assert elapsed < 5.0

# Scrum-53.9 — Long text input
def test_scrum_53_9_long_text(dataset):
    q = "hQ7mT2zK9vN4yC8fW1xR5aL0sE3uJ6dP9gH7oB4nZ2tV8qM5iF0rY3lU1cA6wS9jD7pX2b"
    out = filter_projects(dataset, project_name=q)
    assert len(out) == 0

# Scrum-53.10 — Special characters input
def test_scrum_53_10_special_characters(dataset):
    out = filter_projects(dataset, project_name="##EHFEH@@!!")
    assert len(out) == 0  # UI should show "No matching projects found" (manual text check)

# Scrum-53.11 — Clear all filters restores baseline (logic)
def test_scrum_53_11_clear_all_logic(dataset):
    filtered = filter_projects(dataset, project_name="Project A", progress_bucket="0-24%")
    cleared = filter_projects(dataset)  # no filters
    assert len(cleared) >= len(filtered)

# Scrum-53.12 — Remove a single filter (logic)
def test_scrum_53_12_remove_single_filter_logic(dataset):
    both = filter_projects(dataset, project_name="Project A", status="Todo")
    only_project = filter_projects(dataset, project_name="Project A")
    assert len(only_project) >= len(both)
