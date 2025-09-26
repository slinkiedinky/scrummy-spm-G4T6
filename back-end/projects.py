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
    if isinstance(x, list):
        return x
    if x is None:
        return []
    if isinstance(x, (set, tuple)):
        return list(x)
    # treat scalar (including string) as single-item list
    return [x]

def normalize_project_out(doc):
    d = {**doc}
    # Firestore timestamps serialize fine via jsonify; leave as-is
    d.setdefault("name", "")
    d.setdefault("description", "")
    owner = d.get("ownerId") or d.get("createdBy")
    if owner:
        d["ownerId"] = owner
    d["status"] = canon_status(d.get("status"))
    d["priority"] = canon_priority(d.get("priority"))
    d["teamIds"] = ensure_list(d.get("teamIds"))
    if owner and owner not in d["teamIds"]:
        d["teamIds"].append(owner)
    # dedupe team members while preserving order
    seen = set()
    d["teamIds"] = [x for x in d["teamIds"] if not (x in seen or seen.add(x))]
    d["tags"] = ensure_list(d.get("tags"))
    return d

def normalize_task_out(doc):
    d = {**doc}
    d.setdefault("title", "")
    d.setdefault("description", "")
    d.setdefault("assigneeId", d.get("ownerId"))
    d.setdefault("ownerId", d.get("assigneeId"))
    d["status"] = canon_status(d.get("status"))
    d["priority"] = canon_priority(d.get("priority"))
    d["collaboratorsIds"] = ensure_list(d.get("collaboratorsIds"))
    d["tags"] = ensure_list(d.get("tags"))
    return d

# -------- Projects --------

@projects_bp.route("/", methods=["GET"])
def list_projects():
    base = db.collection("projects")
    status = request.args.get("status"); priority = request.args.get("priority")
    assigned_to = request.args.get("assignedTo") or request.args.get("assigneeId")

    filters = []
    if status:
        filters.append(("status", canon_status(status)))
    if priority:
        filters.append(("priority", canon_priority(priority)))

    def apply_filters(query):
        for field, value in filters:
            query = query.where(field, "==", value)
        return query

    if assigned_to:
        docs = list(apply_filters(base).where("teamIds", "array_contains", assigned_to).stream())
        seen = {d.id for d in docs}
        owner_query = apply_filters(base).where("ownerId", "==", assigned_to)
        for doc in owner_query.stream():
            if doc.id not in seen:
                docs.append(doc)
                seen.add(doc.id)
        creator_query = apply_filters(base).where("createdBy", "==", assigned_to)
        for doc in creator_query.stream():
            if doc.id not in seen:
                docs.append(doc)
    else:
        docs = apply_filters(base).stream()
    items = [normalize_project_out({**d.to_dict(), "id": d.id}) for d in docs]
    return jsonify(items), 200

@projects_bp.route("/", methods=["POST"])
def create_project():
    data = request.json or {}
    now = now_utc()
    owner = data.get("ownerId") or data.get("createdBy") or data.get("creatorId")
    team_ids = ensure_list(data.get("teamIds"))
    if owner and owner not in team_ids:
        team_ids.append(owner)
    # dedupe while preserving order
    seen = set()
    team_ids = [x for x in team_ids if not (x in seen or seen.add(x))]
    doc = {
        "name": data.get("name", ""),
        "description": data.get("description", ""),
        "priority": canon_priority(data.get("priority")),
        "status": canon_status(data.get("status")),
        "teamIds": team_ids,
        "ownerId": owner,
        "createdBy": owner,
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
    data = normalize_project_out({**doc.to_dict(), "id": doc.id})
    assigned_to = request.args.get("assignedTo") or request.args.get("assigneeId")
    if assigned_to and assigned_to not in data.get("teamIds", []):
        return jsonify({"error": "Forbidden"}), 403
    return jsonify(data), 200

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
    q = db.collection("projects").document(project_id).collection("tasks")
    assignee = request.args.get("assigneeId") or request.args.get("assignedTo")
    if assignee:
        docs = list(q.where("assigneeId", "==", assignee).stream())
        if not docs:
            docs = list(q.where("ownerId", "==", assignee).stream())
    else:
        docs = q.stream()
    items = [normalize_task_out({**d.to_dict(), "id": d.id}) for d in docs]
    return jsonify(items), 200


@projects_bp.route("/assigned/tasks", methods=["GET"])
def list_tasks_across_projects():
    assigned_to = request.args.get("assignedTo") or request.args.get("assigneeId")
    if not assigned_to:
        return jsonify({"error": "assignedTo is required"}), 400

    status_filter = request.args.get("status")
    priority_filter = request.args.get("priority")

    query = db.collection_group("tasks").where(filter=firestore.FieldFilter("assigneeId", "==", assigned_to))
    docs = list(query.stream())

    # backfill support: legacy tasks might still use ownerId
    owner_query = db.collection_group("tasks").where(filter=firestore.FieldFilter("ownerId", "==", assigned_to))
    owner_docs = owner_query.stream()

    seen = {d.reference.path for d in docs}
    for d in owner_docs:
        if d.reference.path not in seen:
            docs.append(d)
            seen.add(d.reference.path)

    items = []
    for doc in docs:
        data = normalize_task_out({**doc.to_dict(), "id": doc.id})

        if status_filter and data.get("status") != canon_status(status_filter):
            continue
        if priority_filter and data.get("priority") != canon_priority(priority_filter):
            continue

        project_ref = doc.reference.parent.parent
        if project_ref:
            data["projectId"] = project_ref.id
            project_doc = project_ref.get()
            if project_doc.exists:
                project_data = normalize_project_out({**project_doc.to_dict(), "id": project_doc.id})
                data["projectName"] = project_data.get("name")
                data["projectPriority"] = project_data.get("priority")
        items.append(data)

    return jsonify(items), 200

@projects_bp.route("/<project_id>/tasks", methods=["POST"])
def create_task(project_id):
    data = request.json or {}
    now = now_utc()
    assignee_id = data.get("assigneeId") or data.get("ownerId")
    if not assignee_id:
        return jsonify({"error": "assigneeId is required"}), 400

    project_ref = db.collection("projects").document(project_id)
    project_doc = project_ref.get()
    if not project_doc.exists:
        return jsonify({"error": "Project not found"}), 404

    team_ids = ensure_list(project_doc.to_dict().get("teamIds"))
    if assignee_id not in team_ids:
        project_ref.update({
            "teamIds": firestore.ArrayUnion([assignee_id]),
            "updatedAt": now,
        })

    doc = {
        "assigneeId": assignee_id,
        "ownerId": assignee_id,
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
    if "assigneeId" in patch:
        patch["ownerId"] = patch.get("assigneeId")
    if "ownerId" in patch and "assigneeId" not in patch:
        patch["assigneeId"] = patch.get("ownerId")
    patch["updatedAt"] = now_utc()
    db.collection("projects").document(project_id).collection("tasks").document(task_id).update(patch)
    return jsonify({"message": "Task updated"}), 200

@projects_bp.route("/<project_id>/tasks/<task_id>", methods=["DELETE"])
def delete_task(project_id, task_id):
    db.collection("projects").document(project_id).collection("tasks").document(task_id).delete()
    return jsonify({"message": "Task deleted"}), 200
