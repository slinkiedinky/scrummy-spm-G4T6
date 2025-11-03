# back-end/tests/test_dashboard_sorting_unit.py
"""
Unit tests for project dashboard sorting.
Implements Scrum-60.1 to Scrum-60.12 logic layer (no UI assertions).
"""

import pytest
from datetime import date

def sort_projects(projects, key: str, order: str = "asc"):
    """
    Generic sorting logic.
    key: 'progress' or 'deadline'
    order: 'asc' or 'desc'
    Rules:
    - Null/NaN progress or deadline appear last
    - Stable sort (preserve relative order for ties)
    """
    reverse = order == "desc"
    def safe_key(p):
        val = p.get(key)
        if val is None:
            return float("inf") if not reverse else float("-inf")
        return val
    return sorted(projects, key=safe_key, reverse=reverse)

@pytest.fixture
def dataset_basic():
    return [
        {"name": "Project A", "progress": 25, "deadline": date(2024, 9, 9), "status": "Todo"},
        {"name": "Project B", "progress": 50, "deadline": date(2024, 9, 10), "status": "In progress"},
        {"name": "Project C", "progress": 75, "deadline": date(2024, 9, 11), "status": "Todo"},
    ]

@pytest.fixture
def dataset_complex():
    return [
        {"name": "Project D", "progress": 60, "deadline": date(2024, 9, 15), "status": "In progress"},
        {"name": "Project E", "progress": 60, "deadline": date(2024, 9, 15), "status": "In progress"},
        {"name": "Project F", "progress": 90, "deadline": date(2024, 9, 20), "status": "Completed"},
    ]

# Scrum-60.1 — Sort by completion % ascending
def test_scrum_60_1_progress_ascending(dataset_basic):
    sorted_data = sort_projects(dataset_basic, "progress", "asc")
    progresses = [p["progress"] for p in sorted_data]
    assert progresses == sorted(progresses)

# Scrum-60.2 — Sort by completion % descending
def test_scrum_60_2_progress_descending(dataset_basic):
    sorted_data = sort_projects(dataset_basic, "progress", "desc")
    progresses = [p["progress"] for p in sorted_data]
    assert progresses == sorted(progresses, reverse=True)

# Scrum-60.3 — Sort by deadline ascending
def test_scrum_60_3_deadline_ascending(dataset_basic):
    sorted_data = sort_projects(dataset_basic, "deadline", "asc")
    deadlines = [p["deadline"] for p in sorted_data]
    assert deadlines == sorted(deadlines)

# Scrum-60.4 — Sort by deadline descending
def test_scrum_60_4_deadline_descending(dataset_basic):
    sorted_data = sort_projects(dataset_basic, "deadline", "desc")
    deadlines = [p["deadline"] for p in sorted_data]
    assert deadlines == sorted(deadlines, reverse=True)

# Scrum-60.7 — Multiple sorts
def test_scrum_60_7_multiple_sorts(dataset_basic):
    first = sort_projects(dataset_basic, "progress", "asc")
    second = sort_projects(first, "deadline", "desc")
    assert second[0]["deadline"] >= second[-1]["deadline"]

# Scrum-60.8 — Negative: Empty dataset
def test_scrum_60_8_empty_dataset():
    assert sort_projects([], "progress", "asc") == []

# Scrum-60.9 — Negative: Null/NaN progress handled
def test_scrum_60_9_null_progress_handled():
    data = [
        {"name": "Project A", "progress": None},
        {"name": "Project B", "progress": 50},
        {"name": "Project C", "progress": 75},
    ]
    sorted_data = sort_projects(data, "progress", "asc")
    assert sorted_data[-1]["name"] == "Project A"  # null goes last

# Scrum-60.10 — Boundary: identical completion %
def test_scrum_60_10_identical_progress_stable_order(dataset_complex):
    sorted_data = sort_projects(dataset_complex, "progress", "asc")
    assert sorted_data[0]["name"] == "Project D"
    assert sorted_data[1]["name"] == "Project E"

# Scrum-60.11 — Boundary: identical deadlines
def test_scrum_60_11_identical_deadlines_stable_order(dataset_complex):
    sorted_data = sort_projects(dataset_complex, "deadline", "asc")
    assert [p["name"] for p in sorted_data][:2] == ["Project D", "Project E"]

# Scrum-60.12 — Edge: sort within filtered subset
def test_scrum_60_12_sort_with_filter(dataset_complex):
    filtered = [p for p in dataset_complex if p["status"] == "In progress"]
    sorted_filtered = sort_projects(filtered, "deadline", "asc")
    assert all(p["status"] == "In progress" for p in sorted_filtered)
    assert sorted_filtered[0]["deadline"] <= sorted_filtered[-1]["deadline"]
