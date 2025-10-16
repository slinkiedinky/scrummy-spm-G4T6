# back-end/projects.py
from flask import Blueprint, request, jsonify
from datetime import datetime, timezone

# ✅ Use the SAME db client everywhere
from firebase import db
from google.cloud import firestore  # for FieldFilter, ArrayUnion
from status_notifications import create_status_change_notifications

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
  if isinstance(p, (int, float)): val = int(round(p))
  else:
    s = str(p).strip().lower()
    if not s: return DEFAULT_TASK_PRIORITY
    if s in LEGACY_PRIORITY_MAP: return LEGACY_PRIORITY_MAP[s]
    try: val = int(round(float(s)))
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
  d.setdefault("title",""); d.setdefault("description","")
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
  if "status" in patch: patch["status"] = canon_status(patch["status"])
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

# -------- Tasks (under a project) --------

@projects_bp.route("/<project_id>/tasks", methods=["GET"])
def list_tasks(project_id):
  q = db.collection("projects").document(project_id).collection("tasks")
  assignee = request.args.get("assigneeId") or request.args.get("assignedTo")
  if assignee:
    docs = list(q.where("assigneeId","==", assignee).stream())
    if not docs:
      docs = list(q.where("ownerId","==", assignee).stream())
  else:
    docs = q.stream()
  items = [normalize_task_out({**d.to_dict(), "id": d.id}) for d in docs]
  return jsonify(items), 200

@projects_bp.route("/assigned/tasks", methods=["GET"])
def list_tasks_across_projects():
  assigned_to = request.args.get("assignedTo") or request.args.get("assigneeId")
  if not assigned_to: return jsonify({"error":"assignedTo is required"}), 400

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

  items = []
  for docu in docs:
    data = normalize_task_out({**docu.to_dict(), "id": docu.id})
    if status_filter and data.get("status") != canon_status(status_filter): continue
    if priority_filter and data.get("priority") != canon_task_priority(priority_filter): continue

    project_ref = docu.reference.parent.parent
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
  }

  task_ref = db.collection("projects").document(project_id).collection("tasks").add(doc_data)
  task_id = task_ref[1].id

  # Notify collaborators (unchanged behavior)
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

    base = {
      "projectId": project_id, "taskId": task_id,
      "title": title, "description": description,
      "createdBy": assigner_id, "assignedByName": assigner_name,
      "dueDate": due_date, "priority": doc_data["priority"], "status": doc_data["status"],
      "tags": doc_data["tags"], "type": "add task", "icon": "clipboardlist",
    }
    for collab_id in doc_data["collaboratorsIds"]:
      if collab_id and collab_id != assignee_id:
        n = base.copy(); n["userId"] = collab_id; n["assigneeId"] = collab_id
        add_notification(n, project_name)
  except Exception as e:
    print(f"Notification error: {e}")

  return jsonify({"id": task_id, "message":"Task created"}), 201

@projects_bp.route("/<project_id>/tasks/<task_id>", methods=["PUT"])
def update_task_endpoint(project_id, task_id):
    # read request body / updates (adjust to your existing parsing if different)
    payload = request.get_json() or {}
    updates = payload.get("updates") or payload  # support both shapes
    changed_by = payload.get("updatedBy") or payload.get("userId") or None

    # task document reference
    task_ref = db.collection("projects").document(project_id).collection("tasks").document(task_id)

    # capture prev_task BEFORE update
    prev_doc = task_ref.get()
    prev_task = prev_doc.to_dict() if prev_doc.exists else {}

    # perform update (existing logic may be different; keep your existing update calls)
    try:
        # If your code uses .update or .set, keep that instead of this line
        task_ref.update(updates)
    except Exception as e:
        print(f"[projects:update_task] failed to update task {task_id}: {e}")
        return jsonify({"error": "failed to update task"}), 500

    # call notifications (best-effort, non-blocking)
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

    # --- existing update logic: apply updates and write to Firestore ---
    # e.g. task_ref.update(updates)  OR however your code saves the changes
    task_ref.update(updates)

    # --- AFTER successful save: create notifications if status changed ---
    new_status = updates.get("status")
    if new_status is not None:
        # non-blocking: create notifications for status change
        try:
            create_status_change_notifications(project_id, task_id, prev_task, new_status, changed_by=updated_by)
        except Exception:
            # swallow to avoid breaking the update flow
            pass

    # ...existing return/value...
