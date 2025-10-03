# back-end/projects.py
from flask import Blueprint, request, jsonify, current_app
from firebase_admin import firestore
from datetime import datetime, timezone

db = firestore.client()
projects_bp = Blueprint("projects", __name__)

ALLOWED_STATUSES = {"to-do", "in progress", "completed", "blocked"}
PROJECT_PRIORITIES = {"low", "medium", "high"}
PRIORITY_RANGE = list(range(1, 11))
LEGACY_PRIORITY_MAP = {
    "low": 3,
    "medium": 6,
    "high": 9,
    "urgent": 9,
    "critical": 10,
}
DEFAULT_TASK_PRIORITY = 5

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

def canon_project_priority(value) -> str:
    if not value:
        return "medium"
    if isinstance(value, str):
        candidate = value.strip().lower()
        if not candidate:
            return "medium"
        if candidate in PROJECT_PRIORITIES:
            return candidate
        # allow legacy numeric strings
        try:
            numeric = int(round(float(candidate)))
        except (TypeError, ValueError):
            return "medium"
        return _priority_number_to_bucket(numeric)
    if isinstance(value, (int, float)):
        return _priority_number_to_bucket(int(round(value)))
    return "medium"


def _priority_number_to_bucket(number: int) -> str:
    if number >= 8:
        return "high"
    if number <= 3:
        return "low"
    return "medium"


def canon_task_priority(p) -> int:
    if p is None:
        return DEFAULT_TASK_PRIORITY
    if isinstance(p, (int, float)):
        value = int(round(p))
    else:
        s = str(p).strip().lower()
        if not s:
            return DEFAULT_TASK_PRIORITY
        if s in LEGACY_PRIORITY_MAP:
            return LEGACY_PRIORITY_MAP[s]
        try:
            value = int(round(float(s)))
        except (TypeError, ValueError):
            return DEFAULT_TASK_PRIORITY
    if value < PRIORITY_RANGE[0]:
        return PRIORITY_RANGE[0]
    if value > PRIORITY_RANGE[-1]:
        return PRIORITY_RANGE[-1]
    return value

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
    d["priority"] = canon_project_priority(d.get("priority"))
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
    d["priority"] = canon_task_priority(d.get("priority"))
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
    if status and status.lower() != "all":
        filters.append(("status", canon_status(status)))
    if priority is not None:
        if not (isinstance(priority, str) and priority.lower() == "all"):
            filters.append(("priority", canon_project_priority(priority)))

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
        "priority": canon_project_priority(data.get("priority")),
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
    if "priority" in patch: patch["priority"] = canon_project_priority(patch["priority"])
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
    if status_filter and status_filter.lower() == "all":
        status_filter = None

    priority_filter = request.args.get("priority")
    if priority_filter and isinstance(priority_filter, str) and priority_filter.lower() == "all":
        priority_filter = None

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
        if priority_filter and data.get("priority") != canon_task_priority(priority_filter):
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

    title = (data.get("title") or "Untitled task").strip() or "Untitled task"
    description = (data.get("description") or "").strip()
    due_date = data.get("dueDate") or None

    doc = {
        "assigneeId": assignee_id,
        "ownerId": assignee_id,
        "collaboratorsIds": ensure_list(data.get("collaboratorsIds")),
        "createdAt": now,
        "description": description,
        "dueDate": due_date,
        "priority": canon_task_priority(data.get("priority")),
        "status": canon_status(data.get("status")),
        "title": title,
        "updatedAt": now,
        "tags": ensure_list(data.get("tags")),
    }
    ref = db.collection("projects").document(project_id).collection("tasks").add(doc)
    # Add notification after task creation, including project name
    try:
        from notifications import add_notification
        project_doc_data = project_doc.to_dict()
        project_name = project_doc_data.get("name", "")
        # Get assigner (creator) id from request or context
        assigner_id = data.get("createdBy") or data.get("ownerId") or data.get("assigneeId")
        assigner_name = ""
        try:
            user_doc = db.collection("users").document(assigner_id).get()
            if user_doc.exists:
                user_data = user_doc.to_dict()
                assigner_name = user_data.get("fullName") or user_data.get("displayName") or user_data.get("name") or assigner_id
            else:
                assigner_name = assigner_id
        except Exception:
            assigner_name = assigner_id

        notif_base = {
            "projectId": project_id,
            "taskId": ref[1].id,
            "title": title,
            "description": description,
            "createdBy": assigner_id,
            "assignedByName": assigner_name,
            "dueDate": due_date,
            "priority": doc["priority"],
            "status": doc["status"],
            "tags": doc["tags"],
            "type": "add task"
        }
        # Only notify collaborators, not the creator/assignee
        for collab_id in doc["collaboratorsIds"]:
            if collab_id and collab_id != assignee_id:
                notif_data = notif_base.copy()
                notif_data["assigneeId"] = collab_id
                notif_data["userId"] = collab_id
                add_notification(notif_data, project_name)
    except Exception as e:
        print(f"Notification error: {e}")
    return jsonify({"id": ref[1].id, "message": "Task created"}), 201

