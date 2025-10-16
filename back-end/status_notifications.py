from typing import Optional, Dict, Any, Iterable
from firebase import db
from notifications import add_notification

def _get_project(project_id: str) -> Optional[Dict[str, Any]]:
    doc = db.collection("projects").document(project_id).get()
    return doc.to_dict() if doc.exists else None

def _get_user_display_name(user_id: str) -> str:
    if not user_id:
        return ""
    try:
        u = db.collection("users").document(user_id).get()
        if u.exists:
            ud = u.to_dict()
            return ud.get("fullName") or ud.get("displayName") or ud.get("name") or user_id
    except Exception:
        pass
    return user_id

def _unique_non_null(iterable: Iterable):
    seen = set()
    for v in iterable:
        if not v:
            continue
        if v in seen:
            continue
        seen.add(v)
        yield v

def create_status_change_notifications(
    project_id: str,
    task_id: str,
    prev_task: Dict[str, Any],
    new_status: str,
    changed_by: Optional[str] = None
):
    """
    Create notifications when a task's status changes.

    Recipients: assignee, project owner, collaborators, AND the user who made the change.
    Message is personalized:
      - For the actor (changed_by): "You changed status from 'old' to 'new'."
      - For others: "<ActorName> changed status from 'old' to 'new'."

    prev_task is the task document BEFORE the update (dict).
    new_status is the updated status string.
    """
    try:
        project = _get_project(project_id) or {}
        project_name = project.get("name", "")
        project_owner = project.get("ownerId") or project.get("createdBy")

        old_status = (prev_task.get("status") or "").strip()
        new_status_clean = (new_status or "").strip()
        if not new_status_clean or old_status.lower() == new_status_clean.lower():
            print(f"[status_notifications] no-op: old==new -> {old_status} == {new_status_clean}")
            return

        print(f"[status_notifications] called: project={project_id} task={task_id} changed_by={changed_by} old='{old_status}' new='{new_status_clean}'")

        assignee = prev_task.get("assigneeId")
        collaborators = prev_task.get("collaboratorsIds", []) or []

        # include changed_by as recipient (per request)
        recipients = list(_unique_non_null([assignee, project_owner] + list(collaborators) + ([changed_by] if changed_by else [])))

        print(f"[status_notifications] recipients (deduped) = {recipients}")

        # Prepare actor display name
        actor_name = _get_user_display_name(changed_by) if changed_by else "Someone"

        if not recipients:
            print("[status_notifications] no recipients found, aborting")
            return

        title = prev_task.get("title", "Untitled Task")
        notif_type = "task status update"

        for user_id in recipients:
            try:
                if not user_id:
                    continue

                # personalize message
                if changed_by and user_id == changed_by:
                    message = f"You changed task status from '{old_status or 'unknown'}' to '{new_status_clean}'."
                else:
                    message = f"{actor_name} changed task status from '{old_status or 'unknown'}' to '{new_status_clean}'."

                # Build notification payload consistent with existing add_notification usage
                notif_data = {
                    "projectId": project_id,
                    "projectName": project_name,
                    "taskId": task_id,
                    "title": title,
                    "description": prev_task.get("description", ""),
                    "userId": user_id,
                    "assigneeId": user_id,
                    "priority": prev_task.get("priority"),
                    "status": new_status_clean,
                    "type": notif_type,
                    "message": message,
                    "icon": "clipboardlist",
                    "meta": {
                        "oldStatus": old_status,
                        "newStatus": new_status_clean,
                        "changedBy": changed_by,
                        "changedByName": actor_name,
                    },
                }

                print(f"[status_notifications] creating notification for user={user_id}")
                add_notification(notif_data, project_name)
                print(f"[status_notifications] created notification for user={user_id}")
            except Exception as e:
                print(f"[status_notifications] error creating notification for {user_id}: {e}")
                # continue with other recipients if one fails
                continue
    except Exception as e:
        print(f"[status_notifications] fatal error: {e}")
        # do not raise to calling flow; notifications are best-effort
        pass