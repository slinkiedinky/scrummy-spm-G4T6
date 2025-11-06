import datetime
import pytest
from unittest.mock import MagicMock

# Helper snapshot used by tests
def _snapshot(doc_id, data):
    snap = MagicMock()
    snap.id = doc_id
    snap.exists = True
    snap.to_dict.return_value = data.copy()
    return snap

def _setup_project_and_tasks(mock_firestore, project_id="proj1", project_data=None, tasks=None):
    project_data = project_data or {"id": project_id, "name": "P1", "department": "D1", "ownerId": "mgr1"}
    proj_snap = _snapshot(project_id, project_data)

    mock_projects_coll = MagicMock()
    mock_doc_ref = MagicMock()
    mock_doc_ref.get.return_value = proj_snap
    mock_projects_coll.document.return_value = mock_doc_ref

    # tasks under project
    tasks = tasks or []
    task_snaps = [_snapshot(t.get("id", f"t{i}"), t) for i, t in enumerate(tasks, start=1)]
    mock_tasks_coll = MagicMock()
    mock_tasks_coll.stream.return_value = task_snaps
    mock_tasks_coll.where.return_value = mock_tasks_coll
    mock_doc_ref.collection.return_value = mock_tasks_coll

    def collection_side(name):
        if name == "projects":
            return mock_projects_coll
        if name == "tasks":
            return mock_tasks_coll
        return MagicMock()
    mock_firestore.collection.side_effect = collection_side

    return project_data, tasks

# 19.1.1 Positive: project included 
def test_project_included_positive(monkeypatch, mock_firestore):
    import projects
    project_id = "proj_A1"
    project_data = {"id": project_id, "name": "Proj A1", "department": "D1", "ownerId": "mgr1"}
    _setup_project_and_tasks(mock_firestore, project_id=project_id, project_data=project_data, tasks=[])
    monkeypatch.setattr(projects, "db", mock_firestore)
    # manager is ignored by tests / feature — report should be returned regardless of department
    report = projects.generate_project_report(project_id, overdue_threshold=20)
    assert report is not None
    assert report.get("project_id") == project_id

# 19.2.1 Positive: overdue percentage calculated
def test_overdue_percentage_calculated_positive(monkeypatch, mock_firestore):
    import projects
    project_id = "proj_pct_pos"
    today = datetime.date.today()
    tasks = []
    # 6 not overdue, 4 overdue => 40%
    for i in range(6):
        tasks.append({"id": f"t{i}", "due_date": (today + datetime.timedelta(days=3)).isoformat(), "assigned_to": "u1"})
    for i in range(6, 10):
        tasks.append({"id": f"t{i}", "due_date": (today - datetime.timedelta(days=5)).isoformat(), "assigned_to": "u2"})
    _setup_project_and_tasks(mock_firestore, project_id=project_id, project_data={"id": project_id, "department": "D1"}, tasks=tasks)
    monkeypatch.setattr(projects, "db", mock_firestore)
    report = projects.generate_project_report(project_id, overdue_threshold=20)
    assert pytest.approx(report["overdue_pct"], rel=1e-3) == (4 / 10) * 100

# 19.2.2 Negative: no tasks, handled by showing overdue pct 0
def test_overdue_percentage_no_tasks_negative(monkeypatch, mock_firestore):
    import projects
    project_id = "proj_pct_neg"
    _setup_project_and_tasks(mock_firestore, project_id=project_id, project_data={"id": project_id, "department": "D1"}, tasks=[])
    monkeypatch.setattr(projects, "db", mock_firestore)
    report = projects.generate_project_report(project_id, overdue_threshold=20)
    assert report["overdue_pct"] == 0

# 19.2.3 Positive: median days overdue computed
def test_median_days_overdue_positive(monkeypatch, mock_firestore):
    import projects
    project_id = "proj_med_pos"
    today = datetime.date.today()
    overdue_days = [1, 2, 3, 10, 20]  # median = 3
    tasks = []
    for i, d in enumerate(overdue_days):
        due = (today - datetime.timedelta(days=d)).isoformat()
        tasks.append({"id": f"t{i}", "due_date": due, "assigned_to": "u1"})
    _setup_project_and_tasks(mock_firestore, project_id=project_id, project_data={"id": project_id, "department": "D1"}, tasks=tasks)
    monkeypatch.setattr(projects, "db", mock_firestore)
    report = projects.generate_project_report(project_id, overdue_threshold=20)
    assert report["median_overdue_days"] == 3

# 19.2.4 Negative: median when no overdue tasks
def test_median_days_overdue_no_overdue_negative(monkeypatch, mock_firestore):
    import projects
    project_id = "proj_med_neg"
    today = datetime.date.today()
    tasks = [{"id": "t1", "due_date": (today + datetime.timedelta(days=5)).isoformat(), "assigned_to": "u1"}]
    _setup_project_and_tasks(mock_firestore, project_id=project_id, project_data={"id": project_id, "department": "D1"}, tasks=tasks)
    monkeypatch.setattr(projects, "db", mock_firestore)
    report = projects.generate_project_report(project_id, overdue_threshold=20)
    assert report["median_overdue_days"] is None