@projects_bp.route("/<project_id>/tasks/<task_id>", methods=["PUT"])
def update_task(project_id, task_id):
    patch = request.json or {}
    if "status" in patch: patch["status"] = canon_status(patch["status"])
    if "priority" in patch: patch["priority"] = canon_task_priority(patch["priority"])
    if "collaboratorsIds" in patch: patch["collaboratorsIds"] = ensure_list(patch["collaboratorsIds"])
    if "tags" in patch: patch["tags"] = ensure_list(patch["tags"])
    if "title" in patch:
        title = (patch["title"] or "").strip()
        patch["title"] = title or "Untitled task"
    if "description" in patch:
        patch["description"] = patch["description"] or ""
    if "dueDate" in patch and not patch["dueDate"]:
        patch["dueDate"] = None
    if "assigneeId" in patch:
        patch["ownerId"] = patch.get("assigneeId")
    if "ownerId" in patch and "assigneeId" not in patch:
        patch["assigneeId"] = patch.get("ownerId")
    patch["updatedAt"] = now_utc()
    # Get previous collaborators before update
    prev_doc = db.collection("projects").document(project_id).collection("tasks").document(task_id).get()
    prev_data = prev_doc.to_dict() if prev_doc.exists else {}
    prev_collaborators = set(prev_data.get("collaboratorsIds", []))
    # Update the task
    db.collection("projects").document(project_id).collection("tasks").document(task_id).update(patch)
    # After update, get new collaborators
    new_collaborators = set(patch.get("collaboratorsIds", []))
    added_collaborators = new_collaborators - prev_collaborators
    # Send notification to new collaborators only
    if added_collaborators:
        try:
            from notifications import add_notification
            project_doc = db.collection("projects").document(project_id).get()
            project_name = project_doc.to_dict().get("name", "") if project_doc.exists else ""
            # Get latest task data for notification
            task_doc = db.collection("projects").document(project_id).collection("tasks").document(task_id).get()
            task_data = task_doc.to_dict() if task_doc.exists else {}
            # Get assigner name
            assigner_id = task_data.get("ownerId", "")
            assigner_name = ""
            try:
                user_doc = db.collection("users").document(assigner_id).get()
                if user_doc.exists:
                    user_data = user_doc.to_dict()
                    assigner_name = user_data.get("fullName") or user_data.get("displayName") or user_data.get("name") or assigner_id
                else:
                    assigner_name = assigner_id
            except Exception:
                assigner_name = assigner_id
            notif_base = {
                "projectId": project_id,
                "taskId": task_id,
                "title": task_data.get("title", ""),
                "description": task_data.get("description", ""),
                "createdBy": assigner_id,
                "assignedByName": assigner_name,
                "dueDate": task_data.get("dueDate", ""),
                "priority": task_data.get("priority", ""),
                "status": task_data.get("status", ""),
                "tags": task_data.get("tags", []),
                "type": "add collaborator"
            }
            for collab_id in added_collaborators:
                if collab_id:
                    notif_data = notif_base.copy()
                    notif_data["assigneeId"] = collab_id
                    notif_data["userId"] = collab_id
                    add_notification(notif_data, project_name)
        except Exception as e:
            print(f"Notification error (collaborator add): {e}")
    return jsonify({"message": "Task updated"}), 200

@projects_bp.route("/<project_id>/tasks/<task_id>", methods=["DELETE"])
def delete_task(project_id, task_id):
    db.collection("projects").document(project_id).collection("tasks").document(task_id).delete()
    return jsonify({"message": "Task deleted"}), 200