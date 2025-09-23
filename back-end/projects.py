from flask import Blueprint, request, jsonify
from firebase_admin import firestore
import datetime

db = firestore.client()
projects_bp = Blueprint("projects", __name__, url_prefix="/projects")

def _to_iso(value):
    if isinstance(value, dt.datetime):
        return value.isoformat()
    return value

def _canon_status(status):
    return status.lower() if status else "new"

def _canon_priority(priority):
    return priority.lower() if priority else "medium"

def normalize_project(doc):
    data = doc.copy()  # assume doc is a dict
    # normalize dates
    for k in ("updatedAt", "createdAt"):
        if k in data and data[k] is not None:
            data[k] = _to_iso(data[k])
    # canonicalize status and priority
    data["status"] = _canon_status(data.get("status"))
    data["priority"] = _canon_priority(data.get("priority"))
    # ensure lists exist
    data.setdefault("teamIds", [])
    data.setdefault("tags", [])
    # ensure name and description exist
    data.setdefault("name", "")
    data.setdefault("description", "")
    return data

# Create project
@projects_bp.route("/", methods=["POST"])
def create_project():
    data = request.json
    doc_ref = db.collection("projects").add(data)
    return jsonify({"id": doc_ref[1].id, "message": "Project created"}), 201

# Read all projects
@projects_bp.route("/", methods=["GET"])
def get_projects():
    docs = db.collection("projects").stream()
    projects = [normalize_project({**doc.to_dict(), "id": doc.id}) for doc in docs]
    return jsonify(projects), 200

# Read one project
@projects_bp.route("/<project_id>", methods=["GET"])
def get_project(project_id):
    doc = db.collection("projects").document(project_id).get()
    if not doc.exists:
        return jsonify({"error": "Not found"}), 404
    project = normalize_project({**doc.to_dict(), "id": doc.id})
    return jsonify(project), 200

# Update project
@projects_bp.route("/<project_id>", methods=["PUT"])
def update_project(project_id):
    data = request.json
    db.collection("projects").document(project_id).update(data)
    return jsonify({"message": "Project updated"}), 200

# Delete project
@projects_bp.route("/<project_id>", methods=["DELETE"])
def delete_project(project_id):
    db.collection("projects").document(project_id).delete()
    return jsonify({"message": "Project deleted"}), 200