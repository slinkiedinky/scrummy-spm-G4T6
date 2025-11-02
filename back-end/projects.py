# back-end/projects.py
from flask import Blueprint, request, jsonify, current_app
from flask_cors import cross_origin
from firebase_admin import firestore
from datetime import datetime, timezone

from firebase import db
from google.cloud import firestore  # for FieldFilter, ArrayUnion
from status_notifications import create_status_change_notifications, _get_user_display_name, _unique_non_null
from notifications import add_notification
from recurring_tasks import create_next_recurring_instance, create_next_standalone_recurring_instance
from deadline_notifications import check_task_deadline_immediate

projects_bp = Blueprint("projects", __name__)

ALLOWED_STATUSES = {"to-do", "in-progress", "completed", "blocked"}  # Updated to use consistent format
PROJECT_PRIORITIES = {"low", "medium", "high"}
PRIORITY_RANGE = list(range(1, 11))
LEGACY_PRIORITY_MAP = {"low": 3, "medium": 6, "high": 9, "urgent": 9, "critical": 10}
DEFAULT_TASK_PRIORITY = 5

def now_utc():
    return datetime.now(timezone.utc)

# ---- helpers: status canonicalization ----
def canon_status(value: str | None) -> str:
    """Normalize task/project status to a small, consistent set."""
    if not value:
        return "to-do"
    s = str(value).strip().lower()
    # treat separators consistently
    s = s.replace("_", " ").replace("-", " ")
    # map to canonical tokens
    if s in {"to do", "todo"}:
        return "to-do"
    if s in {"in progress", "progress"}:
        return "in-progress"
    if s in {"completed", "done"}:
        return "completed"
    if s in {"blocked", "on hold"}:
        return "blocked"
    # default safe fallback
    return "to-do"

def status_to_color(status: str) -> str:
    s = canon_status(status)
    return {
        "to-do": "grey",
        "in-progress": "yellow",
        "completed": "green",
        "blocked": "red",
    }.get(s, "grey")

# ---- project progress calculation ----
def calculate_project_progress(project_id: str) -> int:
    """
    Return whole-number percent of completed tasks for the project.
    - Completed / Total * 100, rounded to nearest integer.
    - If total == 0, return 0 (no divide-by-zero).
    """
    tasks_ref = db.collection("projects").document(project_id).collection("tasks")
    docs = list(tasks_ref.stream())
    total = len(docs)
    if total <= 0:
        return 0
    completed = 0
    for d in docs:
        st = canon_status((d.to_dict() or {}).get("status"))
        if st == "completed":
            completed += 1
    # Use proper rounding instead of int() which truncates
    return round((completed / total) * 100)

def _priority_number_to_bucket(n: int) -> str:
    if n >= 8: return "high"
    if n >= 5: return "medium"
    return "low"

def canon_project_priority(v) -> str:
    if not v: return "medium"
    if isinstance(v, (int, float)): return _priority_number_to_bucket(int(v))
    s = str(v).strip().lower()
    return s if s in PROJECT_PRIORITIES else "medium"

def canon_task_priority(p) -> int:
    if p is None: return DEFAULT_TASK_PRIORITY
    if isinstance(p, (int, float)): 
        return max(1, min(10, int(p)))
    s = str(p).strip().lower()
    return LEGACY_PRIORITY_MAP.get(s, DEFAULT_TASK_PRIORITY)

def ensure_list(x):
    if x is None: return []
    if isinstance(x, list): return x
    return [x]

def normalize_status(value: str) -> str:
    """Legacy function - use canon_status instead"""
    return canon_status(value)

def normalize_project_out(doc):
    data = dict(doc or {})
    if "priority" in data:
        data["priority"] = canon_project_priority(data["priority"])
    return data

def normalize_task_out(task: dict) -> dict:
    """Return a task dict ready for JSON output with canonical fields."""
    data = dict(task or {})
    # normalize status for clients/tests
    data["status"] = canon_status(data.get("status"))
    # (optional) expose a status_color field used by some tests/UI
    if "status_color" not in data:
        data["status_color"] = status_to_color(data["status"])
    return data

# -------- Projects --------

