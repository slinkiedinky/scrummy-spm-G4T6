# back-end/projects.py
from flask import Blueprint, request, jsonify, current_app
from flask_cors import cross_origin
from firebase_admin import firestore
from datetime import datetime, timezone
import datetime
import statistics

from firebase import db
from google.cloud import firestore  # for FieldFilter, ArrayUnion
from status_notifications import create_status_change_notifications, _get_user_display_name, _unique_non_null
from notifications import add_notification
from recurring_tasks import create_next_recurring_instance, create_next_standalone_recurring_instance

projects_bp = Blueprint("projects", __name__)

ALLOWED_STATUSES = {"to-do", "in progress", "completed", "blocked"}
PROJECT_PRIORITIES = {"low", "medium", "high"}
PRIORITY_RANGE = list(range(1, 11))
LEGACY_PRIORITY_MAP = {"low": 3, "medium": 6, "high": 9, "urgent": 9, "critical": 10}
DEFAULT_TASK_PRIORITY = 5

def now_utc():
  return datetime.now(timezone.utc)

def canon_status(s: str | None) -> str:
  if not s: return "to-do"
  v = s.strip().lower()
  if v == "doing": v = "in progress"
  if v == "done": v = "completed"
  return v if v in ALLOWED_STATUSES else "to-do"

def _priority_number_to_bucket(n: int) -> str:
  if n >= 8: return "high"
  if n <= 3: return "low"
  return "medium"

def canon_project_priority(v) -> str:
  if v is None: return "medium"
  if isinstance(v, (int, float)): return _priority_number_to_bucket(int(round(v)))
  s = str(v).strip().lower()
  if not s: return "medium"
  if s in PROJECT_PRIORITIES: return s
  try:
    return _priority_number_to_bucket(int(round(float(s))))
  except Exception:
    return "medium"

def canon_task_priority(p) -> int:
  if p is None: return DEFAULT_TASK_PRIORITY
  if isinstance(p, (int, float)): val = int(p)
  else:
    s = str(p).strip().lower()
    if not s: return DEFAULT_TASK_PRIORITY
    if s in LEGACY_PRIORITY_MAP: return LEGACY_PRIORITY_MAP[s]
    try: val = int(float(s))
    except Exception: return DEFAULT_TASK_PRIORITY
  return max(PRIORITY_RANGE[0], min(PRIORITY_RANGE[-1], val))

def ensure_list(x):
  if isinstance(x, list): return x
  if x is None: return []
  if isinstance(x, (set, tuple)): return list(x)
  return [x]

def normalize_project_out(doc):
  d = {**doc}
  d.setdefault("name",""); d.setdefault("description","")
  owner = d.get("ownerId") or d.get("createdBy")
  if owner: d["ownerId"] = owner
  d["status"] = canon_status(d.get("status"))
  d["priority"] = canon_project_priority(d.get("priority"))
  d["teamIds"] = ensure_list(d.get("teamIds"))
  if owner and owner not in d["teamIds"]: d["teamIds"].append(owner)
  seen = set(); d["teamIds"] = [x for x in d["teamIds"] if not (x in seen or seen.add(x))]
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
  status = request.args.get("status")
  priority = request.args.get("priority")
  assigned_to = request.args.get("assignedTo") or request.args.get("assigneeId")

  filters = []
  if status and status.lower() != "all":
    filters.append(("status", canon_status(status)))
  if priority is not None and not (isinstance(priority, str) and priority.lower()=="all"):
    filters.append(("priority", canon_project_priority(priority)))

  def apply_filters(q):
    for f,v in filters: q = q.where(f, "==", v)
    return q

  if assigned_to:
    docs = list(apply_filters(base).where("teamIds","array_contains", assigned_to).stream())
    seen = {d.id for d in docs}
    for d in apply_filters(base).where("ownerId","==", assigned_to).stream():
      if d.id not in seen: docs.append(d); seen.add(d.id)
    for d in apply_filters(base).where("createdBy","==", assigned_to).stream():
      if d.id not in seen: docs.append(d)
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
  if owner and owner not in team_ids: team_ids.append(owner)
  seen = set(); team_ids = [x for x in team_ids if not (x in seen or seen.add(x))]
  doc = {
    "name": data.get("name",""),
    "description": data.get("description",""),
    "priority": canon_project_priority(data.get("priority")),
    "status": canon_status(data.get("status")),
    "teamIds": team_ids,
    "ownerId": owner, "createdBy": owner,
    "dueDate": data.get("dueDate"),
    "tags": ensure_list(data.get("tags")),
    "createdAt": now, "updatedAt": now,
  }
  ref = db.collection("projects").add(doc)
  return jsonify({"id": ref[1].id, "message":"Project created"}), 201

