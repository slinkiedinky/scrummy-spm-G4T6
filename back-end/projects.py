# back-end/projects.py
from flask import Blueprint, request, jsonify, current_app
from flask_cors import cross_origin
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
    d.setdefault("subtaskCount", 0)
    d.setdefault("subtaskCompletedCount", 0)
    d.setdefault("subtaskProgress", 0)
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
@projects_bp.route("/<project_id>/tasks/<task_id>", methods=["GET"])
def get_task(project_id, task_id):
    """Get a single task with updated progress"""
    task_ref = db.collection("projects").document(project_id).collection("tasks").document(task_id)
    task_doc = task_ref.get()
    if not task_doc.exists:
        return jsonify({"error": "Task not found"}), 404

    task_data = task_doc.to_dict()
    task_data["id"] = task_id 
    task_data["projectId"] = project_id
    return jsonify(normalize_task_out(task_data)), 200
@projects_bp.route("/<project_id>/tasks", methods=["GET"])
def list_tasks(project_id):
    assignee = request.args.get("assigneeId") or request.args.get("assignedTo")
    
    project_doc = db.collection("projects").document(project_id).get()
    if not project_doc.exists:
        return jsonify({"error": "Project not found"}), 404
    
    project_data = project_doc.to_dict()
    team_ids = ensure_list(project_data.get("teamIds"))
    owner_id = project_data.get("ownerId") or project_data.get("createdBy")
    
    if assignee:
        if assignee in team_ids or assignee == owner_id:
            q = db.collection("projects").document(project_id).collection("tasks")
            docs = q.stream()
            items = [normalize_task_out({**d.to_dict(), "id": d.id}) for d in docs]
            return jsonify(items), 200
    return jsonify([]), 200
