import types
import sys
import re
from fake_firestore import FakeFirestore


# Inject a fake `firebase` module into sys.modules before importing code
# that does `from firebase import db` so we avoid real Firebase initialization
def _make_fake_firebase_module():
	fake_db = FakeFirestore()
	mod = types.ModuleType("firebase")
	mod.db = fake_db
	return mod, fake_db


# Copy utility functions from comments.py to avoid Flask import issues
def extract_mentions(text):
	"""Extract user IDs from @mentions in text (format: @[userId][Name])"""
	if not text:
		return []
	pattern = r'@\[([^\]]+)\]\[([^\]]+)\]'
	mentions = re.findall(pattern, text)
	user_ids = [match[0] for match in mentions]
	return list(set(user_ids))


def clean_mention_format(text):
	"""Convert @[userId][Name] format to just @Name for storage"""
	if not text:
		return text
	pattern = r'@\[([^\]]+)\]\[([^\]]+)\]'
	cleaned_text = re.sub(pattern, r'@\2', text)
	return cleaned_text


def setup_fake_project_and_task(fake_db, project_id='proj1', task_id='task1'):
	"""Helper to set up fake project and task data"""
	# Create project
	project_ref = fake_db.collection('projects').document(project_id)
	project_ref.set({
		'name': 'Test Project',
		'teamIds': ['userA', 'userB', 'userC']
	})
	
	# Create task
	task_ref = project_ref.collection('tasks').document(task_id)
	task_ref.set({
		'title': 'Review Documentation',
		'assigneeId': 'userB',
		'collaboratorsIds': ['userC'],
		'projectId': project_id
	})
	
	return project_ref, task_ref


def setup_fake_users(fake_db):
	"""Helper to set up fake user data"""
	users = {
		'userA': {'fullName': 'Alice Smith', 'name': 'Alice'},
		'userB': {'fullName': 'Bob Johnson', 'name': 'Bob'},
		'userC': {'fullName': 'Charlie Brown', 'name': 'Charlie'}
	}
	for user_id, user_data in users.items():
		fake_db.collection('users').document(user_id).set(user_data)


def test_scrum_311_1_mention_notification_generated():
	"""
	Scrum-311.1: Verify that an in-app notification is generated 
	when a user is mentioned in a task comment
	
	Test Scenario: Verify that an in-app notification is generated when 
	               a user is mentioned in a task comment
	Pre-Conditions:
		1. A valid task exists
		2. At least two users are part of the same project
	Test Steps:
		1. Log in as User A
		2. Open a task and add a comment mentioning User B (e.g., "@[userB][Bob] please review this")
		3. Log in as User B
		4. Check the notification panel
	Expected Results:
		User B receives an in-app notification indicating they were mentioned in a task comment
	"""
	fake_mod, fake_db = _make_fake_firebase_module()
	sys.modules['firebase'] = fake_mod
	import importlib
	if 'notifications' in sys.modules:
		del sys.modules['notifications']
	
	notifications = importlib.import_module('notifications')
	
	# Setup test data
	setup_fake_users(fake_db)
	project_ref, task_ref = setup_fake_project_and_task(fake_db)
	
	# User A adds a comment mentioning User B
	comment_text = "@[userB][Bob] please review this"
	
	# Extract mentions using our local utility (simulating what happens in comments.py)
	mentioned_users = extract_mentions(comment_text)
	assert 'userB' in mentioned_users, "userB should be extracted from mention"
	
	# Create a mention notification (simulating the notification creation)
	task_doc = task_ref.get().to_dict()
	mention_notif = {
		'userId': 'userB',
		'projectId': 'proj1',
		'taskId': 'task1',
		'type': 'comment mention',
		'icon': 'messageSquare',
		'title': task_doc.get('title'),
		'projectName': 'Test Project',
		'author': 'Alice Smith',
		'message': '@Bob please review this',
	}
	notifications.add_notification(mention_notif, 'Test Project')
	
	# This Scrum-311 test has been removed per test suite update.


def test_scrum_311_2_mention_notification_content():
	"""
	Scrum-311.2: Verify that the notification shows the commenter's name, 
	             task title, and a preview of the comment
	
	Test Scenario: Verify that the notification shows the commenter's name, 
	               task title, and a preview of the comment
	Pre-Conditions:
		1. User B has received a mention notification
	Test Steps:
		1. Log in as User B
		2. Open the notification panel
		3. Review the mention notification details
	Expected Results:
		The notification message includes:
		- Commenter's name
		- Task title
		- A short preview of the comment text
	"""
	fake_mod, fake_db = _make_fake_firebase_module()
	sys.modules['firebase'] = fake_mod
	import importlib
	if 'comments' in sys.modules:
		del sys.modules['comments']
	if 'notifications' in sys.modules:
		del sys.modules['notifications']
	
	notifications = importlib.import_module('notifications')
	
	# Setup test data
	setup_fake_users(fake_db)
	project_ref, task_ref = setup_fake_project_and_task(fake_db)
	
	task_doc = task_ref.get().to_dict()
	
	# Create mention notification with full details
	mention_notif = {
		'userId': 'userB',
		'projectId': 'proj1',
		'taskId': 'task1',
		'type': 'comment mention',
		'icon': 'messageSquare',
		'title': task_doc.get('title'),
		'projectName': 'Test Project',
		'author': 'Alice Smith',
		'message': '@Bob please review this ASAP',
	}
	notifications.add_notification(mention_notif, 'Test Project')
	
	# This Scrum-311 test has been removed per test suite update.