@projects_bp.route("/<project_id>", methods=["GET"])
def get_project(project_id):
  doc = db.collection("projects").document(project_id).get()
  if not doc.exists: return jsonify({"error":"Not found"}), 404
  data = normalize_project_out({**doc.to_dict(), "id": doc.id})
  assigned_to = request.args.get("assignedTo") or request.args.get("assigneeId")
  if assigned_to and assigned_to not in data.get("teamIds", []):
    return jsonify({"error":"Forbidden"}), 403
  return jsonify(data), 200

@projects_bp.route("/<project_id>", methods=["PUT"])
def update_project(project_id):
  patch = request.json or {}
  if "status" in patch: del patch["status"]
  if "priority" in patch: patch["priority"] = canon_project_priority(patch["priority"])
  if "teamIds" in patch: patch["teamIds"] = ensure_list(patch["teamIds"])
  if "tags" in patch: patch["tags"] = ensure_list(patch["tags"])
  patch["updatedAt"] = now_utc()
  db.collection("projects").document(project_id).set(patch, merge=True)
  return jsonify({"message":"Project updated"}), 200

@projects_bp.route("/<project_id>", methods=["DELETE"])
def delete_project(project_id):
  db.collection("projects").document(project_id).delete()
  return jsonify({"message":"Project deleted"}), 200

def update_project_status_from_tasks(project_id):
    """
    Compute project status from statuses of tasks under the project.
    Priority rules:
      - if any task is 'blocked' -> project 'blocked'
      - else if all tasks are 'completed' -> project 'completed'
      - else if any task is 'in progress' -> project 'in progress'
      - else -> 'to-do'
    """
    try:
        proj_ref = db.collection("projects").document(project_id)
        proj_doc = proj_ref.get()
        if not proj_doc.exists:
            return None
        task_docs = list(proj_ref.collection("tasks").stream())
        # no tasks => to-do
        if not task_docs:
            desired = "to-do"
        else:
            statuses = [canon_status(d.to_dict().get("status")) for d in task_docs]
            if any(s == "blocked" for s in statuses):
                desired = "blocked"
            elif all(s == "completed" for s in statuses):
                desired = "completed"
            elif any(s == "in progress" for s in statuses):
                desired = "in progress"
            else:
                desired = "to-do"

        current = canon_status(proj_doc.to_dict().get("status"))
        if desired != current:
            proj_ref.update({"status": desired, "updatedAt": now_utc()})
            print(f"[update_project_status_from_tasks] project={project_id} status {current} -> {desired}")
        return desired
    except Exception as e:
        print(f"[update_project_status_from_tasks] error: {e}")
        return None


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
def get_assigned_tasks():
    """Get all tasks where user is assignee, owner, or collaborator"""
    assigned_to = request.args.get("assignedTo") or request.args.get("assigneeId")
    if not assigned_to:
        return jsonify({"error": "assignedTo is required"}), 400

    status_filter = request.args.get("status")
    if status_filter and status_filter.lower()=="all": status_filter = None

    priority_filter = request.args.get("priority")
    if priority_filter and isinstance(priority_filter, str) and priority_filter.lower()=="all":
        priority_filter = None

    query = db.collection_group("tasks").where(filter=firestore.FieldFilter("assigneeId","==", assigned_to))
    docs = list(query.stream())

    owner_query = db.collection_group("tasks").where(filter=firestore.FieldFilter("ownerId","==", assigned_to))
    owner_docs = owner_query.stream()

    seen = {d.reference.path for d in docs}
    for d in owner_docs:
        if d.reference.path not in seen:
            docs.append(d); seen.add(d.reference.path)

    collab_query = db.collection_group("tasks").where(filter=firestore.FieldFilter("collaboratorsIds", "array_contains", assigned_to))
    collab_docs = collab_query.stream()
    
    for d in collab_docs:
        if d.reference.path not in seen:
            docs.append(d)
            seen.add(d.reference.path)
            
    items = []
    for docu in docs:
        data = normalize_task_out({**docu.to_dict(), "id": docu.id})
        if status_filter and data.get("status") != canon_status(status_filter): continue
        if priority_filter and data.get("priority") != canon_task_priority(priority_filter): continue
        project_doc = None
        project_ref = docu.reference.parent.parent
        if project_ref:
            data["projectId"] = project_ref.id
            project_doc = project_ref.get()
        if project_doc and project_doc.exists:
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

    # Notify assignee and collaborators
    try:
        from notifications import add_notification
        project_name = project_doc.to_dict().get("name", "")
        assigner_id = data.get("createdBy") or data.get("ownerId") or data.get("assigneeId")
        assigner_name = assigner_id
        try:
            u = db.collection("users").document(assigner_id).get()
            if u.exists:
                ud = u.to_dict()
                assigner_name = ud.get("fullName") or ud.get("displayName") or ud.get("name") or assigner_id
        except Exception:
            pass

        # Notify assignee (new task assigned)
        assignee_notif = {
            "userId": assignee_id,
            "assigneeId": assignee_id,
            "projectId": project_id,
        "taskId": task_id,
        "title": title,
        "description": description,
        "createdBy": assigner_id,
        "assignedByName": assigner_name,
        "dueDate": due_date,
        "priority": doc_data["priority"],
        "status": doc_data["status"],
        "tags": doc_data["tags"],
        "type": "add task",
        "icon": "clipboardlist",
        "message": f"You have been assigned a new task: {title}"
    }
        add_notification(assignee_notif, project_name)

        # Notify collaborators (added as collaborator)
        for collab_id in doc_data["collaboratorsIds"]:
            if collab_id and collab_id != assignee_id:
                collab_notif = assignee_notif.copy()
                collab_notif["userId"] = collab_id
                collab_notif["assigneeId"] = collab_id
                collab_notif["type"] = "add collaborator"
                collab_notif["message"] = f"You have been added as a collaborator to task: {title}"
                add_notification(collab_notif, project_name)
    except Exception as e:
        print(f"Notification error: {e}")

    return jsonify({"id": task_id, "message":"Task created"}), 201

