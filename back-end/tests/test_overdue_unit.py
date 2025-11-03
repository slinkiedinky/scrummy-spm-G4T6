# back-end/tests/test_overdue_unit.py
"""
Unit tests for overdue logic (no API calls).
Covers Scrum-135.1 ... 135.7 including boundary at midnight.
"""

import datetime as dt
import pytest

UTC = dt.timezone.utc

def is_overdue(due_iso: str, now: dt.datetime, status: str) -> bool:
    """
    Overdue if:
      - due date (date-only comparison) is strictly before 'now' date, AND
      - status is NOT 'completed'
    """
    if not due_iso:
        return False
    status = (status or "").strip().lower()
    if status == "completed":
        return False
    # Compare at date granularity
    d = dt.datetime.fromisoformat(due_iso.replace("Z", "+00:00")).astimezone(UTC).date()
    today = now.astimezone(UTC).date()
    return d < today

def test_flag_past_due_as_overdue_scrum_135_1():
    # Task A due yesterday, not completed
    now = dt.datetime(2025, 11, 1, 10, 0, tzinfo=UTC)
    due = "2025-10-31T09:00:00Z"
    assert is_overdue(due, now, "in-progress") is True

def test_do_not_flag_future_tasks_scrum_135_2():
    # Task B due tomorrow
    now = dt.datetime(2025, 11, 1, 10, 0, tzinfo=UTC)
    due = "2025-11-02T09:00:00Z"
    assert is_overdue(due, now, "to-do") is False

def test_do_not_flag_due_today_scrum_135_3():
    # Task C due today
    now = dt.datetime(2025, 11, 1, 0, 1, tzinfo=UTC)  # Fixed: removed leading zero
    due = "2025-11-01T23:59:59Z"
    assert is_overdue(due, now, "to-do") is False

def test_overdue_counter_matches_flagged_items_logic_scrum_135_4():
    now = dt.datetime(2025, 11, 1, 12, 0, tzinfo=UTC)
    tasks = [
        {"title": "Task A", "due": "2025-10-30T10:00:00Z", "status": "to-do"},        # overdue
        {"title": "Task D", "due": "2025-10-29T10:00:00Z", "status": "in-progress"},  # overdue
        {"title": "Task B", "due": "2025-11-02T10:00:00Z", "status": "to-do"},        # future
        {"title": "Task C", "due": "2025-11-01T10:00:00Z", "status": "to-do"},        # today
    ]
    overdue = [t for t in tasks if is_overdue(t["due"], now, t["status"])]
    assert len(overdue) == 2

def test_change_due_date_to_future_removes_overdue_scrum_135_5():
    now = dt.datetime(2025, 11, 1, 12, 0, tzinfo=UTC)
    was_overdue = is_overdue("2025-10-30T10:00:00Z", now, "to-do")
    assert was_overdue is True
    # Change to 1/11/2025 (future vs 2025-11-01 12:00? No — that's same-day. Use 2025-11-02 per intent.)
    now2 = dt.datetime(2025, 11, 1, 12, 0, tzinfo=UTC)
    now_future_due = "2025-11-02T00:00:00Z"
    assert is_overdue(now_future_due, now2, "to-do") is False

def test_completed_task_is_not_overdue_scrum_135_6():
    now = dt.datetime(2025, 11, 1, 12, 0, tzinfo=UTC)
    due = "2025-10-30T09:00:00Z"  # past
    assert is_overdue(due, now, "completed") is False

def test_midnight_boundary_scrum_135_7():
    # Boundary date: 27/9/2025
    # At 2025-09-27T00:00:00Z a task due 2025-09-27 is NOT overdue yet
    # but a task due 2025-09-26 IS overdue
    now = dt.datetime(2025, 9, 27, 0, 0, 0, tzinfo=UTC)  # Fixed: removed leading zeros
    due_same_day = "2025-09-27T09:00:00Z"
    due_prev_day = "2025-09-26T09:00:00Z"
    assert is_overdue(due_same_day, now, "to-do") is False
    assert is_overdue(due_prev_day, now, "in-progress") is True
