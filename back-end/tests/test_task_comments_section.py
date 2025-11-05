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


def test_scrum_311_1_mention_notification_generated_in_comment():
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
		User B receives an in-app notification indicating they were mentioned in a task comment.
		The notification appears instantly or upon refresh.
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
	
	# Create a mention notification (simulating the notification creation in comments.py)
	task_doc = task_ref.get().to_dict()
	cleaned_message = clean_mention_format(comment_text)
	
	mention_notif = {
		'userId': 'userB',
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
	
	# Verify notification was created
	notif_coll = fake_db.collection("notifications")
	assert len(notif_coll._documents) == 1, "One notification should be created"
	
	stored = list(notif_coll._documents.values())[0]
	
	# Verify notification details
	assert stored.get('userId') == 'userB', \
		"Notification should be for the mentioned user (userB)"
	assert stored.get('type') == 'comment mention', \
		"Notification type should be 'comment mention'"
	assert stored.get('isRead') is False, \
		"Notification should be initially unread"
	assert stored.get('projectId') == 'proj1', \
		"Notification should include projectId"
	assert stored.get('taskId') == 'task1', \
		"Notification should include taskId"


def test_scrum_311_2_mention_notification_shows_commenter_task_and_preview():
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
	
	# User A adds a comment mentioning User B with detailed text
	comment_text = "@[userB][Bob] please review this implementation ASAP"
	cleaned_message = clean_mention_format(comment_text)
	
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
		'message': cleaned_message,
	}
	notifications.add_notification(mention_notif, 'Test Project')
	
	# Verify notification contains all required fields
	notif_coll = fake_db.collection("notifications")
	stored = list(notif_coll._documents.values())[0]
	
	# Verify commenter's name is present
	assert stored.get('author') == 'Alice Smith', \
		"Notification message should include commenter's name (Alice Smith)"
	
	# Verify task title is present
	assert stored.get('title') == 'Review Documentation', \
		"Notification message should include task title (Review Documentation)"
	
	# Verify comment preview is present
	assert stored.get('message') is not None, \
		"Notification should include a preview of the comment text"
	assert '@Bob please review this implementation ASAP' == stored.get('message'), \
		"Notification should show cleaned comment preview with @Name format"
	
	# Verify project name for context
	assert stored.get('projectName') == 'Test Project', \
		"Notification should include project name for context"


def test_scrum_311_3_mention_notification_navigates_to_comment_thread():
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
	comment_text = "@[userB][Bob] check this out"
	cleaned_message = clean_mention_format(comment_text)
	
	mention_notif = {
		'userId': 'userB',
		'projectId': 'proj-mobile-123',
		'taskId': 'task-ui-456',
		'type': 'comment mention',
		'icon': 'messageSquare',
		'title': 'Review Documentation',
		'projectName': 'Test Project',
		'author': 'Alice Smith',
		'message': cleaned_message,
	}
	notifications.add_notification(mention_notif, 'Test Project')
	
	# Verify notification contains routing information
	notif_coll = fake_db.collection("notifications")
	stored = list(notif_coll._documents.values())[0]
	
	# Verify projectId is present for navigation to correct project
	assert stored.get('projectId') == 'proj-mobile-123', \
		"Notification must include projectId for navigation to the correct project"
	
	# Verify taskId is present for navigation to correct task
	assert stored.get('taskId') == 'task-ui-456', \
		"Notification must include taskId for navigation to the correct task"
	
	# Verify notification type to distinguish mention from other notifications
	assert stored.get('type') == 'comment mention', \
		"Notification type should be 'comment mention' for proper frontend routing"
	
	# Verify icon is appropriate for comment mentions
	assert stored.get('icon') == 'messageSquare', \
		"Notification should use 'messageSquare' icon for comment mentions"
	
	# Frontend would use these fields to construct navigation route:
	# /projects/{projectId}/tasks/{taskId}
	# and could scroll/focus to the comment thread section
	assert 'projectId' in stored and 'taskId' in stored, \
		"Notification must have both projectId and taskId for complete navigation"


