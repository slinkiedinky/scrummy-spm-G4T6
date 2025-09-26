# back-end/app.py
from flask import Flask, jsonify, request
from flask_cors import CORS
from firebase import db
import datetime as dt
from flask_cors import CORS
from firebase import db  # from back-end/firebase.py
import datetime as dt
from projects import projects_bp

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

def _ts_to_iso(ts):
    # Handles Firestore Timestamp or str
    try:
        return ts.isoformat() if hasattr(ts, "isoformat") else str(ts)
    except Exception:
        return str(ts)

@app.get("/api/projects")
def list_projects():
    docs = db.collection("projects").stream()
    items = []
    for d in docs:
        data = d.to_dict() or {}
        # Normalize dates that are Timestamp, dict({seconds}), or string
        for k in ("dueDate", "createdAt", "updatedAt"):
            v = data.get(k)
            if v is None:
                continue
            # Firestore Timestamp object
            if hasattr(v, "to_datetime"):
                data[k] = v.to_datetime().isoformat()
            # {seconds, nanoseconds}
            elif isinstance(v, dict) and "seconds" in v:
                import datetime as _dt
                data[k] = _dt.datetime.utcfromtimestamp(v["seconds"]).isoformat()
            else:
                data[k] = _ts_to_iso(v)

        # Provide sane defaults for UI
        data.setdefault("progress", 0)
        data.setdefault("status", "active")
        data.setdefault("priority", "medium")
        data.setdefault("team", [])              # array of {id,name,avatar}
        data.setdefault("overduePercentage", 0)  # optional

        items.append({"id": d.id, **data})
    # Sort newest updated first if available
    items.sort(key=lambda x: x.get("updatedAt", ""), reverse=True)
    return jsonify(items)


def _to_iso(v):
    try:
        if hasattr(v, "to_datetime"):
            return v.to_datetime().isoformat()
        if isinstance(v, dict) and "seconds" in v:
            return dt.datetime.utcfromtimestamp(v["seconds"]).isoformat()
        return str(v)
    except Exception:
        return str(v)

def _canon_status(s: str) -> str:
    t = (s or "active").strip().lower().replace("_", "-")
    return "on-hold" if t in {"on hold", "onhold"} else t

def _canon_priority(p: str) -> str:
    q = (p or "medium").strip().lower()
    return q if q in {"low", "medium", "high"} else "medium"

def _read_users(ids):
    """Return {userId: {name, role, email, avatar}} for a list of IDs."""
    out = {}
    for uid in ids:
        try:
            d = db.collection("users").document(uid).get()
            if d.exists:
                u = d.to_dict() or {}
                out[uid] = {
                    "name": u.get("name") or f"User {uid[:4]}",
                    "role": u.get("role") or "Member",
                    "email": u.get("email") or "",
                    "avatar": u.get("avatar") or "",
                }
            else:
                out[uid] = {"name": f"User {uid[:4]}", "role": "Member", "email": "", "avatar": ""}
        except Exception:
            out[uid] = {"name": f"User {uid[:4]}", "role": "Member", "email": "", "avatar": ""}
    return out

def _normalize_project(doc):
    data = doc.to_dict() or {}
    for k in ("dueDate", "createdAt", "updatedAt"):
        if k in data and data[k] is not None:
            data[k] = _to_iso(data[k])
    data["status"] = _canon_status(data.get("status"))
    data["priority"] = _canon_priority(data.get("priority"))
    data.setdefault("teamIds", [])
    data.setdefault("department", [])
    data.setdefault("progress", 0)
    data.setdefault("overduePercentage", 0)
    return {"id": doc.id, **data}

def _normalize_task(doc, team_lookup):
    t = doc.to_dict() or {}
    for k in ("dueDate", "createdAt", "updatedAt"):
        if k in t and t[k] is not None:
            t[k] = _to_iso(t[k])
    # Canonicalize
    status = (t.get("status") or "todo").strip().lower().replace(" ", "-")
    priority = (t.get("priority") or "medium").strip().lower()
    assignee_id = t.get("assigneeId") or t.get("assignee") or ""
    # Build an assignee object for the modal
    assignee_obj = {
        "id": assignee_id,
        "name": team_lookup.get(assignee_id, f"User {assignee_id[:4] or '—'}"),
        "role": "Member",
        "avatar": "",
    }
    return {
        "id": doc.id,
        "title": t.get("title") or t.get("name") or "Untitled task",
        "description": t.get("description") or "",
        "status": status,
        "priority": priority,
        "dueDate": t.get("dueDate") or "",
        "createdAt": t.get("createdAt") or "",
        "updatedAt": t.get("updatedAt") or "",
        "tags": t.get("tags") or [],
        # make both available: string id for filters & object for modal
        "assignee": assignee_obj,
        "assigneeId": assignee_id,
        "comments": [],      # you can fill these later
        "attachments": [],   # you can fill these later
    }

@app.get("/api/projects/<project_id>")
def get_project(project_id):
    ref = db.collection("projects").document(project_id).get()
    if not ref.exists:
        return jsonify({"error": "not found"}), 404
    project = _normalize_project(ref)
    return jsonify(project)

@app.get("/api/projects/<project_id>/tasks")
def get_project_tasks(project_id):
    # Optional: build a simple name lookup from users collection if you have it.
    team_lookup = {}
    proj_ref = db.collection("projects").document(project_id).get()
    if proj_ref.exists:
        data = proj_ref.to_dict() or {}
        for tid in data.get("teamIds", []):
            team_lookup[tid] = f"User {tid[:4]}"  # replace with real names if you have a users collection

    tasks_snap = db.collection("projects").document(project_id).collection("tasks").order_by("createdAt").stream()
    tasks = [_normalize_task(d, team_lookup) for d in tasks_snap]
    return jsonify(tasks)

@app.get("/api/users")
def get_users():
    ids = request.args.get("ids", "")
    id_list = [x for x in ids.split(",") if x]
    out = []
    for uid in id_list:
        doc = db.collection("users").document(uid).get()
        if doc.exists:
            d = doc.to_dict() or {}
            out.append({
                "id": uid,
                "name": d.get("name") or f"User {uid[:4]}",
                "role": d.get("role") or "Member",
                "email": d.get("email") or "",
                "avatar": d.get("avatar") or "",
            })
        else:
            out.append({"id": uid, "name": f"User {uid[:4]}", "role": "Member", "email": "", "avatar": ""})
    return jsonify(out)


CORS(app, resources={r"/api/*": {"origins": "*"}})
app.register_blueprint(users_bp, url_prefix="/api/users")
app.register_blueprint(projects_bp, url_prefix="/api/projects")

# Running app
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
