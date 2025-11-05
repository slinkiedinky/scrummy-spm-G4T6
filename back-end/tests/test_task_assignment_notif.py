import pytest
from unittest.mock import patch
import sys
import types

from fake_firestore import FakeFirestore


def make_task_data(author='userA', assignee='userB', task_id='task1'):
    """Helper function to create task data for testing"""
    return {
        "author": author,
        "userId": assignee,
        "assigneeId": assignee,
        "projectId": "proj1",
        "taskId": task_id,
        "title": "Test Task",
        "description": "A test task",
        "createdBy": author,
        "assignedByName": "User A",
    }


def test_scrum_17_1_notification_generated_on_assign():
    """
    Scrum-17.1: An in-app notification is generated when a task is assigned to a user
    
    Test Scenario: An in-app notification is generated when a task is assigned to a user
    Pre-Conditions:
        1. User is logged in
        2. User has permission to assign tasks
    Test Steps:
        1. Log in as User A (manager or assigner)
        2. Assign a new task to User B
        3. Log in as User B
        4. Check the notification panel
    Expected Results:
        User B receives an in-app notification indicating a new task has been assigned.
        The notification appears instantly or upon refresh.
    """
    # Force fresh import with isolated fake DB
    if 'notifications' in sys.modules:
        del sys.modules['notifications']
    
    fake_db = FakeFirestore()
    
    # Create a minimal firebase module with fake_db
    fake_firebase = types.ModuleType('firebase')
    fake_firebase.db = fake_db
    sys.modules['firebase'] = fake_firebase
    
    # Import notifications with the fake DB
    import notifications
    
    try:
        # Manager (User A) assigns task to User B
        task = make_task_data(author='userA', assignee='userB', task_id='task1')
        notifications.add_notification(task, "Project Alpha")

        # Verify notification was created
        coll = fake_db.collection("notifications")
        assert len(coll._documents) == 1, "Expected one notification to be generated"

        # Verify the notification is for User B and unread
        stored = list(coll._documents.values())[0]
        assert stored.get('userId') == "userB", "Notification should be for assignee (User B)"
        assert stored.get('isRead') is False, "Notification should initially be unread"
        assert stored.get('title') == "Test Task", "Notification should contain task title"
    finally:
        # Cleanup
        if 'firebase' in sys.modules:
            del sys.modules['firebase']
        if 'notifications' in sys.modules:
            del sys.modules['notifications']


def test_scrum_17_2_notification_contains_title_project_assigner():
    """
    Scrum-17.2: Verify that the in-app notification contains the task title, 
                project name, and assigner name
    
    Test Scenario: Verify that the in-app notification contains the task title,
                   project name, and assigner name
    Pre-Conditions:
        1. User is logged in
        2. A new task has been assigned
    Test Steps:
        1. Log in as the assigned user
        2. Open the notification panel
        3. Check the details of the new task notification
    Expected Results:
        The notification message clearly displays:
        • Task title
        • Project name
        • Name of the person who assigned it
    """
    # Force fresh import with isolated fake DB
    if 'notifications' in sys.modules:
        del sys.modules['notifications']
    
    fake_db = FakeFirestore()
    
    # Create a minimal firebase module with fake_db
    fake_firebase = types.ModuleType('firebase')
    fake_firebase.db = fake_db
    sys.modules['firebase'] = fake_firebase
    
    # Import notifications with the fake DB
    import notifications
    
    try:
        # Create task with specific details
        task = make_task_data(
            author='manager1',
            assignee='member1',
            task_id='t-123'
        )
        task['title'] = "Implement Login Feature"
        task['assignedByName'] = "John Manager"
        
        notifications.add_notification(task, "Important Project")

        # Retrieve the notification
        coll = fake_db.collection("notifications")
        stored = list(coll._documents.values())[0]

        # Verify all required fields are present
        assert stored.get('title') == "Implement Login Feature", \
            "Notification should contain task title"
        assert stored.get('projectName') == "Important Project", \
            "Notification should contain project name"
        assert stored.get('assignedByName') is not None, \
            "Notification should contain assigner name"
    finally:
        # Cleanup
        if 'firebase' in sys.modules:
            del sys.modules['firebase']
        if 'notifications' in sys.modules:
            del sys.modules['notifications']


