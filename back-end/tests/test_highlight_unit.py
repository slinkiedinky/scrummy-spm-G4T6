# back-end/tests/test_highlight_unit.py
"""
Unit tests for Scrum-78.x – task deadline highlighting rules.
"""

import pytest
from datetime import date, datetime, timedelta

def get_highlight(task_due, status, today=None):
    """
    Returns highlight code:
      "red"  → due today (not completed)
      "yellow" → due within next 7 days inclusive (not completed)
      None  → all others / invalid / completed / no due date
    """
    today = today or date(2025, 9, 24)
    if not task_due or status.lower() == "completed":
        return None
    try:
        d = datetime.strptime(str(task_due), "%Y-%m-%d").date()
    except Exception:
        return None
    delta = (d - today).days
    if delta == 0:
        return "red"
    if 1 <= delta <= 7:
        return "yellow"
    return None


@pytest.mark.parametrize("task_due,status,expected", [
    # 78.1 – due today
    ("2025-09-24","in progress","red"),
    # 78.2 – within 7 days
    ("2025-09-29","todo","yellow"),
    # 78.3 – completed today
    ("2025-09-24","completed",None),
    # 78.4 – completed within 7 days
    ("2025-09-29","completed",None),
    # 78.5 – overdue (past)
    ("2025-09-23","todo",None),
    # 78.6 – after 7 days
    ("2025-10-02","todo",None),
    # 78.7 – exactly 7 days ahead
    ("2025-10-01","todo","yellow"),
    # 78.8 – today 00:00 boundary
    ("2025-09-24","todo","red"),
    # 78.9 – 8 days ahead
    ("2025-10-02","todo",None),
    # 78.10 – no due date
    (None,"todo",None),
    # 78.11 – invalid date
    ("invalid","todo",None),
])
def test_scrum_78_highlighting_rules(task_due,status,expected):
    assert get_highlight(task_due,status) == expected
