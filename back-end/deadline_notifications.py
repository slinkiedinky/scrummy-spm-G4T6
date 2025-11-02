from firebase import db
import datetime as dt
from notifications import add_notification

def check_task_deadline_immediate(project_id, task_id, task_data, project_name=None):
    """
    Check if a single task has an immediate deadline (today or tomorrow) and create notification.
    Called immediately after task creation or update.

    Args:
        project_id: Project ID (or None for standalone tasks)
        task_id: Task ID
        task_data: Task data dictionary
        project_name: Project name (optional, will fetch if not provided)
    """
    # Skip completed tasks
    if task_data.get("status", "").lower() == "completed":
        return

    due_date_str = task_data.get("dueDate")
    if not due_date_str:
        return

    # Parse due date
    try:
        if isinstance(due_date_str, str):
            due_date = dt.datetime.fromisoformat(due_date_str.replace("Z", "+00:00"))
        else:
            # Firestore timestamp
            due_date = due_date_str.todate() if hasattr(due_date_str, 'todate') else due_date_str

        # Convert to SGT (UTC+8) before extracting date
        # This ensures we compare calendar dates in the user's timezone
        if hasattr(due_date, 'replace'):
            due_date_sgt = due_date + dt.timedelta(hours=8)
            due_date = due_date_sgt.replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=None)
    except Exception as e:
        print(f"⚠️  Failed to parse date for task deadline check: {e}")
        return

    # Get current SGT date (UTC+8)
    now = dt.datetime.utcnow() + dt.timedelta(hours=8)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow = today + dt.timedelta(days=1)

    # Fetch project name if not provided
    if project_name is None:
        if project_id:
            try:
                project_doc = db.collection("projects").document(project_id).get()
                if project_doc.exists:
                    project_name = project_doc.to_dict().get("name", "Unknown Project")
                else:
                    project_name = "Unknown Project"
            except Exception:
                project_name = "Unknown Project"
        else:
            project_name = "Personal Tasks"

    assignee_id = task_data.get("assigneeId")
    collaborator_ids = task_data.get("collaboratorsIds", [])

    def notification_exists(user_id, notif_type):
        """Check if notification already exists"""
        existing = db.collection("notifications").where(
            "taskId", "==", task_id
        ).where(
            "userId", "==", user_id
        ).where(
            "type", "==", notif_type
        ).limit(1).stream()
        return len(list(existing)) > 0

    # Check if due tomorrow (1 day before deadline)
    if due_date == tomorrow:
        print(f"📅 New task due tomorrow! Creating immediate notification...")
        notif_type = "deadline_reminder"
        users_to_notify = [assignee_id] + (collaborator_ids if collaborator_ids else [])

        for user_id in users_to_notify:
            if user_id and not notification_exists(user_id, notif_type):
                notif_data = {
                    "projectId": project_id,
                    "projectName": project_name,
                    "taskId": task_id,
                    "title": task_data.get("title", "Untitled Task"),
                    "description": task_data.get("description", ""),
                    "userId": user_id,
                    "dueDate": due_date_str,
                    "priority": task_data.get("priority"),
                    "status": task_data.get("status"),
                    "type": notif_type,
                    "message": f"Task '{task_data.get('title', 'Untitled')}' is due tomorrow",
                    "icon": "calendar"
                }
                add_notification(notif_data, project_name)
                print(f"   ✅ Created deadline reminder for user {user_id}")

    # Check if due today
    elif due_date == today:
        print(f"⚠️  New task due today! Creating immediate notification...")
        notif_type = "deadline_today"
        users_to_notify = [assignee_id] + (collaborator_ids if collaborator_ids else [])

        for user_id in users_to_notify:
            if user_id and not notification_exists(user_id, notif_type):
                notif_data = {
                    "projectId": project_id,
                    "projectName": project_name,
                    "taskId": task_id,
                    "title": task_data.get("title", "Untitled Task"),
                    "description": task_data.get("description", ""),
                    "userId": user_id,
                    "dueDate": due_date_str,
                    "priority": task_data.get("priority"),
                    "status": task_data.get("status"),
                    "type": notif_type,
                    "message": f"Task '{task_data.get('title', 'Untitled')}' is due today",
                    "icon": "calendar"
                }
                add_notification(notif_data, project_name)
                print(f"   ✅ Created deadline today notification for user {user_id}")

