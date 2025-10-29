from flask import Blueprint, request, jsonify
from firebase_admin import firestore
from datetime import datetime, timezone, timedelta
from firebase import db
# from projects import (
#     canon_status, 
#     canon_task_priority, 
#     ensure_list,
#     now_utc,
# )
from notifications import add_notification

# Helper functions (copied from projects.py to avoid circular import)
def now_utc():
    return datetime.now(timezone.utc)

def canon_status(s):
    if not s: return "to-do"
    v = s.strip().lower()
    if v == "doing": v = "in progress"
    if v == "done": v = "completed"
    allowed = {"to-do", "in progress", "completed", "blocked"}
    return v if v in allowed else "to-do"

def canon_task_priority(p):
    if p is None: return 5
    if isinstance(p, (int, float)): 
        val = int(round(p))
    else:
        s = str(p).strip().lower()
        if not s: return 5
        legacy_map = {"low": 3, "medium": 6, "high": 9, "urgent": 9, "critical": 10}
        if s in legacy_map: return legacy_map[s]
        try: 
            val = int(round(float(s)))
        except: 
            return 5
    return max(1, min(10, val))

def ensure_list(x):
    if isinstance(x, list): return x
    if x is None: return []
    if isinstance(x, (set, tuple)): return list(x)
    return [x]
    
recurring_bp = Blueprint("recurring", __name__)

RECURRENCE_FREQUENCIES = ["daily", "weekly", "monthly", "yearly"]

def validate_recurrence_pattern(pattern):
    """Validate recurrence pattern"""
    if not isinstance(pattern, dict):
        return False, "Pattern must be an object"
    
    frequency = pattern.get("frequency", "").lower()
    if frequency not in RECURRENCE_FREQUENCIES:
        return False, f"Invalid frequency. Must be one of: {', '.join(RECURRENCE_FREQUENCIES)}"
    
    interval = pattern.get("interval", 1)
    if not isinstance(interval, int) or interval < 1:
        return False, "Interval must be at least 1"
    
    # End condition validation
    end_condition = pattern.get("endCondition", "never")
    if end_condition not in ["never", "after_count", "on_date"]:
        return False, "Invalid end condition"
    
    if end_condition == "after_count":
        max_count = pattern.get("maxCount")
        if not isinstance(max_count, int) or max_count < 1:
            return False, "maxCount must be a positive integer"
    
    if end_condition == "on_date":
        end_date = pattern.get("endDate")
        if not end_date:
            return False, "endDate is required when endCondition is 'on_date'"
    
    return True, None


def calculate_next_due_date(current_due_date, pattern):
    """Calculate next due date based on recurrence pattern"""
    frequency = pattern.get("frequency", "daily")
    interval = pattern.get("interval", 1)
    
    # Parse current due date
    if isinstance(current_due_date, str):
        current = datetime.fromisoformat(current_due_date.replace('Z', '+00:00'))
    elif hasattr(current_due_date, 'seconds'):
        current = datetime.fromtimestamp(current_due_date.seconds, tz=timezone.utc)
    elif isinstance(current_due_date, datetime):
        current = current_due_date
    else:
        current = now_utc()
    
    # Calculate next occurrence
    if frequency == "daily":
        return current + timedelta(days=interval)
    elif frequency == "weekly":
        return current + timedelta(weeks=interval)
    elif frequency == "monthly":
        # Add months
        month = current.month + interval
        year = current.year
        while month > 12:
            month -= 12
            year += 1
        try:
            return current.replace(year=year, month=month)
        except ValueError:
            # Handle invalid dates (e.g., Jan 31 -> Feb 31)
            if month == 12:
                month = 1
                year += 1
            else:
                month += 1
            return datetime(year, month, 1, tzinfo=timezone.utc) - timedelta(days=1)
    elif frequency == "yearly":
        return current.replace(year=current.year + interval)
    
    return current + timedelta(days=interval)


def should_create_next_instance(task_data):
    """Check if we should create the next instance based on end conditions"""
    recurrence = task_data.get("recurrencePattern", {})
    end_condition = recurrence.get("endCondition", "never")
    
    if end_condition == "never":
        return True, None
    
    if end_condition == "after_count":
        current_count = task_data.get("recurringInstanceCount", 0)
        max_count = recurrence.get("maxCount", 0)
        if current_count >= max_count:
            return False, "Maximum instances reached"
        return True, None
    
    if end_condition == "on_date":
        end_date_str = recurrence.get("endDate")
        if end_date_str:
            end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00'))
            next_due = calculate_next_due_date(task_data.get("dueDate"), recurrence)
            if next_due > end_date:
                return False, "End date reached"
        return True, None
    
    return True, None


def copy_subtasks(source_project_id, source_task_id, target_project_id, target_task_id):
    """Copy all subtasks from source task to target task"""
    subtasks_ref = db.collection("projects").document(source_project_id).collection("tasks").document(source_task_id).collection("subtasks")
    subtasks = subtasks_ref.stream()
    
    for subtask_doc in subtasks:
        subtask_data = subtask_doc.to_dict()
        
        # Create new subtask with same data but reset status
        new_subtask = {
            "title": subtask_data.get("title"),
            "description": subtask_data.get("description", ""),
            "status": "to-do",  # Reset to to-do
            "priority": subtask_data.get("priority", 5),
            "assigneeId": subtask_data.get("assigneeId"),
            "ownerId": subtask_data.get("ownerId"),
            "dueDate": subtask_data.get("dueDate"),
            "createdAt": now_utc(),
            "updatedAt": now_utc(),
            "createdBy": subtask_data.get("createdBy"),
        }
        
        db.collection("projects").document(target_project_id).collection("tasks").document(target_task_id).collection("subtasks").add(new_subtask)