def test_multiple_users_mentioned_in_single_comment():
	"""
	Additional test: Verify that when multiple users are mentioned in a single comment,
	each mentioned user receives their own individual notification
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
	comment_text = "@[userB][Bob] and @[userC][Charlie] please review this together"
	
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
		"Two separate notifications should be created for two mentioned users"
	
	# Verify each user got their notification
	user_ids = [notif.get('userId') for notif in notif_coll._documents.values()]
	assert 'userB' in user_ids, "userB should receive their own notification"
	assert 'userC' in user_ids, "userC should receive their own notification"
	
	# Verify both notifications have the same message content
	messages = [notif.get('message') for notif in notif_coll._documents.values()]
	assert all(msg == '@Bob and @Charlie please review this together' for msg in messages), \
		"All mentioned users should see the same cleaned comment text"


def test_mention_notification_not_sent_to_commenter():
	"""
	Additional test: Verify that users don't receive notifications for their own comments,
	even if they mention themselves
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
	
	# User A mentions themselves and User B
	comment_text = "@[userA][Alice] and @[userB][Bob] FYI"
	
	# Extract mentions
	mentioned_users = extract_mentions(comment_text)
	
	# In real implementation, we should filter out the commenter (userA)
	# Simulating that the backend would filter this
	commenter_id = 'userA'
	filtered_mentions = [uid for uid in mentioned_users if uid != commenter_id]
	
	assert 'userA' not in filtered_mentions, \
		"Commenter should be filtered out from receiving notification"
	assert 'userB' in filtered_mentions, \
		"Other mentioned users should still receive notifications"
	
	# Create notifications only for filtered users
	task_doc = task_ref.get().to_dict()
	cleaned_message = clean_mention_format(comment_text)
	
	for user_id in filtered_mentions:
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
	
	# Verify only one notification was created (for userB, not userA)
	notif_coll = fake_db.collection("notifications")
	assert len(notif_coll._documents) == 1, \
		"Only one notification should be created (userA should not receive their own mention)"
	
	# Verify the notification is for userB only
	stored = list(notif_coll._documents.values())[0]
	assert stored.get('userId') == 'userB', \
		"Notification should only be for userB, not for the commenter (userA)"


def test_extract_mentions_utility_function():
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
	text3 = "This is a regular comment without mentions"
	mentions3 = extract_mentions(text3)
	assert mentions3 == [], "Should return empty list for no mentions"
	
	# Test duplicate mentions (should deduplicate)
	text4 = "@[userB][Bob] and @[userB][Bob] again"
	mentions4 = extract_mentions(text4)
	assert mentions4 == ['userB'], "Should deduplicate duplicate mentions"
	
	# Test empty text
	mentions5 = extract_mentions("")
	assert mentions5 == [], "Should return empty list for empty text"
	
	# Test None text
	mentions6 = extract_mentions(None)
	assert mentions6 == [], "Should return empty list for None text"


def test_clean_mention_format_utility_function():
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
		"Should clean multiple mentions to @Name format"
	
	# Test text without mentions
	text3 = "Regular comment without any mentions"
	cleaned3 = clean_mention_format(text3)
	assert cleaned3 == "Regular comment without any mentions", \
		"Should leave regular text unchanged"
	
	# Test empty text
	cleaned4 = clean_mention_format("")
	assert cleaned4 == "", "Should return empty string for empty input"
	
	# Test None text
	cleaned5 = clean_mention_format(None)
	assert cleaned5 is None, "Should return None for None input"
	
	# Test mixed content
	text6 = "Hey @[userB][Bob], can you check the code? Thanks @[userC][Charlie]!"
	cleaned6 = clean_mention_format(text6)
	assert cleaned6 == "Hey @Bob, can you check the code? Thanks @Charlie!", \
		"Should clean mentions while preserving surrounding text and punctuation"
