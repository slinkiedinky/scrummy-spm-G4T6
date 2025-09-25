# back-end/projects.py
from flask import Blueprint, request, jsonify, current_app
from firebase_admin import firestore
from datetime import datetime, timezone

db = firestore.client()
projects_bp = Blueprint("projects", __name__)

ALLOWED_STATUSES = {"to-do", "in progress", "completed", "blocked"}
ALLOWED_PRIORITIES = {"low", "medium", "high"}

def now_utc():
    return datetime.now(timezone.utc)

def canon_status(s: str | None) -> str:
    if not s: return "to-do"
    v = s.strip().lower()
    # map legacy values
    if v == "doing": v = "in progress"
    if v == "done": v = "completed"
    # enforce allowed
    return v if v in ALLOWED_STATUSES else "to-do"

def canon_priority(p: str | None) -> str:
    if not p: return "medium"
    v = p.strip().lower()
    return v if v in ALLOWED_PRIORITIES else "medium"

def ensure_list(x):
    return x if isinstance(x, list) else []

def normalize_project_out(doc):
    d = {**doc}
    # Firestore timestamps serialize fine via jsonify; leave as-is
    d.setdefault("name", "")
    d.setdefault("description", "")
    d["status"] = canon_status(d.get("status"))
    d["priority"] = canon_priority(d.get("priority"))
    d["teamIds"] = ensure_list(d.get("teamIds"))
    d["tags"] = ensure_list(d.get("tags"))
    return d

def normalize_task_out(doc):
    d = {**doc}
    d.setdefault("title", "")
    d.setdefault("description", "")
    d["status"] = canon_status(d.get("status"))
    d["priority"] = canon_priority(d.get("priority"))
    d["collaboratorsIds"] = ensure_list(d.get("collaboratorsIds"))
    d["tags"] = ensure_list(d.get("tags"))
    return d

# -------- Projects --------

@projects_bp.route("/", methods=["GET"])
def list_projects():
    q = db.collection("projects")
    # optional filters ?status=&priority=
    status = request.args.get("status"); priority = request.args.get("priority")
    if status: q = q.where("status", "==", canon_status(status))
    if priority: q = q.where("priority", "==", canon_priority(priority))
    docs = q.stream()
    items = [normalize_project_out({**d.to_dict(), "id": d.id}) for d in docs]
    return jsonify(items), 200

@projects_bp.route("/", methods=["POST"])
def create_project():
    data = request.json or {}
    now = now_utc()
    doc = {
        "name": data.get("name", ""),
        "description": data.get("description", ""),
        "priority": canon_priority(data.get("priority")),
        "status": canon_status(data.get("status")),
        "teamIds": ensure_list(data.get("teamIds")),
        "dueDate": data.get("dueDate"),
        "tags": ensure_list(data.get("tags")),
        "createdAt": now,
        "updatedAt": now,
    }
    ref = db.collection("projects").add(doc)
    return jsonify({"id": ref[1].id, "message": "Project created"}), 201

@projects_bp.route("/<project_id>", methods=["GET"])
def get_project(project_id):
    doc = db.collection("projects").document(project_id).get()
    if not doc.exists:
        return jsonify({"error": "Not found"}), 404
    return jsonify(normalize_project_out({**doc.to_dict(), "id": doc.id})), 200

@projects_bp.route("/<project_id>", methods=["PUT"])
def update_project(project_id):
    patch = request.json or {}
    if "status" in patch: patch["status"] = canon_status(patch["status"])
    if "priority" in patch: patch["priority"] = canon_priority(patch["priority"])
    if "teamIds" in patch: patch["teamIds"] = ensure_list(patch["teamIds"])
    if "tags" in patch: patch["tags"] = ensure_list(patch["tags"])
    patch["updatedAt"] = now_utc()
    db.collection("projects").document(project_id).update(patch)
    return jsonify({"message": "Project updated"}), 200

@projects_bp.route("/<project_id>", methods=["DELETE"])
def delete_project(project_id):
    db.collection("projects").document(project_id).delete()
    return jsonify({"message": "Project deleted"}), 200

# -------- Tasks (under a project) --------

@projects_bp.route("/<project_id>/tasks", methods=["GET"])
def list_tasks(project_id):
    docs = db.collection("projects").document(project_id).collection("tasks").stream()
    items = [normalize_task_out({**d.to_dict(), "id": d.id}) for d in docs]
    return jsonify(items), 200

@projects_bp.route("/<project_id>/tasks", methods=["POST"])
def create_task(project_id):
    data = request.json or {}
    now = now_utc()
    doc = {
        "ownerId": data.get("ownerId"),
        "collaboratorsIds": ensure_list(data.get("collaboratorsIds")),
        "createdAt": now,
        "description": data.get("description", ""),
        "dueDate": data.get("dueDate"),
        "priority": canon_priority(data.get("priority")),
        "status": canon_status(data.get("status")),
        "title": data.get("title", "Untitled task"),
        "updatedAt": now,
        "tags": ensure_list(data.get("tags")),
    }
    ref = db.collection("projects").document(project_id).collection("tasks").add(doc)
    return jsonify({"id": ref[1].id, "message": "Task created"}), 201

@projects_bp.route("/<project_id>/tasks/<task_id>", methods=["PUT"])
def update_task(project_id, task_id):
    patch = request.json or {}
    if "status" in patch: patch["status"] = canon_status(patch["status"])
    if "priority" in patch: patch["priority"] = canon_priority(patch["priority"])
    if "collaboratorsIds" in patch: patch["collaboratorsIds"] = ensure_list(patch["collaboratorsIds"])
    if "tags" in patch: patch["tags"] = ensure_list(patch["tags"])
    patch["updatedAt"] = now_utc()
    db.collection("projects").document(project_id).collection("tasks").document(task_id).update(patch)
    return jsonify({"message": "Task updated"}), 200

@projects_bp.route("/<project_id>/tasks/<task_id>", methods=["DELETE"])
def delete_task(project_id, task_id):
    db.collection("projects").document(project_id).collection("tasks").document(task_id).delete()
    return jsonify({"message": "Task deleted"}), 200