# 19.2.5 Positive: workload counts per employee
def test_project_workload_counts_positive(monkeypatch, mock_firestore):
    import projects
    project_id = "proj_work_pos"
    today = datetime.date.today()
    tasks = [
        {"id": "t1", "due_date": today.isoformat(), "assigned_to": "alice"},
        {"id": "t2", "due_date": today.isoformat(), "assigned_to": "bob"},
        {"id": "t3", "due_date": today.isoformat(), "assigned_to": "alice"},
    ]
    _setup_project_and_tasks(mock_firestore, project_id=project_id, project_data={"id": project_id, "department": "D1"}, tasks=tasks)
    monkeypatch.setattr(projects, "db", mock_firestore)
    report = projects.generate_project_report(project_id, overdue_threshold=20)
    assert report["workload"] == {"alice": 2, "bob": 1}

# 19.2.6 Negative: workload with no tasks
def test_project_workload_no_tasks(monkeypatch, mock_firestore):
    import projects
    project_id = "proj_work_neg"
    today = datetime.date.today()
    tasks = [{"id": "t1", "due_date": today.isoformat()}]  # no assigned_to
    _setup_project_and_tasks(mock_firestore, project_id=project_id, project_data={"id": project_id, "department": "D1"}, tasks=tasks)
    monkeypatch.setattr(projects, "db", mock_firestore)
    report = projects.generate_project_report(project_id, overdue_threshold=20)
    assert report["workload"] == {}

# 19.2.7 Positive: deadlines grouped (overdue, today, next_7)
def test_deadlines_grouping_positive(monkeypatch, mock_firestore):
    import projects
    project_id = "proj_dead_pos"
    today = datetime.date.today()
    tasks = [
        {"id": "t_over", "due_date": (today - datetime.timedelta(days=2)).isoformat()},
        {"id": "t_today", "due_date": today.isoformat()},
        {"id": "t_next", "due_date": (today + datetime.timedelta(days=3)).isoformat()},
        {"id": "t_late", "due_date": (today + datetime.timedelta(days=10)).isoformat()},
    ]
    _setup_project_and_tasks(mock_firestore, project_id=project_id, project_data={"id": project_id, "department": "D1"}, tasks=tasks)
    monkeypatch.setattr(projects, "db", mock_firestore)
    report = projects.generate_project_report(project_id, overdue_threshold=20)
    deadlines = report["deadlines"]
    assert any(t["id"] == "t_over" for t in deadlines.get("overdue", []))
    assert any(t["id"] == "t_today" for t in deadlines.get("today", []))
    assert any(t["id"] == "t_next" for t in deadlines.get("next_7", []))
    assert all(t["id"] != "t_late" for t in deadlines.get("next_7", []))

# 19.2.8 Negative: no deadlines when no tasks
def test_deadlines_no_items_negative(monkeypatch, mock_firestore):
    import projects
    project_id = "proj_dead_neg"
    today = datetime.date.today()
    tasks = [{"id": "t_far", "due_date": (today + datetime.timedelta(days=15)).isoformat()}]
    _setup_project_and_tasks(mock_firestore, project_id=project_id, project_data={"id": project_id, "department": "D1"}, tasks=tasks)
    monkeypatch.setattr(projects, "db", mock_firestore)
    report = projects.generate_project_report(project_id, overdue_threshold=20)
    deadlines = report["deadlines"]
    assert deadlines.get("overdue") == [] and deadlines.get("today") == [] and deadlines.get("next_7") == []

# 19.3.1 Positive: at-risk when overdue pct > threshold
def test_at_risk_positive(monkeypatch, mock_firestore):
    import projects
    project_id = "proj_risk_pos"
    today = datetime.date.today()
    tasks = []
    for i in range(3):
        tasks.append({"id": f"t{i}", "due_date": (today + datetime.timedelta(days=2)).isoformat()})
    for i in range(3, 5):
        tasks.append({"id": f"t{i}", "due_date": (today - datetime.timedelta(days=3)).isoformat()})
    _setup_project_and_tasks(mock_firestore, project_id=project_id, project_data={"id": project_id, "department": "D1"}, tasks=tasks)
    monkeypatch.setattr(projects, "db", mock_firestore)
    report = projects.generate_project_report(project_id, overdue_threshold=20)
    assert report["at_risk"] is True

# 19.3.2 Negative: not at-risk when overdue pct <= threshold
def test_at_risk_negative(monkeypatch, mock_firestore):
    import projects
    project_id = "proj_risk_neg"
    today = datetime.date.today()
    tasks = []
    for i in range(9):
        tasks.append({"id": f"t{i}", "due_date": (today + datetime.timedelta(days=2)).isoformat()})
    tasks.append({"id": "tover", "due_date": (today - datetime.timedelta(days=1)).isoformat()})
    _setup_project_and_tasks(mock_firestore, project_id=project_id, project_data={"id": project_id, "department": "D1"}, tasks=tasks)
    monkeypatch.setattr(projects, "db", mock_firestore)
    report = projects.generate_project_report(project_id, overdue_threshold=20)
    assert report["at_risk"] is False