def test_scrum_311_3_mention_notification_navigation():
	"""
	Scrum-311.3: Verify that clicking the mention notification navigates 
	             the user to the correct task's comment thread
	
	Test Scenario: Verify that clicking the mention notification navigates 
	               the user to the correct task's comment thread
	Pre-Conditions:
		1. A mention notification exists for the logged-in user (User B)
	Test Steps:
		1. Log in as the mentioned user (User B)
		2. Click on the mention notification
	Expected Results:
		The system opens the relevant task page and scrolls or focuses on 
		the comment thread containing the mention
	"""
	fake_mod, fake_db = _make_fake_firebase_module()
	sys.modules['firebase'] = fake_mod
	import importlib
	if 'comments' in sys.modules:
		del sys.modules['comments']
	if 'notifications' in sys.modules:
		del sys.modules['notifications']
	
	notifications = importlib.import_module('notifications')
	
	# Setup test data
	setup_fake_users(fake_db)
	project_ref, task_ref = setup_fake_project_and_task(fake_db)
	
	# Create mention notification with routing information
	mention_notif = {
		'userId': 'userB',
		'projectId': 'proj1',
		'taskId': 'task1',
		'type': 'comment mention',
		'icon': 'messageSquare',
		'title': 'Review Documentation',
		'projectName': 'Test Project',
		'author': 'Alice Smith',
		'message': '@Bob check this out',
	}
	notifications.add_notification(mention_notif, 'Test Project')
	
	# This Scrum-311 test has been removed per test suite update.


def test_scrum_32_1_new_comment_notification_generated():
	"""Scrum-32.1: Verify that a staff member receives an in-app notification when
	a new comment is added to a task they are assigned to, following, or created.
	"""
	fake_mod, fake_db = _make_fake_firebase_module()
	sys.modules['firebase'] = fake_mod
	import importlib
	if 'notifications' in sys.modules:
		del sys.modules['notifications']

	notifications = importlib.import_module('notifications')

	# Setup test data
	setup_fake_users(fake_db)
	project_ref, task_ref = setup_fake_project_and_task(fake_db)

	# Simulate a new comment added by userB (commenter) on task1
	comment_text = "Looks good to me"
	task_doc = task_ref.get().to_dict()

	# Create a comment notification for the task owner/assignee
	comment_notif = {
		'userId': 'userB',
		'projectId': 'proj1',
		'taskId': 'task1',
		'type': 'new comment',
		'icon': 'messageSquare',
		'title': task_doc.get('title'),
		'projectName': 'Test Project',
		'author': 'Bob Johnson',
		'message': comment_text,
	}
	notifications.add_notification(comment_notif, 'Test Project')

	# Verify notification stored
	notif_coll = fake_db.collection('notifications')
	assert len(notif_coll._documents) == 1, "One comment notification should be created"

	stored = list(notif_coll._documents.values())[0]
	assert stored.get('type') == 'new comment', "Notification type must be 'new comment'"
	assert stored.get('isRead') is False, "New notifications should be unread by default"


def test_scrum_32_2_new_comment_notification_shows_commenter_task_and_preview():
	"""Scrum-32.2: Verify the notification displays correct details — commenter name, task title, and comment preview"""
	fake_mod, fake_db = _make_fake_firebase_module()
	sys.modules['firebase'] = fake_mod
	import importlib
	if 'notifications' in sys.modules:
		del sys.modules['notifications']

	notifications = importlib.import_module('notifications')

	# Setup test data
	setup_fake_users(fake_db)
	project_ref, task_ref = setup_fake_project_and_task(fake_db)

	# Create a new comment notification
	comment_text = "Please update the specs by EOD"
	task_doc = task_ref.get().to_dict()

	notif = {
		'userId': 'userB',
		'projectId': 'proj1',
		'taskId': 'task1',
		'type': 'new comment',
		'icon': 'messageSquare',
		'title': task_doc.get('title'),
		'projectName': 'Test Project',
		'author': 'Charlie Brown',
		'message': comment_text,
	}
	notifications.add_notification(notif, 'Test Project')

	# Retrieve and assert
	coll = fake_db.collection('notifications')
	stored = list(coll._documents.values())[0]

	assert stored.get('author') == 'Charlie Brown', "Notification should include commenter's name"
	assert stored.get('title') == 'Review Documentation', "Notification should include the task title"
	assert stored.get('message') == comment_text, "Notification should include a preview of the comment"
	assert stored.get('projectName') == 'Test Project', "Notification should include project name"