@projects_bp.route("/assigned/tasks", methods=["GET"])
def list_tasks_across_projects():
    """Get all tasks where user is assignee, owner, or collaborator"""
    assigned_to = request.args.get("assignedTo") or request.args.get("assigneeId")
    if not assigned_to:
        return jsonify({"error": "assignedTo is required"}), 400

    status_filter = request.args.get("status")
    if status_filter and status_filter.lower() == "all":
        status_filter = None

    priority_filter = request.args.get("priority")
    if priority_filter and isinstance(priority_filter, str) and priority_filter.lower() == "all":
        priority_filter = None

    # Step 1: Get all projects where user is a team member or owner
    projects_query = db.collection("projects").where("teamIds", "array_contains", assigned_to)
    projects_docs = list(projects_query.stream())
    
    # Also get projects where user is owner
    owner_projects_query = db.collection("projects").where("ownerId", "==", assigned_to)
    owner_projects_docs = list(owner_projects_query.stream())
    
    # Merge project lists
    all_project_ids = set()
    for doc in projects_docs + owner_projects_docs:
        all_project_ids.add(doc.id)
    
    # Step 2: Get all tasks from these projects
    all_tasks = []
    seen_paths = set()
    
    for project_id in all_project_ids:
        try:
            # Get all tasks in this project
            tasks_ref = db.collection("projects").document(project_id).collection("tasks")
            tasks_docs = tasks_ref.stream()
            
            for task_doc in tasks_docs:
                task_data = task_doc.to_dict()
                task_path = task_doc.reference.path
                
                # Skip if already seen
                if task_path in seen_paths:
                    continue
                
                # Check if user is involved in this task
                task_assignee = task_data.get("assigneeId") or task_data.get("ownerId")
                task_collabs = ensure_list(task_data.get("collaboratorsIds", []))
                
                if (assigned_to == task_assignee or 
                    assigned_to in task_collabs or
                    assigned_to == task_data.get("createdBy")):
                    
                    # Apply filters
                    if status_filter and task_data.get("status") != canon_status(status_filter):
                        continue
                    if priority_filter:
                        task_priority = task_data.get("priority")
                        if isinstance(task_priority, str):
                            task_priority = int(task_priority) if task_priority.isdigit() else 5
                        filter_priority = int(priority_filter) if isinstance(priority_filter, str) and priority_filter.isdigit() else priority_filter
                        if task_priority != filter_priority:
                            continue
                    
                    # Normalize and add project info
                    normalized = normalize_task_out({**task_data, "id": task_doc.id})
                    normalized["projectId"] = project_id
                    
                    # Get project name
                    try:
                        project_doc = db.collection("projects").document(project_id).get()
                        if project_doc.exists:
                            normalized["projectName"] = project_doc.to_dict().get("name", project_id)
                        else:
                            normalized["projectName"] = project_id
                    except:
                        normalized["projectName"] = project_id
                    
                    all_tasks.append(normalized)
                    seen_paths.add(task_path)
                    
        except Exception as e:
            print(f"Error fetching tasks from project {project_id}: {e}")
            continue
    
    return jsonify(all_tasks), 200
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
    created_by = data.get("createdBy") or data.get("currentUserId") or assignee_id

    doc = {
        "assigneeId": assignee_id,
        "ownerId": assignee_id,
        "createdBy": created_by,
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

# -------- Subtasks --------

@projects_bp.route("/<project_id>/tasks/<task_id>/subtasks", methods=["GET"])
@cross_origin()
def list_subtasks(project_id, task_id):
    """List all subtasks under a parent task"""
    q = db.collection("projects").document(project_id).collection("tasks").document(task_id).collection("subtasks")
    docs = q.stream()
    items = [normalize_task_out({**d.to_dict(), "id": d.id}) for d in docs]
    return jsonify(items), 200

@projects_bp.route("/<project_id>/tasks/<task_id>/subtasks/<subtask_id>", methods=["GET"])
@cross_origin()
def get_subtask(project_id, task_id, subtask_id):
    """Get a single subtask"""
    subtask_ref = (
        db.collection("projects")
        .document(project_id)
        .collection("tasks")
        .document(task_id)
        .collection("subtasks")
        .document(subtask_id)
    )
    subtask_doc = subtask_ref.get()
    
    if not subtask_doc.exists:
        return jsonify({"error": "Subtask not found"}), 404
    
    subtask_data = subtask_doc.to_dict()
    subtask_data["id"] = subtask_id
    subtask_data["projectId"] = project_id
    subtask_data["parentTaskId"] = task_id
    
    return jsonify(normalize_task_out(subtask_data)), 200

@projects_bp.route("/<project_id>/tasks/<task_id>/subtasks", methods=["POST"])
@cross_origin()
def create_subtask(project_id, task_id):
    """Create a subtask under a parent task"""
    data = request.json or {}
    now = now_utc()
    
    # Verify parent task exists
    parent_task_ref = db.collection("projects").document(project_id).collection("tasks").document(task_id)
    parent_task_doc = parent_task_ref.get()
    if not parent_task_doc.exists:
        return jsonify({"error": "Parent task not found"}), 404
    
    # Verify project exists
    project_ref = db.collection("projects").document(project_id)
    project_doc = project_ref.get()
    if not project_doc.exists:
        return jsonify({"error": "Project not found"}), 404
    
    assignee_id = data.get("assigneeId") or data.get("ownerId")
    if not assignee_id:
        return jsonify({"error": "assigneeId is required"}), 400
    
    # Ensure assignee is in project team
    team_ids = ensure_list(project_doc.to_dict().get("teamIds"))
    if assignee_id not in team_ids:
        project_ref.update({
            "teamIds": firestore.ArrayUnion([assignee_id]),
            "updatedAt": now,
        })
    
    title = (data.get("title") or "Untitled subtask").strip() or "Untitled subtask"
    description = (data.get("description") or "").strip()
    due_date = data.get("dueDate") or None
    created_by = data.get("createdBy") or data.get("currentUserId") or assignee_id
    
    doc = {
        "assigneeId": assignee_id,
        "ownerId": assignee_id,
        "createdBy": created_by,
        "collaboratorsIds": ensure_list(data.get("collaboratorsIds")),
        "createdAt": now,
        "description": description,
        "dueDate": due_date,
        "priority": canon_task_priority(data.get("priority")),
        "status": canon_status(data.get("status")),
        "title": title,
        "updatedAt": now,
        "tags": ensure_list(data.get("tags")),
        "parentTaskId": task_id,  # Link to parent
    }
    
    ref = parent_task_ref.collection("subtasks").add(doc)
    update_parent_task_progress(project_id, task_id)
    
    return jsonify({"id": ref[1].id, "message": "Subtask created"}), 201
# ============================================================================
# STANDALONE TASKS (not associated with any project)
# ============================================================================

@projects_bp.route("/standalone/tasks", methods=["POST"])
def create_standalone_task():
    """Create a standalone task not associated with any project"""
    data = request.json or {}
    now = now_utc()
    owner_id = data.get("ownerId") or data.get("createdBy")
    if not owner_id:
        return jsonify({"error": "ownerId is required"}), 400
    assignee_id = owner_id
    
    task_data = {
        "title": data.get("title", "").strip(),
        "description": data.get("description", "").strip(),
        "status": canon_status(data.get("status")),
        "priority": canon_task_priority(data.get("priority")),
        "dueDate": data.get("dueDate"),
        "tags": data.get("tags", []),
        "ownerId": owner_id,
        "assigneeId": assignee_id,
        "createdBy": owner_id,
        "createdAt": now,
        "updatedAt": now,
        "projectId": None,  
        "subtaskCount": 0,
        "subtaskCompletedCount": 0,
        "subtaskProgress": 0,
    }

    if not task_data["title"]:
        return jsonify({"error": "Title is required"}), 400
    
    if not task_data["dueDate"]:
        return jsonify({"error": "Due date is required"}), 400
    
    # Create task in top-level tasks collection
    task_ref = db.collection("tasks").document()
    task_ref.set(task_data)
    
    result = {**task_data, "id": task_ref.id}
    return jsonify(normalize_task_out(result)), 201


@projects_bp.route("/standalone/tasks", methods=["GET"])
def list_standalone_tasks():
    """Get all standalone tasks for a user"""
    owner_id = request.args.get("ownerId") or request.args.get("assignedTo")
    if not owner_id:
        return jsonify({"error": "ownerId is required"}), 400
    
    # Query tasks where user is owner
    tasks_query = db.collection("tasks").where("ownerId", "==", owner_id)
    tasks_docs = tasks_query.stream()
    
    items = []
    for doc in tasks_docs:
        task_data = doc.to_dict()
        task_data["id"] = doc.id
        items.append(normalize_task_out(task_data))
    
    return jsonify(items), 200


@projects_bp.route("/standalone/tasks/<task_id>", methods=["GET"])
def get_standalone_task(task_id):
    """Get a specific standalone task"""
    task_ref = db.collection("tasks").document(task_id)
    task_doc = task_ref.get()
    
    if not task_doc.exists:
        return jsonify({"error": "Task not found"}), 404
    
    task_data = task_doc.to_dict()
    task_data["id"] = task_doc.id
    
    return jsonify(normalize_task_out(task_data)), 200


@projects_bp.route("/standalone/tasks/<task_id>", methods=["PUT"])
def update_standalone_task(task_id):
    """Update a standalone task"""
    data = request.json or {}
    
    task_ref = db.collection("tasks").document(task_id)
    task_doc = task_ref.get()
    
    if not task_doc.exists:
        return jsonify({"error": "Task not found"}), 404
    
    task_data = task_doc.to_dict()
    owner_id = task_data.get("ownerId")
    
    # Only owner can update
    requester = data.get("updatedBy") or data.get("userId")
    if requester != owner_id:
        return jsonify({"error": "Only the task owner can update this task"}), 403
    
    updates = {"updatedAt": now_utc()}
    
    if "title" in data:
        updates["title"] = data["title"].strip()
    if "description" in data:
        updates["description"] = data["description"].strip()
    if "status" in data:
        updates["status"] = canon_status(data["status"])
    if "priority" in data:
        updates["priority"] = canon_task_priority(data["priority"])
    if "dueDate" in data:
        updates["dueDate"] = data["dueDate"]
    if "tags" in data:
        updates["tags"] = data["tags"]
    
    task_ref.update(updates)
    
    updated_doc = task_ref.get()
    result = updated_doc.to_dict()
    result["id"] = task_id
    
    return jsonify(normalize_task_out(result)), 200


@projects_bp.route("/standalone/tasks/<task_id>", methods=["DELETE"])
def delete_standalone_task(task_id):
    """Delete a standalone task"""
    task_ref = db.collection("tasks").document(task_id)
    task_doc = task_ref.get()
    
    if not task_doc.exists:
        return jsonify({"error": "Task not found"}), 404
    
    # Delete all subtasks first
    subtasks_ref = task_ref.collection("subtasks")
    subtasks = subtasks_ref.stream()
    for subtask in subtasks:
        subtask.reference.delete()
    
    # Delete the task
    task_ref.delete()
    
    return jsonify({"message": "Task deleted successfully"}), 200


# ============================================================================
# STANDALONE TASK SUBTASKS
# ============================================================================

@projects_bp.route("/standalone/tasks/<task_id>/subtasks", methods=["POST"])
def create_standalone_subtask(task_id):
    """Create a subtask for a standalone task"""
    data = request.json or {}
    now = now_utc()
    
    task_ref = db.collection("tasks").document(task_id)
    task_doc = task_ref.get()
    
    if not task_doc.exists:
        return jsonify({"error": "Parent task not found"}), 404
    
    task_data = task_doc.to_dict()
    owner_id = task_data.get("ownerId")
    
    subtask_data = {
        "title": data.get("title", "").strip(),
        "description": data.get("description", "").strip(),
        "status": canon_status(data.get("status")),
        "priority": canon_task_priority(data.get("priority")),
        "dueDate": data.get("dueDate"),
        "ownerId": owner_id,
        "assigneeId": owner_id,
        "createdBy": owner_id,
        "createdAt": now,
        "updatedAt": now,
    }
    
    if not subtask_data["title"]:
        return jsonify({"error": "Title is required"}), 400
    
    subtask_ref = task_ref.collection("subtasks").document()
    subtask_ref.set(subtask_data)
    
    # Update parent task progress
    update_standalone_task_progress(task_id)
    
    result = {**subtask_data, "id": subtask_ref.id}
    return jsonify(normalize_task_out(result)), 201


@projects_bp.route("/standalone/tasks/<task_id>/subtasks", methods=["GET"])
def list_standalone_subtasks(task_id):
    """Get all subtasks for a standalone task"""
    task_ref = db.collection("tasks").document(task_id)
    
    if not task_ref.get().exists:
        return jsonify({"error": "Task not found"}), 404
    
    subtasks_ref = task_ref.collection("subtasks")
    subtasks = subtasks_ref.stream()
    
    items = []
    for doc in subtasks:
        subtask_data = doc.to_dict()
        subtask_data["id"] = doc.id
        items.append(normalize_task_out(subtask_data))
    
    return jsonify(items), 200


@projects_bp.route("/standalone/tasks/<task_id>/subtasks/<subtask_id>", methods=["GET"])
def get_standalone_subtask(task_id, subtask_id):
    """Get a specific subtask"""
    subtask_ref = db.collection("tasks").document(task_id).collection("subtasks").document(subtask_id)
    subtask_doc = subtask_ref.get()
    
    if not subtask_doc.exists:
        return jsonify({"error": "Subtask not found"}), 404
    
    subtask_data = subtask_doc.to_dict()
    subtask_data["id"] = subtask_id
    
    return jsonify(normalize_task_out(subtask_data)), 200


@projects_bp.route("/standalone/tasks/<task_id>/subtasks/<subtask_id>", methods=["PUT"])
def update_standalone_subtask(task_id, subtask_id):
    """Update a subtask"""
    data = request.json or {}
    
    subtask_ref = db.collection("tasks").document(task_id).collection("subtasks").document(subtask_id)
    subtask_doc = subtask_ref.get()
    
    if not subtask_doc.exists:
        return jsonify({"error": "Subtask not found"}), 404
    
    updates = {"updatedAt": now_utc()}
    
    if "title" in data:
        updates["title"] = data["title"].strip()
    if "description" in data:
        updates["description"] = data["description"].strip()
    if "status" in data:
        updates["status"] = canon_status(data["status"])
    if "priority" in data:
        updates["priority"] = canon_task_priority(data["priority"])
    if "dueDate" in data:
        updates["dueDate"] = data["dueDate"]
    
    subtask_ref.update(updates)
    update_standalone_task_progress(task_id)
    
    updated_doc = subtask_ref.get()
    result = updated_doc.to_dict()
    result["id"] = subtask_id
    
    return jsonify(normalize_task_out(result)), 200


@projects_bp.route("/standalone/tasks/<task_id>/subtasks/<subtask_id>", methods=["DELETE"])
def delete_standalone_subtask(task_id, subtask_id):
    """Delete a subtask"""
    subtask_ref = db.collection("tasks").document(task_id).collection("subtasks").document(subtask_id)
    
    if not subtask_ref.get().exists:
        return jsonify({"error": "Subtask not found"}), 404
    
    subtask_ref.delete()
    update_standalone_task_progress(task_id)
    
    return jsonify({"message": "Subtask deleted successfully"}), 200


def update_standalone_task_progress(task_id):
    """Calculate and update standalone task's subtask completion progress"""
    task_ref = db.collection("tasks").document(task_id)
    subtasks_query = task_ref.collection("subtasks").stream()
    subtasks = list(subtasks_query)
    
    total_subtasks = len(subtasks)
    
    if total_subtasks == 0:
        task_ref.update({
            "subtaskCount": 0,
            "subtaskCompletedCount": 0,
            "subtaskProgress": 0,
            "updatedAt": now_utc(),
        })
        return
    completed_subtasks = sum(
        1 for subtask in subtasks
        if canon_status(subtask.to_dict().get("status")) == "completed"
    )
    progress = int((completed_subtasks / total_subtasks) * 100)
    updates = {
        "subtaskCount": total_subtasks,
        "subtaskCompletedCount": completed_subtasks,
        "subtaskProgress": progress,
        "updatedAt": now_utc(),
    }
    if progress == 100:
        task_doc = task_ref.get()
        if task_doc.exists:
            current_status = canon_status(task_doc.to_dict().get("status"))
            if current_status != "completed":
                updates["status"] = "completed"
    
    task_ref.update(updates)

@projects_bp.route("/<project_id>/tasks/<task_id>/subtasks/<subtask_id>", methods=["PUT"])
@cross_origin()
def update_subtask(project_id, task_id, subtask_id):
    """Update a subtask"""
    patch = request.json or {}
    if "status" in patch:
        patch["status"] = canon_status(patch["status"])
    if "priority" in patch:
        patch["priority"] = canon_task_priority(patch["priority"])
    if "collaboratorsIds" in patch:
        patch["collaboratorsIds"] = ensure_list(patch["collaboratorsIds"])
    if "tags" in patch:
        patch["tags"] = ensure_list(patch["tags"])
    if "title" in patch:
        title = (patch["title"] or "").strip()
        patch["title"] = title or "Untitled subtask"
    if "description" in patch:
        patch["description"] = patch["description"] or ""
    if "dueDate" in patch and not patch["dueDate"]:
        patch["dueDate"] = None
    if "assigneeId" in patch:
        patch["ownerId"] = patch.get("assigneeId")
    if "ownerId" in patch and "assigneeId" not in patch:
        patch["assigneeId"] = patch.get("ownerId")
    
    patch["updatedAt"] = now_utc()
    
    db.collection("projects").document(project_id).collection("tasks").document(task_id).collection("subtasks").document(subtask_id).update(patch)
    
    # Update parent task progress after subtask status change
    if "status" in patch:
        update_parent_task_progress(project_id, task_id)
    
    return jsonify({"message": "Subtask updated"}), 200


@projects_bp.route("/<project_id>/tasks/<task_id>/subtasks/<subtask_id>", methods=["DELETE"])
@cross_origin()
def delete_subtask(project_id, task_id, subtask_id):
    """Delete a subtask"""
    db.collection("projects").document(project_id).collection("tasks").document(task_id).collection("subtasks").document(subtask_id).delete()
    
    # Update parent task progress after deletion
    update_parent_task_progress(project_id, task_id)
    
    return jsonify({"message": "Subtask deleted"}), 200


# -------- Helper function to update parent task progress --------

def update_parent_task_progress(project_id, task_id):
    """Calculate and update parent task's subtask completion progress"""
    parent_task_ref = db.collection("projects").document(project_id).collection("tasks").document(task_id)
    
    # Get all subtasks
    subtasks_query = parent_task_ref.collection("subtasks").stream()
    subtasks = list(subtasks_query)
    
    total_subtasks = len(subtasks)
    
    if total_subtasks == 0:
        # No subtasks, clear progress
        parent_task_ref.update({
            "subtaskCount": 0,
            "subtaskCompletedCount": 0,
            "subtaskProgress": 0,
            "updatedAt": now_utc(),
        })
        return
    
    # Count completed subtasks
    completed_subtasks = sum(
        1 for subtask in subtasks 
        if canon_status(subtask.to_dict().get("status")) == "completed"
    )
    
    # Calculate progress percentage
    progress = int((completed_subtasks / total_subtasks) * 100)
    
    # Update parent task
    updates = {
        "subtaskCount": total_subtasks,
        "subtaskCompletedCount": completed_subtasks,
        "subtaskProgress": progress,
        "updatedAt": now_utc(),
    }
    
    # Optional: Auto-complete parent task when all subtasks are done
    if progress == 100:
        parent_doc = parent_task_ref.get()
        if parent_doc.exists:
            current_status = canon_status(parent_doc.to_dict().get("status"))
            # Only auto-complete if not already completed
            if current_status != "completed":
                updates["status"] = "completed"
    
    parent_task_ref.update(updates)
    new_status = "completed" if progress == 100 else "to-do"
    parent_task_ref.update({"status": new_status})