@projects_bp.route("/<project_id>/tasks/<task_id>", methods=["PUT", "PATCH"])
def update_task_endpoint(project_id, task_id):
    payload = request.get_json() or {}
    updates = payload 
    changed_by = payload.get("updatedBy") or payload.get("userId") or None

    # task document reference
    task_ref = db.collection("projects").document(project_id).collection("tasks").document(task_id)

    # capture prev_task BEFORE update
    prev_doc = task_ref.get()
    prev_task = prev_doc.to_dict() if prev_doc.exists else {}

    if not prev_doc.exists:
        return jsonify({"error": "Task not found"}), 404

    if "title" in updates:
        title = (updates.get("title") or "").strip()
        updates["title"] = title or "Untitled task"
    if "description" in updates:
        updates["description"] = (updates.get("description") or "").strip()
    if "assigneeId" in updates:
        updates["ownerId"] = updates.get("assigneeId")
    if "ownerId" in updates and "assigneeId" not in updates:
        updates["assigneeId"] = updates.get("ownerId")
    if "tags" in updates:
        updates["tags"] = ensure_list(updates.get("tags"))
    if "collaboratorsIds" in updates:
        updates["collaboratorsIds"] = ensure_list(updates.get("collaboratorsIds"))
    if "priority" in updates:
        updates["priority"] = canon_task_priority(updates.get("priority"))
    
    updates["updatedAt"] = now_utc()
    try:
        task_ref.update(updates)

        # === RECURRING TASK LOGIC ===
        new_status = updates.get("status")
        old_status = canon_status(prev_task.get("status"))
        if new_status == "completed" and old_status != "completed":
            is_recurring = prev_task.get("isRecurring", False)
            if is_recurring:
                try:
                    updated_task_data = {**prev_task, **updates}
                    new_task_id, error = create_next_recurring_instance(project_id, task_id, updated_task_data)
                    if new_task_id:
                        print(f"✅ [RECURRING] Created next instance: {new_task_id}")
                    elif error:
                        print(f"ℹ️ [RECURRING] Task ended: {error}")
                except Exception as e:
                    print(f"❌ [RECURRING] Failed to create instance: {e}")

    except Exception as e:
        print(f"[projects:update_task] failed to update task {task_id}: {e}")
        return jsonify({"error": "failed to update task"}), 500
    try:
        new_status = updates.get("status")
        if new_status is not None:
            create_status_change_notifications(project_id, task_id, prev_task, new_status, changed_by=changed_by)
            print(f"[projects:update_task] status notification triggered for task={task_id}")
    except Exception as e:
        print(f"[projects:update_task] create_status_change_notifications error: {e}")

    return jsonify({"ok": True}), 200