@projects_bp.route("/", methods=["GET"])
@cross_origin()
def get_projects():
    # Accept both userId and assignedTo for compatibility
    user_id = request.args.get("userId") or request.args.get("assignedTo")
    if not user_id: return jsonify({"error":"userId or assignedTo is required"}), 400
    docs = db.collection("projects").where("teamIds", "array_contains", user_id).stream()
    result = []
    for doc in docs:
        project_data = normalize_project_out({**doc.to_dict(), "id": doc.id})
        # Add progress calculation
        project_data["progress"] = calculate_project_progress(doc.id)
        result.append(project_data)
    return jsonify(result), 200

@projects_bp.route("/", methods=["POST"])
@cross_origin()
def create_project():
    data = request.json or {}
    now = now_utc()
    name = (data.get("name") or "Untitled Project").strip() or "Untitled Project"
    owner_id = data.get("ownerId")
    if not owner_id: return jsonify({"error":"ownerId is required"}), 400
    
    doc_data = {
        "name": name,
        "description": (data.get("description") or "").strip(),
        "ownerId": owner_id,
        "teamIds": ensure_list(data.get("teamIds") or [owner_id]),
        "priority": canon_project_priority(data.get("priority")),
        "createdAt": now,
        "updatedAt": now,
        "progress": 0  # Initialize progress to 0
    }
    
    # Ensure owner is in team
    if owner_id not in doc_data["teamIds"]:
        doc_data["teamIds"].append(owner_id)
    
    _, project_ref = db.collection("projects").add(doc_data)
    return jsonify({"id": project_ref.id, "message":"Project created"}), 201

@projects_bp.route("/<project_id>", methods=["GET"])
@cross_origin()
def get_project(project_id):
    doc = db.collection("projects").document(project_id).get()
    if not doc.exists: return jsonify({"error":"Not found"}), 404
    data = normalize_project_out({**doc.to_dict(), "id": doc.id})
    assigned_to = request.args.get("assignedTo") or request.args.get("assigneeId")
    if assigned_to and assigned_to not in data.get("teamIds", []):
        return jsonify({"error":"Forbidden"}), 403
    
    # Calculate and include progress
    data["progress"] = calculate_project_progress(project_id)
    
    return jsonify(data), 200

@projects_bp.route("/<project_id>", methods=["PUT"])
@cross_origin()
def update_project(project_id):
    data = request.json or {}
    user_id = data.get("userId")
    if not user_id: return jsonify({"error":"userId is required"}), 400
    
    project_ref = db.collection("projects").document(project_id)
    project_doc = project_ref.get()
    if not project_doc.exists: return jsonify({"error":"Project not found"}), 404
    
    project_data = project_doc.to_dict()
    if user_id != project_data.get("ownerId"):
        return jsonify({"error":"Only project owner can update project"}), 403
    
    updates = {"updatedAt": now_utc()}
    
    if "name" in data:
        name = (data.get("name") or "").strip()
        if name: updates["name"] = name
    
    if "description" in data:
        updates["description"] = (data.get("description") or "").strip()
    
    if "teamIds" in data:
        team_ids = ensure_list(data.get("teamIds"))
        if project_data.get("ownerId") not in team_ids:
            team_ids.append(project_data.get("ownerId"))
        updates["teamIds"] = team_ids
    
    if "priority" in data:
        updates["priority"] = canon_project_priority(data.get("priority"))
    
    project_ref.update(updates)
    return jsonify({"message":"Project updated"}), 200

# -------- Tasks --------

