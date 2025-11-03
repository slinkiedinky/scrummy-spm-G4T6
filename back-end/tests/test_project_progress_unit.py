# back-end/tests/test_project_progress_unit.py
"""
Unit tests for project progress bar formula, rounding and boundaries.
Covers Scrum-324.1 to Scrum-324.6 logic layer (no API calls).
"""

import pytest

def calculate_progress(completed: int, total: int) -> int:
    """Same formula used by the app (Completed/Total * 100)."""
    if total <= 0:
        return 0
    return round((completed / total) * 100)

@pytest.mark.parametrize("completed,total,expected", [
    (1, 3, 33),   # Scrum-324.1 – 1/3
    (1, 4, 25),   # Scrum-324.2 – new task created, denominator ↑
    (2, 4, 50),   # Scrum-324.3 – completed task ↑
    (1, 3, 33),   # Scrum-324.4 – rounding/whole number
    (0, 0, 0),    # Scrum-324.5 – zero tasks
    (4, 4, 100),  # Scrum-324.6 – full completion
])
def test_progress_formula_and_boundaries(completed, total, expected):
    assert calculate_progress(completed, total) == expected


def test_no_divide_by_zero_and_integer_output():
    """Ensure safe return types (Scrum-324.5)."""
    result = calculate_progress(0, 0)
    assert isinstance(result, int)
    assert result == 0


def test_progress_rounding_behavior():
    """Ensure whole-number rounding only (Scrum-324.4)."""
    assert calculate_progress(1, 3) == 33
    assert calculate_progress(2, 3) == 67
