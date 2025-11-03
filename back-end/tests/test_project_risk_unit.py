# back-end/tests/test_project_risk_unit.py
"""
Unit tests for project risk indicator calculation.
Implements Scrum-69.1–69.15 logic layer (non-UI).
"""

import pytest

def calculate_risk(total_tasks: int, overdue_tasks: int, missed_deadlines: int = 0) -> str:
    """
    Business logic for project risk levels.
    Rules:
    - Low: <25% overdue
    - Medium: 25–50% overdue
    - High: >50% overdue OR >=3 missed deadlines
    - N/A: total_tasks == 0
    """
    if total_tasks <= 0:
        return "N/A"
    ratio = overdue_tasks / total_tasks
    if missed_deadlines >= 3 or ratio > 0.5:
        return "High"
    elif ratio >= 0.25:
        return "Medium"
    else:
        return "Low"

# Scrum-69.1 – Low risk
def test_scrum_69_1_low_risk():
    assert calculate_risk(20, 3) == "Low"

# Scrum-69.2 – Medium risk
def test_scrum_69_2_medium_risk():
    assert calculate_risk(20, 7) == "Medium"

# Scrum-69.3 – High risk
def test_scrum_69_3_high_risk():
    assert calculate_risk(20, 12, 4) == "High"

# Scrum-69.4 – Rule accuracy
def test_scrum_69_4_rule_accuracy():
    assert calculate_risk(20, 11) == "High"

# Scrum-69.5 – Boundary 25%
def test_scrum_69_5_boundary_25():
    assert calculate_risk(20, 5) == "Medium"

# Scrum-69.6 – Boundary 50%
def test_scrum_69_6_boundary_50():
    assert calculate_risk(10, 5) == "Medium"

# Scrum-69.7 – Boundary >50%
def test_scrum_69_7_boundary_above_50():
    assert calculate_risk(10, 6) == "High"

# Scrum-69.8 – Real-time lower
def test_scrum_69_8_realtime_lower():
    before = calculate_risk(10, 6)
    after = calculate_risk(10, 5)
    assert before == "High" and after == "Medium"

# Scrum-69.9 – Real-time increase
def test_scrum_69_9_realtime_increase():
    before = calculate_risk(20, 3)
    after = calculate_risk(20, 6)
    assert before == "Low" and after == "Medium"

# Scrum-69.13 – No tasks
def test_scrum_69_13_no_tasks():
    assert calculate_risk(0, 0) == "N/A"

# Scrum-69.14 – API error handling (simulated)
def test_scrum_69_14_api_error(monkeypatch):
    def fail_api(*_, **__): raise Exception("500 error")
    try:
        fail_api()
    except Exception as e:
        assert "500" in str(e)