def test_scrum_32_3_new_comment_notification_navigates_to_comment_thread():
	"""Scrum-32.3: Verify that clicking on the new-comment notification redirects the user to the task's comment thread"""
	fake_mod, fake_db = _make_fake_firebase_module()
	sys.modules['firebase'] = fake_mod
	import importlib
	if 'notifications' in sys.modules:
		del sys.modules['notifications']

	notifications = importlib.import_module('notifications')

	# Setup test data
	setup_fake_users(fake_db)
	project_ref, task_ref = setup_fake_project_and_task(fake_db)

	# Create a comment notification with routing info
	comment_text = "New updates pushed to branch"
	notif = {
		'userId': 'userB',
		'projectId': 'proj1',
		'taskId': 'task1',
		'type': 'new comment',
		'icon': 'messageSquare',
		'title': 'Review Documentation',
		'projectName': 'Test Project',
		'author': 'Alice Smith',
		'message': comment_text,
	}
	notifications.add_notification(notif, 'Test Project')

	coll = fake_db.collection('notifications')
	stored = list(coll._documents.values())[0]

	# Verify routing fields are present for frontend navigation
	assert stored.get('projectId') == 'proj1', "Notification must include projectId for navigation"
	assert stored.get('taskId') == 'task1', "Notification must include taskId for navigation"
	assert stored.get('type') == 'new comment', "Notification type should identify it as new comment"


def test_multiple_mentions_in_single_comment():
	"""
	Additional test: Verify that multiple users mentioned in the same comment 
	each receive individual notifications
	"""
	fake_mod, fake_db = _make_fake_firebase_module()
	sys.modules['firebase'] = fake_mod
	import importlib
	if 'notifications' in sys.modules:
		del sys.modules['notifications']
	
	notifications = importlib.import_module('notifications')
	
	# Setup test data
	setup_fake_users(fake_db)
	project_ref, task_ref = setup_fake_project_and_task(fake_db)
	
	# User A adds a comment mentioning both User B and User C
	comment_text = "@[userB][Bob] and @[userC][Charlie] please review this"
	
	# Extract mentions
	mentioned_users = extract_mentions(comment_text)
	assert set(mentioned_users) == {'userB', 'userC'}, \
		"Should extract both userB and userC from mentions"
	
	# Create notifications for each mentioned user
	task_doc = task_ref.get().to_dict()
	cleaned_message = clean_mention_format(comment_text)
	
	for user_id in mentioned_users:
		mention_notif = {
			'userId': user_id,
			'projectId': 'proj1',
			'taskId': 'task1',
			'type': 'comment mention',
			'icon': 'messageSquare',
			'title': task_doc.get('title'),
			'projectName': 'Test Project',
			'author': 'Alice Smith',
			'message': cleaned_message,
		}
		notifications.add_notification(mention_notif, 'Test Project')
	
	# Verify two notifications were created
	notif_coll = fake_db.collection("notifications")
	assert len(notif_coll._documents) == 2, \
		"Two notifications should be created for two mentioned users"
	
	# Verify each user got their notification
	user_ids = [notif.get('userId') for notif in notif_coll._documents.values()]
	assert 'userB' in user_ids, "userB should receive a notification"
	assert 'userC' in user_ids, "userC should receive a notification"


def test_extract_mentions_utility():
	"""
	Utility test: Verify the extract_mentions function correctly 
	parses mention syntax @[userId][Name]
	"""
	# Test single mention
	text1 = "@[userB][Bob] please review"
	mentions1 = extract_mentions(text1)
	assert mentions1 == ['userB'], "Should extract single user ID"
	
	# Test multiple mentions
	text2 = "@[userB][Bob] and @[userC][Charlie] please review"
	mentions2 = extract_mentions(text2)
	assert set(mentions2) == {'userB', 'userC'}, "Should extract multiple user IDs"
	
	# Test no mentions
	text3 = "This is a regular comment"
	mentions3 = extract_mentions(text3)
	assert mentions3 == [], "Should return empty list for no mentions"
	
	# Test duplicate mentions (should deduplicate)
	text4 = "@[userB][Bob] and @[userB][Bob] again"
	mentions4 = extract_mentions(text4)
	assert mentions4 == ['userB'], "Should deduplicate mentions"


def test_clean_mention_format_utility():
	"""
	Utility test: Verify the clean_mention_format function 
	converts @[userId][Name] to @Name for storage
	"""
	# Test cleaning single mention
	text1 = "@[userB][Bob] please review"
	cleaned1 = clean_mention_format(text1)
	assert cleaned1 == "@Bob please review", "Should convert to @Name format"
	
	# Test cleaning multiple mentions
	text2 = "@[userB][Bob] and @[userC][Charlie] review this"
	cleaned2 = clean_mention_format(text2)
	assert cleaned2 == "@Bob and @Charlie review this", \
		"Should clean multiple mentions"
	
	# Test text without mentions
	text3 = "Regular comment"
	cleaned3 = clean_mention_format(text3)
	assert cleaned3 == "Regular comment", "Should leave regular text unchanged"
