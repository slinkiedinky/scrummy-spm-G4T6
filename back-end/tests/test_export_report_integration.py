import io
import zipfile
import re
import datetime
import pytest
from unittest.mock import MagicMock
from pytest import fixture

# Helper that mimics the snapshot used elsewhere in tests
def _snapshot(pid, data):
    snap = MagicMock()
    snap.id = pid
    snap.exists = True
    snap.to_dict.return_value = data.copy()
    return snap

# Common mock setup for a project with tasks/members/tags
def _setup_project_mock(mock_firestore, project_id="proj1", title="Project One", tasks=None, members=None, tags=None):
    proj = {"id": project_id, "name": title, "status": "in-progress", "progress": 50, "ownerId": "user123", "teamIds": ["user123"]}
    tasks = tasks or []
    members = members or []
    tags = tags or []

    mock_projects_collection = MagicMock()
    mock_doc_ref = MagicMock()
    mock_doc_ref.get.return_value = _snapshot(project_id, proj.copy())

    mock_tasks_collection = MagicMock()
    mock_tasks_collection.where.return_value = mock_tasks_collection
    mock_tasks_collection.stream.return_value = [_snapshot(t.get("id", f"t{i}"), t) for i, t in enumerate(tasks, start=1)]
    mock_tasks_collection.document.return_value = MagicMock()

    # If export logic looks up members/tags as subcollections, provide them too
    def collection_side(name):
        if name == "tasks":
            return mock_tasks_collection
        if name == "members":
            mc = MagicMock()
            mc.stream.return_value = [_snapshot(m, {"id": m}) for m in members]
            mc.where.return_value = mc
            return mc
        if name == "tags":
            tc = MagicMock()
            tc.stream.return_value = [_snapshot(t, {"id": t}) for t in tags]
            tc.where.return_value = tc
            return tc
        return MagicMock()

    mock_doc_ref.collection.side_effect = collection_side

    mock_projects_collection.document.return_value = mock_doc_ref
    mock_projects_collection.where.return_value = mock_projects_collection
    mock_firestore.collection.return_value = mock_projects_collection

    return proj

# If the real endpoint is not present or returns non-200, tests will be skipped rather than failing.
def _call_export_endpoint(client, fmt="pdf", project_id="proj1"):
    resp = client.get("/api/reports/export", query_string={"format": fmt, "projectId": project_id})
    return resp


# 48.1.1: integration - exported PDF contains report sections / markers
def test_integration_pdf_contains_sections(client, mock_firestore):
    _setup_project_mock(mock_firestore,
                        project_id="proj_export_1",
                        title="Export Project",
                        tasks=[{"id": "t1", "status": "in-progress", "progress": 50}],
                        members=["alice"],
                        tags=["urgent"])
    resp = _call_export_endpoint(client, fmt="pdf", project_id="proj_export_1")
    assert resp.status_code == 200, f"Export endpoint unavailable or returned {resp.status_code}: {resp.data[:200]}"
    data = resp.data
    assert data.startswith(b"%PDF"), "expected PDF header from real export"
    # tolerant checks for title/timestamp or section markers embedded by server
    assert b"Report" in data or b"Title" in data or b"Summary" in data

# 48.1.2: integration - exported XLSX contains tables/parts that mirror on-screen data
def test_integration_xlsx_contains_tables_and_parts(client, mock_firestore):
    _setup_project_mock(mock_firestore,
                        project_id="proj_export_2",
                        title="Export Project 2",
                        tasks=[{"id": "t1", "status": "to-do", "progress": 0}, {"id": "t2", "status": "in-progress", "progress": 30}],
                        members=["alice", "bob"],
                        tags=["backend"])
    resp = _call_export_endpoint(client, fmt="xlsx", project_id="proj_export_2")
    assert resp.status_code == 200, f"Export endpoint unavailable or returned {resp.status_code}: {resp.data[:200]}"
    data = resp.data
    # verify it's an openable zip and has core xlsx parts
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        names = z.namelist()
        assert "xl/workbook.xml" in names or any(n.startswith("xl/") for n in names)
        # optional: verify presence of worksheets and any table/chart parts
        assert any("worksheets" in n for n in names), "expected worksheet parts in XLSX"

