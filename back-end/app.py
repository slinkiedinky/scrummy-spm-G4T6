# back-end/app.py
from flask import Flask, jsonify, request
from flask_cors import CORS
from firebase import db  # from back-end/firebase.py
import datetime as dt
import uuid
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta

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

def _canon_priority(p):
    """Handle both string and numeric priorities for projects"""
    if p is None:
        return "medium"
    
    if isinstance(p, str):
        q = p.strip().lower()
        return q if q in {"low", "medium", "high"} else "medium"
    
    try:
        priority_num = int(p)
        if priority_num <= 3:
            return "low"
        elif priority_num <= 7:
            return "medium"
        else:
            return "high"
    except (ValueError, TypeError):
        return "medium"

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

    # priority = (t.get("priority") or "medium").strip().lower() 

    priority_value = t.get("priority")
    if priority_value is None:
        priority = 5  # Default to medium priority (middle of 1-10 scale)
    elif isinstance(priority_value, str):
        # Handle legacy string priorities if they exist
        priority_map = {
            "low": 3, "medium": 5, "high": 7, "urgent": 9,
            "1": 1, "2": 2, "3": 3, "4": 4, "5": 5,
            "6": 6, "7": 7, "8": 8, "9": 9, "10": 10
        }
        priority = priority_map.get(priority_value.lower(), 5)
    else:
        # Handle integer priorities (1-10)
        priority = max(1, min(10, int(priority_value)))  # Ensure it's between 1-10

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

# task endpoints
@app.get("/api/my-tasks/<user_id>")
def get_my_tasks(user_id):
    # Find all projects where user is a collaborator/manager/task creator
    projects = db.collection("projects").where("teamIds", "array_contains", user_id).stream()
    all_tasks = []
    for proj in projects:
        tasks_snap = db.collection("projects").document(proj.id).collection("tasks").where("assigneeId", "==", user_id).stream()
        team_lookup = {user_id: f"User {user_id[:4]}"}
        for d in tasks_snap:
            task = _normalize_task(d, team_lookup)
            # Fetch subtasks if any
            subtasks_snap = db.collection("projects").document(proj.id).collection("tasks").document(d.id).collection("subtasks").stream()
            subtasks = [_normalize_task(sub, team_lookup) for sub in subtasks_snap]
            task["subtasks"] = subtasks
            all_tasks.append(task)
    return jsonify(all_tasks)

@app.route('/api/projects/<project_id>/tasks', methods=['POST'])
def create_task(project_id):
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['title', 'assigneeId', 'priority', 'dueDate']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({"error": f"Missing required field: {field}"}), 400
        
        # Generate task ID
        task_id = str(uuid.uuid4())
        
        # Handle recurrence data
        recurrence = data.get('recurrence', {})
        is_recurring = recurrence.get('enabled', False)
        
        # Create task document
        task_data = {
            "id": task_id,
            "title": data['title'],
            "description": data.get('description', ''),
            "status": data.get('status', 'todo'),
            "priority": int(data['priority']),  # Ensure it's an integer 1-10
            "assigneeId": data['assigneeId'],
            "dueDate": data['dueDate'],
            "projectId": project_id,
            "tags": data.get('tags', []),
            "collaborators": data.get('collaborators', []),  # List of user IDs
            "notes": data.get('notes', ''),
            "comments": [],
            "attachments": [],
            "subtaskIds": [],  # Will store IDs of subtasks
            "createdAt": datetime.utcnow().isoformat(),
            "updatedAt": datetime.utcnow().isoformat(),
            "createdBy": data.get('createdBy', ''),
            "isStandalone": False,  # This is a project task
            "isRecurring": is_recurring,
            "recurrence": recurrence if is_recurring else None,
            "originalTaskId": None,  # For recurring task instances
        }
        
        # Save to Firebase
        task_ref = db.collection('projects').document(project_id).collection('tasks').document(task_id)
        task_ref.set(task_data)
        
        # If recurring, create the recurrence pattern
        if is_recurring:
            create_recurrence_schedule(task_id, project_id, recurrence, data['dueDate'])
        
        return jsonify({"message": "Task created successfully", "taskId": task_id}), 201
        
    except Exception as e:
        print(f"Error creating task: {str(e)}")
        return jsonify({"error": "Failed to create task"}), 500