@projects_bp.route("/assigned/tasks", methods=["GET"])
@cross_origin()
def get_assigned_tasks():
    """Get all tasks assigned to a specific user across all projects"""
    assigned_to = request.args.get("assignedTo")
    if not assigned_to:
        return jsonify({"error": "assignedTo parameter is required"}), 400

    # Get all projects the user is part of
    projects_query = db.collection("projects").where("teamIds", "array_contains", assigned_to)
    projects = projects_query.stream()

    all_tasks = []
    for project_doc in projects:
        project_id = project_doc.id
        project_data = project_doc.to_dict()

        # Get tasks assigned to this user in this project
        tasks_ref = db.collection("projects").document(project_id).collection("tasks")
        tasks = tasks_ref.where("assigneeId", "==", assigned_to).stream()

        for task_doc in tasks:
            task_data = normalize_task_out({
                **task_doc.to_dict(),
                "id": task_doc.id,
                "projectId": project_id,
                "projectName": project_data.get("name", "")
            })
            all_tasks.append(task_data)

    # Also get standalone tasks assigned to this user
    standalone_tasks = db.collection("tasks").where("assigneeId", "==", assigned_to).stream()
    for task_doc in standalone_tasks:
        task_data = normalize_task_out({
            **task_doc.to_dict(),
            "id": task_doc.id,
            "projectId": None,
            "projectName": "Personal"
        })
        all_tasks.append(task_data)

    return jsonify(all_tasks), 200

@projects_bp.route("/<project_id>/tasks", methods=["GET"])
@cross_origin()
def get_tasks(project_id):
    # Accept both userId and assigneeId for compatibility
    user_id = request.args.get("userId") or request.args.get("assigneeId")
    if not user_id: return jsonify({"error":"userId or assigneeId is required"}), 400

    project_ref = db.collection("projects").document(project_id)
    project_doc = project_ref.get()
    if not project_doc.exists: return jsonify({"error":"Project not found"}), 404

    team_ids = ensure_list(project_doc.to_dict().get("teamIds"))
    if user_id not in team_ids:
        return jsonify({"error":"Access denied"}), 403

    tasks_ref = project_ref.collection("tasks")

    # Filter by assigneeId if provided as a separate filter parameter
    filter_assignee_id = request.args.get("assigneeId")
    if filter_assignee_id:
        tasks = tasks_ref.where("assigneeId", "==", filter_assignee_id).stream()
    else:
        tasks = tasks_ref.stream()

    result = []
    for task_doc in tasks:
        task_data = normalize_task_out({**task_doc.to_dict(), "id": task_doc.id, "projectId": project_id})
        result.append(task_data)

    return jsonify(result), 200

@projects_bp.route("/<project_id>/tasks", methods=["POST"])
@cross_origin()
def create_task(project_id):
    try:
        data = request.json or {}
        now = now_utc()
        assignee_id = data.get("assigneeId") or data.get("ownerId")
        if not assignee_id: return jsonify({"error":"assigneeId is required"}), 400

        project_ref = db.collection("projects").document(project_id)
        project_doc = project_ref.get()
        if not project_doc.exists: return jsonify({"error":"Project not found"}), 404

        team_ids = ensure_list(project_doc.to_dict().get("teamIds"))
        if assignee_id not in team_ids:
            project_ref.update({"teamIds": firestore.ArrayUnion([assignee_id]), "updatedAt": now})

        title = (data.get("title") or "Untitled task").strip() or "Untitled task"
        description = (data.get("description") or "").strip()
        due_date = data.get("dueDate") or None

        doc_data = {
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
            "isRecurring": data.get("isRecurring", False),
            "recurrencePattern": data.get("recurrencePattern"),
            "recurringInstanceCount": data.get("recurringInstanceCount", 0),
            "createdBy": data.get("createdBy"),
        }

        task_ref = db.collection("projects").document(project_id).collection("tasks").add(doc_data)
        task_id = task_ref[1].id

        # Update project progress after task creation
        try:
            progress = calculate_project_progress(project_id)
            project_ref.update({"progress": progress, "updatedAt": now})
        except Exception as e:
            print(f"Error updating project progress: {e}")

        # Check for immediate deadline notifications
        try:
            project_name = project_doc.to_dict().get("name", "Unknown Project")
            check_task_deadline_immediate(project_id, task_id, doc_data, project_name)
        except Exception as e:
            print(f"Error checking task deadline: {e}")

        return jsonify({"id": task_id, "message":"Task created"}), 201
    
    except Exception as e:
        print(f"Error creating task: {e}")
        return jsonify({"error": "Internal server error"}), 500

