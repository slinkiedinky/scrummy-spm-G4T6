import datetime as dt
import pytest

# Minimal pure functions under test (inline fallbacks).
# If you implement real ones, import them instead.

def status_to_color(status: str) -> str:
    s = (status or "").strip().lower()
    if s in ("to do", "to-do", "todo"):
        return "grey"
    if s == "completed":
        return "green"
    if s == "blocked":
        return "red"
    if s == "in progress":
        return "yellow"  # change to 'blue' if you want to keep current UI
    return "grey"

def build_days_map(tasks, year: int, month: int, member: str):
    def toiso(d):
        return d.strftime("%Y-%m-%d")
    days = {}
    for t in tasks:
        if t.get("assigneeId") != member:
            continue
        dd = t.get("dueDate")
        if not dd:
            continue
        d = dt.date.fromisoformat(dd[:10])
        if d.year == year and d.month == month:
            key = toiso(d)
            days.setdefault(key, []).append(t)
    return days

SAMPLE = [
    {"id":"t1","title":"Create wireframe","dueDate":"2025-11-01","status":"to-do","assigneeId":"John"},
    {"id":"t2","title":"Finalise wireframe","dueDate":"2025-11-30","status":"in progress","assigneeId":"John"},
    {"id":"t3","title":"Design Mockups","dueDate":"2025-11-15","status":"completed","assigneeId":"John"},
    {"id":"t4","title":"Integration","dueDate":"2025-11-20","status":"blocked","assigneeId":"John"},
    {"id":"t5","title":"Other","dueDate":"2025-11-10","status":"to-do","assigneeId":"Sam"},
]

def test_month_days_placement_first_and_last_day():
    m = build_days_map(SAMPLE, 2025, 11, "John")
    assert any(t["id"] == "t1" for t in m.get("2025-11-01", []))
    assert any(t["id"] == "t2" for t in m.get("2025-11-30", []))

@pytest.mark.parametrize("status,expected",[
    ("to-do","grey"),
    ("in progress","yellow"),  # set 'blue' if you keep blue
    ("completed","green"),
    ("blocked","red"),
])
def test_status_to_color(status, expected):
    assert status_to_color(status) == expected

def test_invalid_member_has_no_john_tasks():
    m = build_days_map(SAMPLE, 2025, 11, "Sam")
    assert "2025-11-01" not in m and "2025-11-30" not in m