# 48.2.1: integration - exported PDF includes generation timestamp and report title
def test_integration_pdf_includes_title_and_timestamp(client, mock_firestore):
    title = "Sprint Report Integration"
    _setup_project_mock(mock_firestore,
                        project_id="proj_export_3",
                        title=title,
                        tasks=[{"id": "t1", "status": "to-do", "progress": 0}])
    resp = _call_export_endpoint(client, fmt="pdf", project_id="proj_export_3")
    assert resp.status_code == 200, f"Export endpoint unavailable or returned {resp.status_code}: {resp.data[:200]}"
    data = resp.data
    assert title.encode() in data or b"Title" in data, "server PDF should include report title"
    # timestamp pattern check (ISO-ish)
    ts_pattern = re.compile(rb"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z")
    assert ts_pattern.search(data), "export PDF should contain an ISO-like timestamp"

# 48.2.2: integration - exported XLSX includes generation timestamp and title
def test_integration_xlsx_includes_title_and_timestamp(client, mock_firestore):
    title = "Sprint Report Integration XLSX"
    _setup_project_mock(mock_firestore,
                        project_id="proj_export_4",
                        title=title,
                        tasks=[{"id": "t1", "status": "in-progress", "progress": 20}])
    resp = _call_export_endpoint(client, fmt="xlsx", project_id="proj_export_4")
    assert resp.status_code == 200, f"Export endpoint unavailable or returned {resp.status_code}: {resp.data[:200]}"
    data = resp.data
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        names = z.namelist()
        # try to read workbook and worksheet for title/timestamp; be tolerant of variations
        if "xl/workbook.xml" in names:
            wb = z.read("xl/workbook.xml").decode(errors="ignore")
            assert title in wb or "<title" in wb
        if "xl/worksheets/sheet1.xml" in names:
            sheet = z.read("xl/worksheets/sheet1.xml").decode(errors="ignore")
            assert "Timestamp" in sheet or re.search(r"\d{4}-\d{2}-\d{2}T", sheet)


# 48.3.1: integration - PDF download is a valid PDF
def test_integration_pdf_download_valid(client, mock_firestore):
    _setup_project_mock(mock_firestore, project_id="proj_export_5", title="DL Test", tasks=[])
    resp = _call_export_endpoint(client, fmt="pdf", project_id="proj_export_5")
    assert resp.status_code == 200, f"Export endpoint unavailable or returned {resp.status_code}: {resp.data[:200]}"
    data = resp.data
    assert data.startswith(b"%PDF"), "real export should produce a PDF stream"
    assert data.strip().endswith(b"%%EOF") or b"%%EOF" in data, "PDF should contain EOF marker"

# 48.3.2: integration - XLSX download is a valid
def test_integration_xlsx_download_valid(client, mock_firestore):
    _setup_project_mock(mock_firestore, project_id="proj_export_6", title="DL XLSX", tasks=[])
    resp = _call_export_endpoint(client, fmt="xlsx", project_id="proj_export_6")
    assert resp.status_code == 200, f"Export endpoint unavailable or returned {resp.status_code}: {resp.data[:200]}"
    data = resp.data
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        assert "xl/workbook.xml" in z.namelist()

# 48.3.3: integration - large report export (many rows) remains openable
def test_integration_large_xlsx_openable(client, mock_firestore):
    # create many fake tasks to simulate large export
    many_tasks = [{"id": f"t{i}", "status": "to-do", "progress": 0} for i in range(2000)]
    _setup_project_mock(mock_firestore, project_id="proj_export_7", title="Large Export", tasks=many_tasks)
    resp = _call_export_endpoint(client, fmt="xlsx", project_id="proj_export_7")
    assert resp.status_code == 200, f"Export endpoint unavailable or returned {resp.status_code}: {resp.data[:200]}"
    data = resp.data
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        assert any("worksheets" in n for n in z.namelist())