@app.route('/api/standalone-tasks', methods=['POST'])
def create_standalone_task():
    """Create a standalone task not associated with any project"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['title', 'assigneeId', 'priority', 'dueDate']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({"error": f"Missing required field: {field}"}), 400
        
        # Generate task ID
        task_id = str(uuid.uuid4())
        
        # Handle recurrence data
        recurrence = data.get('recurrence', {})
        is_recurring = recurrence.get('enabled', False)
        
        # Create standalone task document
        task_data = {
            "id": task_id,
            "title": data['title'],
            "description": data.get('description', ''),
            "status": data.get('status', 'todo'),
            "priority": int(data['priority']),
            "assigneeId": data['assigneeId'],
            "dueDate": data['dueDate'],
            "projectId": None,  # No project association
            "tags": data.get('tags', []),
            "collaborators": data.get('collaborators', []),
            "notes": data.get('notes', ''),
            "comments": [],
            "attachments": [],
            "subtaskIds": [],
            "createdAt": datetime.utcnow().isoformat(),
            "updatedAt": datetime.utcnow().isoformat(),
            "createdBy": data.get('createdBy', ''),
            "isStandalone": True,
            "isRecurring": is_recurring,
            "recurrence": recurrence if is_recurring else None,
            "originalTaskId": None,
        }
        
        # Save to Firebase (standalone tasks collection)
        task_ref = db.collection('standalone_tasks').document(task_id)
        task_ref.set(task_data)
        
        # If recurring, create the recurrence schedule
        if is_recurring:
            create_recurrence_schedule(task_id, None, recurrence, data['dueDate'])
        
        return jsonify({"message": "Standalone task created successfully", "taskId": task_id}), 201
        
    except Exception as e:
        print(f"Error creating standalone task: {str(e)}")
        return jsonify({"error": "Failed to create standalone task"}), 500

def create_recurrence_schedule(task_id, project_id, recurrence, initial_due_date):
    """Create recurrence schedule for a recurring task"""
    try:
        interval_type = recurrence.get('interval', 'weekly')
        interval_value = recurrence.get('value', 1)
        end_date = recurrence.get('endDate')
        max_occurrences = recurrence.get('maxOccurrences')
        
        # Parse initial due date
        due_date = datetime.fromisoformat(initial_due_date.replace('Z', '+00:00'))
        
        # Generate next few occurrences (limit to prevent infinite loops)
        occurrences = []
        current_date = due_date
        count = 0
        max_generate = min(max_occurrences or 10, 50)  # Limit to 50 occurrences max
        
        while count < max_generate:
            # Calculate next occurrence
            if interval_type == 'daily':
                current_date += timedelta(days=interval_value)
            elif interval_type == 'weekly':
                current_date += timedelta(weeks=interval_value)
            elif interval_type == 'monthly':
                current_date += relativedelta(months=interval_value)
            elif interval_type == 'yearly':
                current_date += relativedelta(years=interval_value)
            
            # Check if we've exceeded the end date
            if end_date:
                end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                if current_date > end_dt:
                    break
            
            occurrences.append(current_date.isoformat())
            count += 1
        
        # Store recurrence schedule
        recurrence_data = {
            "taskId": task_id,
            "projectId": project_id,
            "interval": interval_type,
            "value": interval_value,
            "nextOccurrences": occurrences,
            "endDate": end_date,
            "maxOccurrences": max_occurrences,
            "createdAt": datetime.utcnow().isoformat()
        }
        
        db.collection('task_recurrences').document(task_id).set(recurrence_data)
        
    except Exception as e:
        print(f"Error creating recurrence schedule: {str(e)}")

@app.route('/api/tasks/<task_id>/complete', methods=['POST'])
def complete_task(task_id):
    """Complete a task and create next recurring instance if applicable"""
    try:
        data = request.get_json()
        project_id = data.get('projectId')
        
        # Update task status to completed
        if project_id:
            task_ref = db.collection('projects').document(project_id).collection('tasks').document(task_id)
        else:
            task_ref = db.collection('standalone_tasks').document(task_id)
        
        task_ref.update({
            "status": "completed",
            "completedAt": datetime.utcnow().isoformat(),
            "updatedAt": datetime.utcnow().isoformat()
        })
        
        # Check if this is a recurring task
        recurrence_ref = db.collection('task_recurrences').document(task_id).get()
        if recurrence_ref.exists:
            create_next_recurring_task(task_id, project_id)
        
        return jsonify({"message": "Task completed successfully"}), 200
        
    except Exception as e:
        print(f"Error completing task: {str(e)}")
        return jsonify({"error": "Failed to complete task"}), 500

def create_next_recurring_task(original_task_id, project_id):
    """Create the next instance of a recurring task"""
    try:
        # Get original task
        if project_id:
            task_ref = db.collection('projects').document(project_id).collection('tasks').document(original_task_id).get()
        else:
            task_ref = db.collection('standalone_tasks').document(original_task_id).get()
        
        if not task_ref.exists:
            return
        
        task_data = task_ref.to_dict()
        recurrence_ref = db.collection('task_recurrences').document(original_task_id).get()
        
        if not recurrence_ref.exists:
            return
        
        recurrence_data = recurrence_ref.to_dict()
        next_occurrences = recurrence_data.get('nextOccurrences', [])
        
        if not next_occurrences:
            return
        
        # Get the next due date
        next_due_date = next_occurrences[0]
        remaining_occurrences = next_occurrences[1:]
        
        # Create new task instance
        new_task_id = str(uuid.uuid4())
        new_task_data = task_data.copy()
        new_task_data.update({
            "id": new_task_id,
            "status": "todo",
            "dueDate": next_due_date,
            "createdAt": datetime.utcnow().isoformat(),
            "updatedAt": datetime.utcnow().isoformat(),
            "originalTaskId": original_task_id,
            "comments": [],
            "completedAt": None,
        })
        
        # Save new task instance
        if project_id:
            new_task_ref = db.collection('projects').document(project_id).collection('tasks').document(new_task_id)
        else:
            new_task_ref = db.collection('standalone_tasks').document(new_task_id)
        
        new_task_ref.set(new_task_data)
        
        # Update recurrence schedule
        db.collection('task_recurrences').document(original_task_id).update({
            "nextOccurrences": remaining_occurrences,
            "updatedAt": datetime.utcnow().isoformat()
        })
        
        print(f"Created next recurring task instance: {new_task_id}")
        
    except Exception as e:
        print(f"Error creating next recurring task: {str(e)}")

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


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