@projects_bp.route("/<project_id>/tasks/<task_id>", methods=["GET"])
@cross_origin()
def get_task(project_id, task_id):
    user_id = request.args.get("userId")
    if not user_id: return jsonify({"error":"userId is required"}), 400
    
    project_ref = db.collection("projects").document(project_id)
    project_doc = project_ref.get()
    if not project_doc.exists: return jsonify({"error":"Project not found"}), 404
    
    team_ids = ensure_list(project_doc.to_dict().get("teamIds"))
    if user_id not in team_ids:
        return jsonify({"error":"Access denied"}), 403
    
    task_ref = project_ref.collection("tasks").document(task_id)
    task_doc = task_ref.get()
    if not task_doc.exists: return jsonify({"error":"Task not found"}), 404
    
    task_data = normalize_task_out({**task_doc.to_dict(), "id": task_id, "projectId": project_id})
    return jsonify(task_data), 200

@projects_bp.route("/<project_id>/tasks/<task_id>", methods=["PATCH", "PUT"])
@cross_origin()
def update_task_endpoint(project_id, task_id):
    """Update a task (handles both PATCH and PUT)"""
    patch = request.json or {}
    
    # Verify task exists
    task_ref = db.collection("projects").document(project_id).collection("tasks").document(task_id)
    task_doc = task_ref.get()
    if not task_doc.exists:
        return jsonify({"error": "Task not found"}), 404

    # Store old status for recurring task logic
    old_task_data = task_doc.to_dict()
    old_status = canon_status(old_task_data.get("status"))
    
    # Normalize the patch data
    updates = {"updatedAt": now_utc()}
    
    if "status" in patch:
        updates["status"] = canon_status(patch["status"])
    if "priority" in patch:
        updates["priority"] = canon_task_priority(patch["priority"])
    if "title" in patch and patch["title"]:
        updates["title"] = patch["title"].strip()
    if "description" in patch:
        updates["description"] = patch["description"] or ""
    if "dueDate" in patch:
        updates["dueDate"] = patch["dueDate"]
    if "assigneeId" in patch:
        updates["assigneeId"] = patch["assigneeId"]
        updates["ownerId"] = patch["assigneeId"]  # Keep ownerId in sync
    if "collaboratorsIds" in patch:
        updates["collaboratorsIds"] = ensure_list(patch["collaboratorsIds"])
    if "tags" in patch:
        updates["tags"] = ensure_list(patch["tags"])

    # Apply updates
    task_ref.update(updates)

    # Update project progress if status changed
    if "status" in updates:
        try:
            progress = calculate_project_progress(project_id)
            db.collection("projects").document(project_id).update({
                "progress": progress, 
                "updatedAt": now_utc()
            })
        except Exception as e:
            print(f"Error recalculating progress: {e}")

        # Handle recurring tasks if completed
        new_status = updates["status"]
        if new_status == "completed" and old_status != "completed":
            is_recurring = old_task_data.get("isRecurring", False)
            if is_recurring:
                try:
                    updated_task_data = {**old_task_data, **updates}
                    from recurring_tasks import create_next_recurring_instance
                    new_task_id, error = create_next_recurring_instance(project_id, task_id, updated_task_data)
                    if new_task_id:
                        print(f"✅ [RECURRING] Created next instance: {new_task_id}")
                    elif error:
                        print(f"ℹ️ [RECURRING] Task series ended: {error}")
                except Exception as e:
                    print(f"❌ [RECURRING] Failed: {e}")

    # Return the updated task
    updated_doc = task_ref.get()
    result = updated_doc.to_dict()
    result["id"] = task_id
    result["projectId"] = project_id
    
    return jsonify(normalize_task_out(result)), 200

# Keep the old function name as an alias for backward compatibility
update_task = update_task_endpoint

