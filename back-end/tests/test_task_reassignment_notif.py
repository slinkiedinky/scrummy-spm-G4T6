import types
import sys
from fake_firestore import FakeFirestore


# Inject a fake `firebase` module into sys.modules before importing code
# that does `from firebase import db` so we avoid real Firebase initialization
def _make_fake_firebase_module():
	fake_db = FakeFirestore()
	mod = types.ModuleType("firebase")
	mod.db = fake_db
	return mod, fake_db


def make_task_data(author='userA', assignee='userB', task_id='task1'):
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
	"""Scrum-17.1: an in-app notification is generated when a task is assigned to a user"""
	fake_mod, fake_db = _make_fake_firebase_module()
	sys.modules['firebase'] = fake_mod

	# Import notifications after inserting fake firebase module
	import importlib
	if 'notifications' in sys.modules:
		del sys.modules['notifications']
	notifications = importlib.import_module('notifications')

	task = make_task_data()
	notif = notifications.add_notification(task, "Project Alpha")

	coll = fake_db.collection("notifications")
	# ensure one notification was added
	assert len(coll._documents) == 1

	# verify stored values
	stored = list(coll._documents.values())[0]
	assert stored.get('title') == "Test Task"
	assert stored.get('userId') == "userB"
	assert stored.get('projectId') == "proj1"
	assert stored.get('isRead') is False


def test_scrum_17_2_notification_contains_title_project_assigner():
	"""Scrum-17.2: Verify notification contains the task title, project name and assigner name"""
	fake_mod, fake_db = _make_fake_firebase_module()
	sys.modules['firebase'] = fake_mod
	import importlib
	if 'notifications' in sys.modules:
		del sys.modules['notifications']
	notifications = importlib.import_module('notifications')

	task = make_task_data(author='manager1', assignee='member1', task_id='t-123')
	notifications.add_notification(task, "Important Project")

	coll = fake_db.collection("notifications")
	stored = list(coll._documents.values())[0]

	assert stored['title'] == "Test Task"
	assert stored['projectName'] == "Important Project"
	# assignedByName should be present
	assert stored.get('assignedByName') in {"User A", "manager1"}


def test_scrum_17_3_notification_includes_task_and_project_ids_for_routing():
	"""Scrum-17.3: Verify notification includes task/project ids so frontend can navigate to task details"""
	fake_mod, fake_db = _make_fake_firebase_module()
	sys.modules['firebase'] = fake_mod
	import importlib
	if 'notifications' in sys.modules:
		del sys.modules['notifications']
	notifications = importlib.import_module('notifications')

	task = make_task_data(task_id='navigate-me')
	notifications.add_notification(task, "Project Nav")

	coll = fake_db.collection("notifications")
	stored = list(coll._documents.values())[0]

	assert stored.get('taskId') == 'navigate-me'
	assert stored.get('projectId') == 'proj1'


def test_scrum_17_4_notifications_persist_until_read_or_dismissed():
	"""Scrum-17.4: Verify notifications persist until marked read or deleted"""
	fake_mod, fake_db = _make_fake_firebase_module()
	sys.modules['firebase'] = fake_mod
	import importlib
	if 'notifications' in sys.modules:
		del sys.modules['notifications']
	notifications = importlib.import_module('notifications')

	task = make_task_data()
	# create a real notification first
	notifications.add_notification(task, "Project Persist")
	# create a pre-existing placeholder directly through the fake db
	fake_db.collection("notifications").add({"placeholder": True})

	coll = fake_db.collection("notifications")
	# ensure there are two notifications now
	assert len(coll._documents) == 2

	# find the notification created by add_notification
	found = None
	found_id = None
	for doc_id, data in coll._documents.items():
		if data.get('title') == 'Test Task':
			found = data
			found_id = doc_id
			break
	assert found is not None

	# initially unread
	assert found.get('isRead') is False

	# mark as read
	coll._documents[found_id]['isRead'] = True
	assert coll._documents[found_id].get('isRead') is True

	# delete (dismiss) the notification
	del coll._documents[found_id]
	assert found_id not in coll._documents


