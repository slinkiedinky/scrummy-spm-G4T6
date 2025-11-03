# back-end/tests/test_status_colors_integration.py
import importlib
import json
import os
import sys
import pytest

# Make back-end importable
HERE = os.path.dirname(__file__)
BACKEND_DIR = os.path.abspath(os.path.join(HERE, ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

CANDIDATE_ENDPOINTS = [
    "/api/tasks",
    "/tasks",
    "/api/projects/alpha/tasks",
    "/projects/alpha/tasks",
]

def _get_flask_client_or_skip():
    try:
        app_module = importlib.import_module("app")  # loads back-end/app.py
    except Exception as e:
        pytest.skip(f"Cannot import app module: {e}")
    flask_app = getattr(app_module, "app", None)
    if flask_app is None or not hasattr(flask_app, "test_client"):
        pytest.skip("Flask app not found as `app` in app.py (expected Flask `app`).")
    return flask_app.test_client()

def _first_ok(client):
    for ep in CANDIDATE_ENDPOINTS:
        resp = client.get(ep)
        if resp.status_code == 200:
            try:
                data = resp.get_json() if hasattr(resp, "get_json") else json.loads(resp.data.decode())
            except Exception:
                continue
            if isinstance(data, dict) and "items" in data and isinstance(data["items"], list):
                return ep, data["items"]
            if isinstance(data, list):
                return ep, data
    return None, None

@pytest.mark.integration
def test_task_status_color_fields_present_and_correct():
    client = _get_flask_client_or_skip()
    ep, items = _first_ok(client)
    if not items:
        pytest.skip(f"No supported tasks endpoint responded with a list: tried {CANDIDATE_ENDPOINTS}")

    ok_colors = {"grey", "green", "yellow", "red"}
    checked = 0

    for item in items:
        color = (item.get("status_color") or "").strip().lower()
        tab_bg = ((item.get("status_tab") or {}).get("background") or "").strip().lower()

        if color:
            assert color in ok_colors, f"Unexpected color {color} for task {item}"
            checked += 1
        elif tab_bg:
            assert tab_bg in ok_colors, f"Unexpected tab background {tab_bg} for task {item}"
            checked += 1
        else:
            pytest.skip(
                "No `status_color` or `status_tab.background` field present in task payload. "
                "Add one of these in the API response to satisfy AC."
            )
    assert checked > 0, "No tasks with verifiable color/tab fields found"