def check_and_create_deadline_notifications():
    """
    Check for tasks with upcoming deadlines and create notifications:
    - 1 day before the deadline
    - On the deadline day
    """
    # Get current SGT date (UTC+8)
    now = dt.datetime.utcnow() + dt.timedelta(hours=8)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow = today + dt.timedelta(days=1)

    print(f"🔍 Checking deadlines - Today: {today.date()}, Tomorrow: {tomorrow.date()}")

    # Query all projects
    projects_ref = db.collection("projects")
    projects = projects_ref.stream()

    project_count = 0
    task_count = 0
    notification_count = 0

    for project_doc in projects:
        project_count += 1
        project = project_doc.to_dict()
        project_id = project_doc.id
        project_name = project.get("name", "Unknown Project")

        # Query tasks for this project
        tasks_ref = db.collection("projects").document(project_id).collection("tasks")
        tasks = tasks_ref.stream()

        for task_doc in tasks:
            task = task_doc.to_dict()
            task_id = task_doc.id
            task_count += 1

            # Skip completed tasks
            if task.get("status", "").lower() == "completed":
                continue

            due_date_str = task.get("dueDate")
            if not due_date_str:
                continue

            # Parse due date
            try:
                # Handle ISO format or Firestore timestamp
                if isinstance(due_date_str, str):
                    due_date = dt.datetime.fromisoformat(due_date_str.replace("Z", "+00:00"))
                else:
                    # Firestore timestamp
                    due_date = due_date_str.todate() if hasattr(due_date_str, 'todate') else due_date_str

                # Convert to SGT (UTC+8) before extracting date
                if hasattr(due_date, 'replace'):
                    due_date_sgt = due_date + dt.timedelta(hours=8)
                    due_date = due_date_sgt.replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=None)

                print(f"   Task '{task.get('title', 'Untitled')}' due: {due_date.date()}")
            except Exception as e:
                print(f"   ⚠️  Failed to parse date for task {task.get('title', 'Untitled')}: {e}")
                continue

            assignee_id = task.get("assigneeId")
            collaborator_ids = task.get("collaboratorsIds", [])

            # Check if notification already exists for this task and type
            def notification_exists(user_id, notif_type):
                existing = db.collection("notifications").where(
                    "taskId", "==", task_id
                ).where(
                    "userId", "==", user_id
                ).where(
                    "type", "==", notif_type
                ).limit(1).stream()
                return len(list(existing)) > 0

            # Create notification for 1 day before deadline
            if due_date == tomorrow:
                print(f"   ✅ Task due tomorrow! Creating notification...")
                notif_type = "deadline_reminder"
                users_to_notify = [assignee_id] + (collaborator_ids if collaborator_ids else [])

                for user_id in users_to_notify:
                    if user_id and not notification_exists(user_id, notif_type):
                        notif_data = {
                            "projectId": project_id,
                            "projectName": project_name,
                            "taskId": task_id,
                            "title": task.get("title", "Untitled Task"),
                            "description": task.get("description", ""),
                            "userId": user_id,
                            "dueDate": due_date_str,
                            "priority": task.get("priority"),
                            "status": task.get("status"),
                            "type": notif_type,
                            "message": f"Task '{task.get('title', 'Untitled')}' is due tomorrow",
                            "icon": "calendar"
                        }
                        add_notification(notif_data, project_name)
                        notification_count += 1
                        print(f"      📬 Created notification for user {user_id}")
                    elif user_id:
                        print(f"      ℹ️  Notification already exists for user {user_id}")

            # Create notification on deadline day
            elif due_date == today:
                print(f"   ⚠️  Task due today! Creating notification...")
                notif_type = "deadline_today"
                users_to_notify = [assignee_id] + (collaborator_ids if collaborator_ids else [])

                for user_id in users_to_notify:
                    if user_id and not notification_exists(user_id, notif_type):
                        notif_data = {
                            "projectId": project_id,
                            "projectName": project_name,
                            "taskId": task_id,
                            "title": task.get("title", "Untitled Task"),
                            "description": task.get("description", ""),
                            "userId": user_id,
                            "dueDate": due_date_str,
                            "priority": task.get("priority"),
                            "status": task.get("status"),
                            "type": notif_type,
                            "message": f"Task '{task.get('title', 'Untitled')}' is due today",
                            "icon": "calendar"
                        }
                        add_notification(notif_data, project_name)
                        notification_count += 1
                        print(f"      📬 Created notification for user {user_id}")
                    elif user_id:
                        print(f"      ℹ️  Notification already exists for user {user_id}")

    print(f"\n📊 Summary:")
    print(f"   Projects checked: {project_count}")
    print(f"   Tasks checked: {task_count}")
    print(f"   Notifications created: {notification_count}")

if __name__ == "__main__":
    check_and_create_deadline_notifications()