@projects_bp.route("/<project_id>/tasks/<task_id>", methods=["DELETE"])
@cross_origin()
def delete_task(project_id, task_id):
    user_id = request.args.get("userId")
    if not user_id: return jsonify({"error":"userId is required"}), 400
    
    project_ref = db.collection("projects").document(project_id)
    project_doc = project_ref.get()
    if not project_doc.exists: return jsonify({"error":"Project not found"}), 404
    
    team_ids = ensure_list(project_doc.to_dict().get("teamIds"))
    if user_id not in team_ids:
        return jsonify({"error":"Access denied"}), 403
    
    task_ref = project_ref.collection("tasks").document(task_id)
    task_doc = task_ref.get()
    if not task_doc.exists: return jsonify({"error":"Task not found"}), 404
    
    task_ref.delete()
    
    # Update project progress after task deletion
    try:
        progress = calculate_project_progress(project_id)
        project_ref.update({"progress": progress, "updatedAt": now_utc()})
    except Exception as e:
        print(f"Error updating project progress: {e}")
    
    return jsonify({"message":"Task deleted"}), 200
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
    subtask_id = ref[1].id
    update_parent_task_progress(project_id, task_id)

    # Check for immediate deadline notifications
    try:
        project_name = project_doc.to_dict().get("name", "Unknown Project")
        check_task_deadline_immediate(project_id, subtask_id, doc, project_name)
    except Exception as e:
        print(f"Error checking subtask deadline: {e}")

    # Notify subtask assignee and collaborators
    try:
        from notifications import add_notification
        project_name = project_doc.to_dict().get("name", "")
        parent_title = parent_task_doc.to_dict().get("title", "")
        assigner_id = doc.get("createdBy") or doc.get("ownerId") or doc.get("assigneeId")
        assigner_name = assigner_id
        try:
            u = db.collection("users").document(assigner_id).get()
            if u.exists:
                ud = u.to_dict()
                assigner_name = ud.get("fullName") or ud.get("displayName") or ud.get("name") or assigner_id
        except Exception:
            pass

        # Notify assignee (new subtask assigned)
        assignee_notif = {
            "userId": doc["assigneeId"],
            "assigneeId": doc["assigneeId"],
            "projectId": project_id,
            "taskId": task_id,
            "subtaskId": subtask_id,
            "title": doc["title"],
            "description": doc["description"],
            "createdBy": assigner_id,
            "assignedByName": assigner_name,
            "dueDate": doc["dueDate"],
            "priority": doc["priority"],
            "status": doc["status"],
            "tags": doc["tags"],
            "type": "add subtask",
            "icon": "clipboardlist",
            "message": f"You have been assigned a new subtask: {doc['title']} (Parent task: {parent_title})"
        }
        add_notification(assignee_notif, project_name)

        # Notify collaborators (added as collaborator)
        for collab_id in doc["collaboratorsIds"]:
            if collab_id and collab_id != doc["assigneeId"]:
                collab_notif = assignee_notif.copy()
                collab_notif["userId"] = collab_id
                collab_notif["assigneeId"] = collab_id
                collab_notif["type"] = "add subtask collaborator"
                collab_notif["message"] = f"You have been added as a collaborator to subtask: {doc['title']} (Parent task: {parent_title})"
                add_notification(collab_notif, project_name)
    except Exception as e:
        print(f"Subtask notification error: {e}")

    return jsonify({"id": subtask_id, "message": "Subtask created"}), 201
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
        "isRecurring": data.get("isRecurring", False),
        "recurrencePattern": data.get("recurrencePattern"),
        "recurringInstanceCount": data.get("recurringInstanceCount", 0),
    }

    if not task_data["title"]:
        return jsonify({"error": "Title is required"}), 400
    
    if not task_data["dueDate"]:
        return jsonify({"error": "Due date is required"}), 400
    
    # Create task in top-level tasks collection
    task_ref = db.collection("tasks").document()
    task_ref.set(task_data)

    # Check for immediate deadline notifications
    try:
        check_task_deadline_immediate(None, task_ref.id, task_data, "Personal Tasks")
    except Exception as e:
        print(f"Error checking task deadline: {e}")

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
    if "isRecurring" in data:
        updates["isRecurring"] = data["isRecurring"]
    if "recurrencePattern" in data:
        updates["recurrencePattern"] = data["recurrencePattern"]
    
    task_ref.update(updates)
    # === RECURRING TASK LOGIC ===
    old_status = canon_status(task_data.get("status"))
    new_status = updates.get("status")
    if new_status == "completed" and old_status != "completed":
        is_recurring = task_data.get("isRecurring", False)
        if is_recurring:
            try:
                updated_task_data = {**task_data, **updates}
                new_task_id, error = create_next_standalone_recurring_instance(task_id, updated_task_data)
                if new_task_id:
                    print(f"✅ [RECURRING STANDALONE] Created next instance: {new_task_id}")
                elif error:
                    print(f"ℹ️ [RECURRING STANDALONE] Task ended: {error}")
            except Exception as e:
                print(f"❌ [RECURRING STANDALONE] Failed: {e}")

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

    # Check for immediate deadline notifications
    try:
        check_task_deadline_immediate(None, subtask_ref.id, subtask_data, "Personal Tasks")
    except Exception as e:
        print(f"Error checking subtask deadline: {e}")

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
    task_doc = task_ref.get()
    if not task_doc.exists:
        return
    
    task_data = task_doc.to_dict()
    old_status = canon_status(task_data.get("status"))
    
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
        if old_status != "completed":
            updates["status"] = "completed"
    elif progress < 100 and old_status == "completed":
        updates["status"] = "in progress"
        print(f"ℹ️ [AUTO-UNCOMPLETE STANDALONE] Moving task {task_id} back to in-progress (progress: {progress}%)")
    
    task_ref.update(updates)
    
    # === TRIGGER RECURRING TASK CREATION IF AUTO-COMPLETED ===
    new_status = updates.get("status")
    if new_status == "completed" and old_status != "completed":
        is_recurring = task_data.get("isRecurring", False)
        if is_recurring:
            try:
                updated_task_data = {**task_data, **updates}
                new_task_id, error = create_next_standalone_recurring_instance(task_id, updated_task_data)
                if new_task_id:
                    print(f"✅ [RECURRING STANDALONE] Auto-completed task created next instance: {new_task_id}")
                elif error:
                    print(f"ℹ️ [RECURRING STANDALONE] Task ended: {error}")
            except Exception as e:
                print(f"❌ [RECURRING STANDALONE] Failed: {e}")
     
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
    parent_doc = parent_task_ref.get()
    if not parent_doc.exists:
        return
    
    parent_task_data = parent_doc.to_dict()
    old_status = canon_status(parent_task_data.get("status"))
    print(f"🔍 [DEBUG] Task {task_id}: old_status={old_status}, isRecurring={parent_task_data.get('isRecurring', False)}")
    
    subtasks_query = parent_task_ref.collection("subtasks").stream()
    subtasks = list(subtasks_query)
    
    total_subtasks = len(subtasks)
    
    if total_subtasks == 0:
        parent_task_ref.update({
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
    
    print(f"🔍 [DEBUG] Task {task_id}: progress={progress}%, completed={completed_subtasks}/{total_subtasks}")
    
    updates = {
        "subtaskCount": total_subtasks,
        "subtaskCompletedCount": completed_subtasks,
        "subtaskProgress": progress,
        "updatedAt": now_utc(),
    }
    
    if progress == 100:
        if old_status != "completed":
            updates["status"] = "completed"
            print(f"🔍 [DEBUG] Task {task_id}: Setting status to completed")
    elif progress < 100 and old_status == "completed":
        updates["status"] = "in progress"
        print(f"ℹ️ [AUTO-UNCOMPLETE] Moving task {task_id} back to in-progress (progress: {progress}%)")
    
    parent_task_ref.update(updates)
    
    new_status = updates.get("status")
    print(f"🔍 [DEBUG] Task {task_id}: new_status={new_status}, checking recurring...")
    
    if new_status == "completed" and old_status != "completed":
        is_recurring = parent_task_data.get("isRecurring", False)
        print(f"🔍 [DEBUG] Task {task_id}: Triggering recurring check. isRecurring={is_recurring}")
        if is_recurring:
            try:
                updated_task_data = {**parent_task_data, **updates}
                print(f"🔍 [DEBUG] Task {task_id}: Calling create_next_recurring_instance...")
                new_task_id, error = create_next_recurring_instance(project_id, task_id, updated_task_data)
                if new_task_id:
                    print(f"✅ [RECURRING] Auto-completed task created next instance: {new_task_id}")
                elif error:
                    print(f"ℹ️ [RECURRING] Task ended: {error}")
            except Exception as e:
                print(f"❌ [RECURRING] Failed to create instance: {e}")
                import traceback
                traceback.print_exc()