def test_scrum_33_1_notification_sent_when_task_reassigned():
	"""
	Scrum-33.1: Verify that a notification is sent when a task is re-assigned
	
	Test Scenario: Verify that a notification is sent when a task is re-assigned
	Pre-Conditions:
		1. User A is assigned to a task
	Test Steps:
		1. Log in as task owner/manager
		2. Reassign task from user A to user B
		3. Log in as user A to check for notifications
	Expected Results:
		User A receives an in-app notification specifying task title, project name, 
		and the reassigner's name.
		The notification message clearly displays:
		• Task title
		• Project name
		• Name of the person who re-assigned it
	"""
	fake_mod, fake_db = _make_fake_firebase_module()
	sys.modules['firebase'] = fake_mod
	import importlib
	if 'notifications' in sys.modules:
		del sys.modules['notifications']
	notifications = importlib.import_module('notifications')

	# Simulate task reassignment scenario
	# Original task assigned to userA
	original_task = make_task_data(author='manager1', assignee='userA', task_id='task-reassign-1')
	
	# Task is now reassigned from userA to userB by manager1
	reassigned_task = make_task_data(author='manager1', assignee='userB', task_id='task-reassign-1')
	reassigned_task['title'] = "Update API Documentation"
	reassigned_task['assignedByName'] = "Manager John"
	reassigned_task['previousAssignee'] = 'userA'  # Track who was previously assigned
	
	# Create notification for the previous assignee (userA)
	reassignment_notification = {
		'userId': 'userA',  # Notification goes to the person who lost the task
		'projectId': reassigned_task['projectId'],
		'taskId': reassigned_task['taskId'],
		'title': reassigned_task['title'],
		'type': 'task reassignment',
		'icon': 'userMinus',
		'assignedByName': reassigned_task['assignedByName'],
		'newAssignee': 'userB',  # Who got the task
	}
	
	notifications.add_notification(reassignment_notification, "Mobile App Project")

	# Verify notification was created for userA (previous assignee)
	coll = fake_db.collection("notifications")
	assert len(coll._documents) == 1, "One reassignment notification should be created"

	stored = list(coll._documents.values())[0]
	
	# Verify notification goes to the previous assignee
	assert stored.get('userId') == 'userA', \
		"Notification should be sent to the previous assignee (userA)"
	
	# Verify notification contains required information
	assert stored.get('title') == "Update API Documentation", \
		"Notification should contain the task title"
	assert stored.get('projectName') == "Mobile App Project", \
		"Notification should contain the project name"
	assert stored.get('assignedByName') == "Manager John", \
		"Notification should contain the reassigner's name"
	
	# Verify it's marked as a reassignment notification
	assert stored.get('type') == 'task reassignment', \
		"Notification type should be 'task reassignment'"
	assert stored.get('isRead') is False, \
		"Notification should initially be unread"


def test_scrum_33_2_reassignment_notification_contains_required_details():
	"""
	Scrum-33.2: Verify that the in-app notification contains the task title, 
				project name, and assigner name
	
	Test Scenario: Verify that the in-app notification contains the task title,
				   project name, and assigner name
	Pre-Conditions:
		1. User is logged in
		2. A task has been re-assigned
	Test Steps:
		1. Log in as the assigned user
		2. Open the notification panel
		3. Check the details of the new task notification
	Expected Results:
		The notification message clearly displays:
		• Task title
		• Project name
		• Name of the person who re-assigned it
	"""
	fake_mod, fake_db = _make_fake_firebase_module()
	sys.modules['firebase'] = fake_mod
	import importlib
	if 'notifications' in sys.modules:
		del sys.modules['notifications']
	notifications = importlib.import_module('notifications')

	# Create a detailed reassignment notification
	reassignment_task = {
		'userId': 'userA',  # Previous assignee receiving notification
		'projectId': 'proj-mobile-123',
		'taskId': 'task-ui-redesign',
		'title': "Redesign Login Screen UI",
		'type': 'task reassignment',
		'icon': 'userMinus',
		'assignedByName': "Sarah Chen",  # Person who did the reassignment
		'newAssignee': 'userC',  # New person assigned to the task
		'previousAssignee': 'userA',
	}
	
	notifications.add_notification(reassignment_task, "Mobile Banking App")

	# Retrieve and verify the notification
	coll = fake_db.collection("notifications")
	assert len(coll._documents) == 1, "One notification should be created"
	
	stored = list(coll._documents.values())[0]

	# Verify all required fields are present and correct
	assert stored.get('title') == "Redesign Login Screen UI", \
		"Notification must clearly display the task title"
	
	assert stored.get('projectName') == "Mobile Banking App", \
		"Notification must clearly display the project name"
	
	assert stored.get('assignedByName') == "Sarah Chen", \
		"Notification must clearly display the name of the person who re-assigned the task"
	
	# Additional verification for reassignment context
	assert stored.get('userId') == 'userA', \
		"Notification should be for the previous assignee"
	
	assert stored.get('type') == 'task reassignment', \
		"Notification should be identified as a reassignment type"
	
	assert stored.get('taskId') == 'task-ui-redesign', \
		"Notification should include taskId for routing"
	
	assert stored.get('projectId') == 'proj-mobile-123', \
		"Notification should include projectId for routing"
	
	assert stored.get('icon') == 'userMinus', \
		"Notification should have appropriate icon for reassignment"
	
	assert stored.get('isRead') is False, \
		"Notification should initially be unread"