def update_task(project_id, task_id, updates, updated_by=None):
    # fetch previous task BEFORE update
    task_ref = db.collection("projects").document(project_id).collection("tasks").document(task_id)
    prev_doc = task_ref.get()
    prev_task = prev_doc.to_dict() if prev_doc.exists else {}
    task_ref.update(updates)
    new_status = updates.get("status")
    if new_status is not None:
        try:
            create_status_change_notifications(project_id, task_id, prev_task, new_status, changed_by=updated_by)
        except Exception:
            pass
        return jsonify({"ok": True}), 200
@projects_bp.route("/<project_id>/tasks/<task_id>", methods=["DELETE"])
def delete_task(project_id, task_id):
    """
    Delete a task and create notifications for assignee/project owner/collaborators.
    Accept deletedBy from JSON body, query param, or X-User-Id header.
    This version contains extra logging for debugging.
    """
    try:
        # Log raw request bytes + content-type so we can see if JSON was parsed
        raw = request.get_data(as_text=True)
        print(f"[projects.delete_task] raw_request_body: {raw!r}")
        print(f"[projects.delete_task] content_type: {request.headers.get('Content-Type')}")
        print(f"[projects.delete_task] request.args: {dict(request.args)}")
        print(f"[projects.delete_task] request.headers X-User-Id: {request.headers.get('X-User-Id')}")

        payload = request.json or {}
        print(f"[projects.delete_task] parsed json: {payload}")

        deleted_by = (
            payload.get("deletedBy")
            or payload.get("updatedBy")
            or payload.get("userId")
            or payload.get("currentUserId")
            or request.args.get("deletedBy")
            or request.headers.get("X-User-Id")
        )
        print(f"[projects.delete_task] resolved deleted_by: {deleted_by}")

        task_ref = db.collection("projects").document(project_id).collection("tasks").document(task_id)
        task_doc = task_ref.get()
        if not task_doc.exists:
            print(f"[projects.delete_task] task not found: {project_id}/{task_id}")
            return jsonify({"error": "Task not found"}), 404
        task = task_doc.to_dict() or {}

        proj_doc = db.collection("projects").document(project_id).get()
        project = proj_doc.to_dict() if proj_doc.exists else {}
        project_name = project.get("name", "")
        project_owner = project.get("ownerId") or project.get("createdBy")

        assignee = task.get("assigneeId")
        collaborators = task.get("collaboratorsIds", []) or []

        recipients = list(_unique_non_null([assignee, project_owner] + list(collaborators) + ([deleted_by] if deleted_by else [])))
        print(f"[projects.delete_task] recipients: {recipients}")

        actor_name = _get_user_display_name(deleted_by) if deleted_by else "Someone"
        title = task.get("title", "Untitled Task")
        notif_type = "task deleted"

        created_any = 0
        for user_id in recipients:
            try:
                if deleted_by and user_id == deleted_by:
                    message = f"You deleted task '{title}'."
                else:
                    message = f"{actor_name} deleted task '{title}'."

                # build payload: keep title as the task name (frontend expects this)
                # keep title as the task name and include projectName so the UI shows:
                # Header from type ("Task deleted"), then "Task: {title}" and "Project: {projectName}"
                notif_data = {
                    "projectId": project_id,
                    "projectName": project_name,
                    "taskId": task_id,
                    "title": title,                       # task name (frontend shows this as Task:)
                    "taskTitle": title,                   # extra explicit field (safe)
                    "description": task.get("description", ""),
                    "userId": user_id,
                    "assigneeId": task.get("assigneeId"),
                    "priority": task.get("priority"),
                    "status": task.get("status"),
                    "type": notif_type,                   # "task deleted"
                    "message": message,
                    "icon": "trash",
                    "meta": {"deletedBy": deleted_by, "deletedByName": actor_name},
                }

                add_notification(notif_data, project_name)
                created_any += 1
                print(f"[projects.delete_task] add_notification succeeded for {user_id}")
            except Exception as e:
                print(f"[projects.delete_task] add_notification FAILED for {user_id}: {e}")

        print(f"[projects.delete_task] notifications created: {created_any}/{len(recipients)}")

        # delete after notifications queued
        task_ref.delete()
        print(f"[projects.delete_task] task deleted: {project_id}/{task_id}")
        return jsonify({"message": "Task deleted"}), 200

    except Exception as e:
        print(f"[projects.delete_task] fatal error: {e}")
        return jsonify({"error": "Internal server error"}), 500
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
        