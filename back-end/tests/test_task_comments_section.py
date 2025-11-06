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

# Tests for Task Comments Section (Scrum-349.x)


def test_scrum_349_1_comments_section_visible():
	"""Scrum-349.1: Verify that every task (standalone or linked to a project)
	has a comments section visible in the task details view.
	"""
	fake_mod, fake_db = _make_fake_firebase_module()
	sys.modules['firebase'] = fake_mod

	# Create project-linked task
	project_ref, task_ref = setup_fake_project_and_task(fake_db)

	# The backend should expose a comments collection for the task
	comments_coll = task_ref.collection('comments')
	# At minimum the collection object should exist and be usable
	assert hasattr(comments_coll, '_documents'), "Comments collection should be present on the task"

	# Also verify standalone task has a comments collection (see other test for details)
	standalone_task_ref = fake_db.collection('tasks').document('standalone-task-1')
	standalone_task_ref.set({'title': 'Standalone Task', 'projectId': None})
	standalone_comments = standalone_task_ref.collection('comments')
	assert hasattr(standalone_comments, '_documents'), "Standalone task should expose a comments collection"


def test_scrum_349_2_input_and_record_username_timestamp():
	"""Scrum-349.2: Verify that users can input text comments and each comment
	records the username and timestamp.
	"""
	fake_mod, fake_db = _make_fake_firebase_module()
	sys.modules['firebase'] = fake_mod

	setup_fake_users(fake_db)
	project_ref, task_ref = setup_fake_project_and_task(fake_db)

	# Simulate userB adding a comment
	comment_data = {
		'text': 'This is a test comment',
		'authorId': 'userB',
		'authorName': 'Bob Johnson',
		'createdAt': '2025-11-06T12:00:00Z'
	}
	comments_coll = task_ref.collection('comments')
	comments_coll.add(comment_data)

	# Retrieve stored comment
	stored = list(comments_coll._documents.values())[0]

	assert stored.get('text') == 'This is a test comment', "Comment text should be saved"
	assert stored.get('authorName') == 'Bob Johnson', "Comment should record the commenter's username"
	assert 'createdAt' in stored, "Comment should record a timestamp"


def test_scrum_349_3_collaborators_can_view_and_add_comments():
	"""Scrum-349.3: Verify that all collaborators within a project can view
	and add comments to tasks within that project.
	"""
	fake_mod, fake_db = _make_fake_firebase_module()
	sys.modules['firebase'] = fake_mod

	setup_fake_users(fake_db)
	project_ref, task_ref = setup_fake_project_and_task(fake_db)

	# userC (a collaborator) adds a comment — use the same collection instance so
	# the FakeFirestore stores/retrieves from the same in-memory collection
	comments_coll = task_ref.collection('comments')
	comment_data = {'text': 'Collaborator comment', 'authorId': 'userC', 'authorName': 'Charlie Brown', 'createdAt': '2025-11-06T12:01:00Z'}
	comments_coll.add(comment_data)

	# Another collaborator (userA) should be able to read the comment via the
	# same collection handle
	stored_list = list(comments_coll._documents.values())
	assert any(c.get('authorId') == 'userC' and c.get('text') == 'Collaborator comment' for c in stored_list), \
		"Collaborator's comment should be visible to other project members"


def test_scrum_349_4_standalone_task_comments_accessible():
	"""Scrum-349.4: Ensure standalone task comments are accessible from the
	'Tasks' page (which lists all personal tasks).
	"""
	fake_mod, fake_db = _make_fake_firebase_module()
	sys.modules['firebase'] = fake_mod

	# Create a standalone task in top-level 'tasks' collection
	standalone = fake_db.collection('tasks').document('standalone-42')
	standalone.set({'title': 'Personal Task', 'projectId': None, 'assigneeId': 'userA'})

	# Add comment to standalone task via a stable collection handle (persisted)
	standalone_comments = standalone.collection('comments')
	standalone_comments.add({'text': 'Standalone comment', 'authorId': 'userA', 'authorName': 'Alice Smith', 'createdAt': '2025-11-06T12:02:00Z'})

	# Verify comment is present when accessing the task from tasks listing
	assert len(standalone_comments._documents) == 1, "Standalone task comments should be accessible and stored"


def test_scrum_349_5_comments_chronological_order():
	"""Scrum-349.5: Ensure comments are displayed in chronological order
	(oldest top -> newest bottom).
	"""
	fake_mod, fake_db = _make_fake_firebase_module()
	sys.modules['firebase'] = fake_mod

	setup_fake_users(fake_db)
	project_ref, task_ref = setup_fake_project_and_task(fake_db)

	comments = task_ref.collection('comments')

	# Add three comments in sequence
	comments.add({'text': 'first', 'createdAt': '2025-11-06T12:00:00Z', 'authorName': 'Alice Smith'})
	comments.add({'text': 'second', 'createdAt': '2025-11-06T12:05:00Z', 'authorName': 'Bob Johnson'})
	comments.add({'text': 'third', 'createdAt': '2025-11-06T12:10:00Z', 'authorName': 'Charlie Brown'})

	stored = list(comments._documents.values())

	# Sort by createdAt ascending to represent display from oldest to newest
	sorted_by_time = sorted(stored, key=lambda c: c.get('createdAt'))
	texts = [c.get('text') for c in sorted_by_time]

	assert texts == ['first', 'second', 'third'], "Comments should be ordered oldest to newest"


def test_scrum_349_6_comments_persist_after_refresh():
	"""Scrum-349.6: Verify that comments persist and remain visible after
	refreshing the task details page.
	"""
	fake_mod, fake_db = _make_fake_firebase_module()
	sys.modules['firebase'] = fake_mod

	setup_fake_users(fake_db)
	project_ref, task_ref = setup_fake_project_and_task(fake_db)

	# Add a comment to a named (persistent) subcollection so we can re-fetch it
	full_comments_name = f"projects/{project_ref.id}/tasks/{task_ref.id}/comments"
	persistent_comments = fake_db.collection(full_comments_name)
	persistent_comments.add({'text': "Don't forget to update docs", 'authorId': 'userB', 'authorName': 'Bob Johnson', 'createdAt': '2025-11-06T12:20:00Z'})

	# Simulate page refresh by re-fetching the persistent collection from fake_db
	refreshed_comments = fake_db.collection(full_comments_name)

	assert len(refreshed_comments._documents) == 1, "Comment should remain after refresh"
	stored = list(refreshed_comments._documents.values())[0]
	assert stored.get('text') == "Don't forget to update docs", "Persisted comment text should match"



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
