# back-end/notifications.py
from firebase import db
from google.cloud import firestore as gcf

def add_notification(task_data: dict, project_name: str):
  notif = {
    "userId": task_data.get("userId"),
    "assigneeId": task_data.get("assigneeId"),
    "projectId": task_data.get("projectId"),
    "projectName": project_name,
    "taskId": task_data.get("taskId"),
    "title": task_data.get("title"),
    "description": task_data.get("description"),
    "dueDate": task_data.get("dueDate"),
    "priority": task_data.get("priority"),
    "status": task_data.get("status"),
    "tags": task_data.get("tags") or [],
    "type": task_data.get("type", ""),
    "icon": task_data.get("icon", "bell"),
    "createdBy": task_data.get("createdBy"),
    "assignedByName": task_data.get("assignedByName"),
    "updatedBy": task_data.get("updatedBy"),
    "updatedByName": task_data.get("updatedByName"),
    "prevStatus": task_data.get("prevStatus"),
    "statusFrom": task_data.get("statusFrom"),
    "statusTo": task_data.get("statusTo"),
    "message": task_data.get("message"),
    "isRead": False,
    "createdAt": gcf.SERVER_TIMESTAMP,  # Timestamp for reliable orderBy
  }
  notif = {k:v for k,v in notif.items() if v is not None}
  ref = db.collection("notifications").add(notif)
  print(f"[notifications.add] created -> {ref[1].id if isinstance(ref, tuple) else ref}")
  return notif
