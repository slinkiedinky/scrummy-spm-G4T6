from firebase import db
import datetime as dt

def add_notification(task_data, project_name):
    now = dt.datetime.utcnow().isoformat() + "Z"
    notif = {
        "projectId": task_data.get("projectId"),
        "projectName": project_name,
        "taskId": task_data.get("taskId"),
        "title": task_data.get("title"),
        "description": task_data.get("description"),
        "assigneeId": task_data.get("assigneeId"),
        "userId": task_data.get("userId"),
        "createdBy": task_data.get("createdBy"),
        "assignedByName": task_data.get("assignedByName", ""),
        "dueDate": task_data.get("dueDate"),
        "priority": task_data.get("priority"),
        "status": task_data.get("status"),
        "tags": task_data.get("tags"),
        "createdAt": now,
        "isRead": False,
        "type": task_data.get("type", "")
    }
    db.collection("notifications").add(notif)
    return notif