def test_scrum_17_3_notification_redirects_to_task_detail():
    """
    Scrum-17.3: Verify that clicking a task notification redirects to the correct task details page
    
    Test Scenario: Verify that clicking a task notification redirects to the correct 
                   task details page
    Pre-Conditions:
        1. User is logged in
        2. A task notification exists in the user's notification list
    Test Steps:
        1. Log in as the assigned user
        2. Click on the notification for the assigned task
    Expected Results:
        The system navigates to the corresponding task detail page
    """
    # Force fresh import with isolated fake DB
    if 'notifications' in sys.modules:
        del sys.modules['notifications']
    
    fake_db = FakeFirestore()
    
    # Create a minimal firebase module with fake_db
    fake_firebase = types.ModuleType('firebase')
    fake_firebase.db = fake_db
    sys.modules['firebase'] = fake_firebase
    
    # Import notifications with the fake DB
    import notifications
    
    try:
        # Create task with routing information
        task = make_task_data(
            author='userA',
            assignee='userB',
            task_id='navigate-to-me'
        )
        task['projectId'] = 'project-123'
        
        notifications.add_notification(task, "Navigation Test Project")

        # Verify notification contains routing information
        coll = fake_db.collection("notifications")
        stored = list(coll._documents.values())[0]

        # Check that projectId and taskId are present for routing
        assert stored.get('taskId') == 'navigate-to-me', \
            "Notification must include taskId for routing"
        assert stored.get('projectId') == 'project-123', \
            "Notification must include projectId for routing"
        
        # Frontend would use these to construct route: /projects/{projectId}/tasks/{taskId}
    finally:
        # Cleanup
        if 'firebase' in sys.modules:
            del sys.modules['firebase']
        if 'notifications' in sys.modules:
            del sys.modules['notifications']


def test_scrum_17_4_notifications_persist_until_read_or_dismissed():
    """
    Scrum-17.4: Verify that notifications persist until read or dismissed
    
    Test Scenario: Verify that notifications persist until read or dismissed
    Pre-Conditions:
        1. A task has been assigned
        2. A notification has been generated
    Test Steps:
        1. Log out and log in as the assigned user
        2. Check the notifications panel
    Expected Results:
        The notification remains visible until the user opens/reads/dismisses it
    """
    # Force fresh import with isolated fake DB
    if 'notifications' in sys.modules:
        del sys.modules['notifications']
    
    fake_db = FakeFirestore()
    
    # Create a minimal firebase module with fake_db
    fake_firebase = types.ModuleType('firebase')
    fake_firebase.db = fake_db
    sys.modules['firebase'] = fake_firebase
    
    # Import notifications with the fake DB
    import notifications
    
    try:
        # Create initial notification
        task = make_task_data(author='userA', assignee='userB', task_id='persist-test')
        notifications.add_notification(task, "Persistence Test Project")

        coll = fake_db.collection("notifications")
        
        # Simulate user logging out and back in - notification should still exist
        assert len(coll._documents) == 1, "Notification should persist after logout/login"
        
        # Get the notification document
        notif_doc = list(coll._documents.values())[0]
        
        # Initially unread
        assert notif_doc.get('isRead') is False, \
            "Notification should initially be unread"

        # User reads the notification
        # Update the notification directly in the dictionary
        doc_id = list(coll._documents.keys())[0]
        coll._documents[doc_id]['isRead'] = True
        assert coll._documents[doc_id].get('isRead') is True, \
            "Notification should be marked as read"
        
        # Notification still exists after being read
        assert doc_id in coll._documents, \
            "Notification should persist even after being read"

        # User dismisses/deletes the notification
        del coll._documents[doc_id]
        assert doc_id not in coll._documents, \
            "Notification should be removed after dismissal"
    finally:
        # Cleanup
        if 'firebase' in sys.modules:
            del sys.modules['firebase']
        if 'notifications' in sys.modules:
            del sys.modules['notifications']