def copy_standalone_subtasks(source_task_id, target_task_id):
    """Copy subtasks for standalone tasks"""
    subtasks_ref = db.collection("tasks").document(source_task_id).collection("subtasks")
    subtasks = subtasks_ref.stream()
    
    for subtask_doc in subtasks:
        subtask_data = subtask_doc.to_dict()
        
        new_subtask = {
            "title": subtask_data.get("title"),
            "description": subtask_data.get("description", ""),
            "status": "to-do",
            "priority": subtask_data.get("priority", 5),
            "assigneeId": subtask_data.get("assigneeId"),
            "ownerId": subtask_data.get("ownerId"),
            "dueDate": subtask_data.get("dueDate"),
            "createdAt": now_utc(),
            "updatedAt": now_utc(),
            "createdBy": subtask_data.get("createdBy"),
        }
        
        db.collection("tasks").document(target_task_id).collection("subtasks").add(new_subtask)


def create_next_recurring_instance(project_id, task_id, completed_task_data):
    """Create the next recurring task instance after completion"""
    now = now_utc()
    recurrence = completed_task_data.get("recurrencePattern", {})
    
    # Check if we should create next instance
    should_create, reason = should_create_next_instance(completed_task_data)
    if not should_create:
        return None, reason
    
    # Calculate next due date
    next_due_date = calculate_next_due_date(completed_task_data.get("dueDate"), recurrence)
    
    # Create new task instance
    new_instance = {
        "title": completed_task_data.get("title"),
        "description": completed_task_data.get("description", ""),
        "assigneeId": completed_task_data.get("assigneeId"),
        "ownerId": completed_task_data.get("ownerId"),
        "status": "to-do",
        "priority": completed_task_data.get("priority", 5),
        "collaboratorsIds": completed_task_data.get("collaboratorsIds", []),
        "tags": completed_task_data.get("tags", []),
        "dueDate": next_due_date.isoformat(),
        "isRecurring": True,
        "recurrencePattern": recurrence,
        "recurringInstanceCount": completed_task_data.get("recurringInstanceCount", 0) + 1,
        "previousInstanceId": task_id,
        "createdAt": now,
        "updatedAt": now,
        "createdBy": completed_task_data.get("createdBy"),
    }
    
    # Create the new task
    new_task_ref = db.collection("projects").document(project_id).collection("tasks").add(new_instance)
    new_task_id = new_task_ref[1].id
    
    # Copy subtasks
    copy_subtasks(project_id, task_id, project_id, new_task_id)
    
    # Send notification to creator
    try:
        creator_id = completed_task_data.get("createdBy")
        if creator_id:
            add_notification(
                user_id=creator_id,
                notification_type="recurring_task_created",
                message=f"New recurring task instance created: {new_instance['title']}",
                related_entity_type="task",
                related_entity_id=new_task_id,
                project_id=project_id
            )
    except Exception as e:
        print(f"Failed to send notification: {e}")
    
    return new_task_id, None


def create_next_standalone_recurring_instance(task_id, completed_task_data):
    """Create next recurring instance for standalone task"""
    now = now_utc()
    recurrence = completed_task_data.get("recurrencePattern", {})
    
    should_create, reason = should_create_next_instance(completed_task_data)
    if not should_create:
        return None, reason
    
    next_due_date = calculate_next_due_date(completed_task_data.get("dueDate"), recurrence)
    
    new_instance = {
        "title": completed_task_data.get("title"),
        "description": completed_task_data.get("description", ""),
        "assigneeId": completed_task_data.get("assigneeId"),
        "ownerId": completed_task_data.get("ownerId"),
        "status": "to-do",
        "priority": completed_task_data.get("priority", 5),
        "tags": completed_task_data.get("tags", []),
        "dueDate": next_due_date.isoformat(),
        "isRecurring": True,
        "recurrencePattern": recurrence,
        "recurringInstanceCount": completed_task_data.get("recurringInstanceCount", 0) + 1,
        "previousInstanceId": task_id,
        "createdAt": now,
        "updatedAt": now,
        "createdBy": completed_task_data.get("createdBy"),
    }
    
    new_task_ref = db.collection("tasks").add(new_instance)
    new_task_id = new_task_ref[1].id
    
    # Copy subtasks
    copy_standalone_subtasks(task_id, new_task_id)
    
    # Send notification
    try:
        creator_id = completed_task_data.get("createdBy")
        if creator_id:
            add_notification(
                user_id=creator_id,
                notification_type="recurring_task_created",
                message=f"New recurring task instance created: {new_instance['title']}",
                related_entity_type="task",
                related_entity_id=new_task_id
            )
    except Exception as e:
        print(f"Failed to send notification: {e}")
    
    return new_task_id, None


# -------- API Routes --------

@recurring_bp.route("/validate-pattern", methods=["POST"])
def validate_pattern():
    """Validate a recurrence pattern"""
    data = request.json or {}
    pattern = data.get("recurrencePattern")
    
    if not pattern:
        return jsonify({"valid": False, "error": "Pattern is required"}), 400
    
    valid, error = validate_recurrence_pattern(pattern)
    
    if valid:
        return jsonify({"valid": True}), 200
    else:
        return jsonify({"valid": False, "error": error}), 400


@recurring_bp.route("/preview-next-date", methods=["POST"])
def preview_next_date():
    """Preview what the next due date would be"""
    data = request.json or {}
    current_due = data.get("currentDueDate")
    pattern = data.get("recurrencePattern")
    
    if not current_due or not pattern:
        return jsonify({"error": "currentDueDate and recurrencePattern required"}), 400
    
    try:
        next_due = calculate_next_due_date(current_due, pattern)
        return jsonify({
            "currentDueDate": current_due,
            "nextDueDate": next_due.isoformat()
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400
