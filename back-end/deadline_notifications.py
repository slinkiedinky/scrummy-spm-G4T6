from firebase import db
import datetime as dt
from notifications import add_notification

def check_and_create_deadline_notifications():
    """
    Check for tasks with upcoming deadlines and create notifications:
    - 1 day before the deadline
    - On the deadline day
    """
    now = dt.datetime.now(dt.timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=None)
    tomorrow = today + dt.timedelta(days=1)
    day_after_tomorrow = today + dt.timedelta(days=2)

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

                # Normalize to UTC date (no time)
                if hasattr(due_date, 'replace'):
                    due_date = due_date.replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=None)

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
