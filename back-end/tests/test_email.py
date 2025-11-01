"""
Comprehensive tests for functions/main.py
Tests the get_task_digest cloud function and related helper functions.
"""
import os
import sys
import datetime
import pytest
from unittest.mock import Mock, patch, MagicMock, PropertyMock
import json

# Ensure the functions folder is on the import path
ROOT_DIR = os.path.abspath(os.path.dirname(__file__))
FUNCTIONS_DIR = os.path.join(os.path.dirname(ROOT_DIR), 'functions')
if FUNCTIONS_DIR not in sys.path:
    sys.path.insert(0, FUNCTIONS_DIR)

# Create proper mocks for Firebase modules
firebase_functions_mock = MagicMock()
https_fn_mock = MagicMock()
scheduler_fn_mock = MagicMock()
params_mock = MagicMock()

# Setup the mock structure
sys.modules['firebase_functions'] = firebase_functions_mock
sys.modules['firebase_functions.https_fn'] = https_fn_mock
sys.modules['firebase_functions.scheduler_fn'] = scheduler_fn_mock
sys.modules['firebase_functions.params'] = params_mock
firebase_functions_mock.https_fn = https_fn_mock
firebase_functions_mock.scheduler_fn = scheduler_fn_mock
firebase_functions_mock.params = params_mock

# Mock firebase_admin
firebase_admin_mock = MagicMock()
firestore_mock = MagicMock()
sys.modules['firebase_admin'] = firebase_admin_mock
sys.modules['firebase_admin.firestore'] = firestore_mock
firebase_admin_mock.firestore = firestore_mock
firebase_admin_mock.initialize_app = MagicMock()

# Mock google.cloud.firestore
google_cloud_firestore_mock = MagicMock()
sys.modules['google.cloud.firestore'] = google_cloud_firestore_mock
sys.modules['google.cloud'] = MagicMock()

# Setup decorator behavior
https_fn_mock.on_request = lambda *args, **kwargs: lambda func: func
scheduler_fn_mock.on_schedule = lambda *args, **kwargs: lambda func: func
params_mock.SecretParam = lambda x: Mock(value='mock-secret')

# Setup HttpsError
https_fn_mock.HttpsError = type('HttpsError', (Exception,), {
    '__init__': lambda self, code, message: (
        setattr(self, 'code', code),
        setattr(self, 'message', message),
        Exception.__init__(self, message)
    )[2]
})
https_fn_mock.FunctionsErrorCode = MagicMock()
https_fn_mock.FunctionsErrorCode.INVALID_ARGUMENT = 'INVALID_ARGUMENT'
https_fn_mock.FunctionsErrorCode.INTERNAL = 'INTERNAL'
https_fn_mock.FunctionsErrorCode.NOT_FOUND = 'NOT_FOUND'
https_fn_mock.FunctionsErrorCode.FAILED_PRECONDITION = 'FAILED_PRECONDITION'

# Setup Response
https_fn_mock.Response = lambda response, status, mimetype: type('Response', (), {
    'response': response,
    'status': status,
    'mimetype': mimetype
})()

# Now import main after mocking
import main  # noqa: E402


class TestFormatTask:
    """Test the _format_task helper function"""

    def test_format_task_basic(self):
        """Test basic task formatting"""
        doc_id = "task-123"
        task_data = {
            'title': 'Test Task',
            'description': 'Test description',
            'status': 'Pending'
        }
        due_date = datetime.datetime(2024, 1, 15, 10, 30, 0, tzinfo=datetime.timezone.utc)

        result = main._format_task(doc_id, task_data, due_date)

        assert result['id'] == 'task-123'
        assert result['title'] == 'Test Task'
        assert result['dueDate'] == '2024-01-15'
        assert result['description'] == 'Test description'
        assert result['status'] == 'Pending'

    def test_format_task_missing_title(self):
        """Test formatting when title is missing"""
        result = main._format_task('task-1', {}, datetime.datetime.now(datetime.timezone.utc))
        assert result['title'] == 'No Title'

    def test_format_task_missing_description(self):
        """Test formatting when description is missing"""
        task_data = {'title': 'Task'}
        result = main._format_task('task-1', task_data, datetime.datetime.now(datetime.timezone.utc))
        assert result['description'] == ''

    def test_format_task_missing_status(self):
        """Test formatting when status is missing"""
        task_data = {'title': 'Task'}
        result = main._format_task('task-1', task_data, datetime.datetime.now(datetime.timezone.utc))
        assert result['status'] == 'Unknown'

    def test_format_task_truncates_long_description(self):
        """Test that descriptions over 100 chars are truncated"""
        task_data = {
            'title': 'Task',
            'description': 'A' * 150,  # 150 character description
            'status': 'Pending'
        }
        result = main._format_task('task-1', task_data, datetime.datetime.now(datetime.timezone.utc))

        assert len(result['description']) == 103  # 100 chars + '...'
        assert result['description'].endswith('...')
        assert result['description'] == 'A' * 100 + '...'

    def test_format_task_exactly_100_chars(self):
        """Test description exactly 100 chars is not truncated"""
        task_data = {
            'title': 'Task',
            'description': 'B' * 100,
            'status': 'Pending'
        }
        result = main._format_task('task-1', task_data, datetime.datetime.now(datetime.timezone.utc))

        assert len(result['description']) == 100
        assert not result['description'].endswith('...')

    def test_format_task_date_formatting(self):
        """Test various date formats"""
        dates_to_test = [
            (datetime.datetime(2024, 1, 1, 0, 0, 0, tzinfo=datetime.timezone.utc), '2024-01-01'),
            (datetime.datetime(2024, 12, 31, 23, 59, 59, tzinfo=datetime.timezone.utc), '2024-12-31'),
            (datetime.datetime(2024, 6, 15, 12, 30, 45, tzinfo=datetime.timezone.utc), '2024-06-15'),
        ]

        for due_date, expected_str in dates_to_test:
            result = main._format_task('task-1', {'title': 'Task'}, due_date)
            assert result['dueDate'] == expected_str


class TestGetTaskDigest:
    """Test the get_task_digest cloud function"""

    def _create_mock_request(self, user_id=None, method='GET'):
        """Helper to create a mock request object"""
        mock_req = Mock()
        mock_req.args = Mock()
        mock_req.args.get = Mock(return_value=user_id)
        mock_req.method = method
        return mock_req

    def _create_mock_task_doc(self, doc_id, user_id, due_date, status='Pending', title='Test Task', description='Test'):
        """Helper to create a mock Firestore document"""
        mock_doc = Mock()
        mock_doc.id = doc_id
        mock_doc.to_dict = Mock(return_value={
            'userID': user_id,
            'title': title,
            'description': description,
            'status': status,
            'dueDate': due_date
        })
        return mock_doc

    @patch('main.firestore')
    @patch('main.MAILGUN_API_KEY')
    @patch('main.requests.post')
    def test_get_task_digest_missing_user_id(self, mock_post, mock_mailgun, mock_firestore):
        """Test that missing userId raises an error"""
        from firebase_functions import https_fn

        mock_req = self._create_mock_request(user_id=None)

        with pytest.raises(https_fn.HttpsError) as exc_info:
            main.get_task_digest(mock_req)

        assert exc_info.value.code == https_fn.FunctionsErrorCode.INVALID_ARGUMENT
        assert 'userId is required' in str(exc_info.value.message)

    @patch('main.firestore')
    @patch('main.MAILGUN_API_KEY')
    @patch('main.requests.post')
    def test_get_task_digest_no_tasks(self, mock_post, mock_mailgun, mock_firestore):
        """Test digest with no tasks"""
        mock_req = self._create_mock_request(user_id='user-1')
        mock_mailgun.value = 'test-api-key'

        # Mock empty task list
        mock_db = Mock()
        mock_firestore.client.return_value = mock_db
        mock_collection = Mock()
        mock_db.collection.return_value = mock_collection
        mock_query = Mock()
        mock_collection.where.return_value = mock_query
        mock_query.order_by.return_value = mock_query
        mock_query.stream.return_value = []

        mock_post.return_value = Mock(status_code=200)

        response = main.get_task_digest(mock_req)

        assert response.status == 200
        response_data = json.loads(response.response)
        assert response_data['summary'] == 'Found 0 active tasks. 0 overdue, 0 urgent, and 0 outstanding.'
        assert response_data['overdue'] == []
        assert response_data['urgent'] == []
        assert response_data['outstanding'] == []

    @patch('main.firestore')
    @patch('main.MAILGUN_API_KEY')
    @patch('main.requests.post')
    @patch('main.datetime')
    def test_get_task_digest_with_overdue_tasks(self, mock_datetime_module, mock_post, mock_mailgun, mock_firestore):
        """Test digest categorizes overdue tasks correctly"""
        mock_req = self._create_mock_request(user_id='user-1')
        mock_mailgun.value = 'test-api-key'

        # Mock current time
        now = datetime.datetime(2024, 1, 15, 0, 0, 0, tzinfo=datetime.timezone.utc)
        mock_datetime_module.datetime.now.return_value = now
        mock_datetime_module.timezone = datetime.timezone
        mock_datetime_module.timedelta = datetime.timedelta

        # Create overdue task (2 days ago)
        overdue_date = datetime.datetime(2024, 1, 13, 0, 0, 0, tzinfo=datetime.timezone.utc)
        mock_task = self._create_mock_task_doc('task-1', 'user-1', overdue_date, title='Overdue Task')

        # Mock Firestore
        mock_db = Mock()
        mock_firestore.client.return_value = mock_db
        mock_collection = Mock()
        mock_db.collection.return_value = mock_collection
        mock_query = Mock()
        mock_collection.where.return_value = mock_query
        mock_query.order_by.return_value = mock_query
        mock_query.stream.return_value = [mock_task]

        mock_post.return_value = Mock(status_code=200)

        response = main.get_task_digest(mock_req)

        assert response.status == 200
        response_data = json.loads(response.response)
        assert len(response_data['overdue']) == 1
        assert len(response_data['urgent']) == 0
        assert len(response_data['outstanding']) == 0
        assert response_data['overdue'][0]['title'] == 'Overdue Task'

    @patch('main.firestore')
    @patch('main.MAILGUN_API_KEY')
    @patch('main.requests.post')
    @patch('main.datetime')
    def test_get_task_digest_with_urgent_tasks(self, mock_datetime_module, mock_post, mock_mailgun, mock_firestore):
        """Test digest categorizes urgent tasks correctly (within 7 days)"""
        mock_req = self._create_mock_request(user_id='user-1')
        mock_mailgun.value = 'test-api-key'

        now = datetime.datetime(2024, 1, 15, 0, 0, 0, tzinfo=datetime.timezone.utc)
        mock_datetime_module.datetime.now.return_value = now
        mock_datetime_module.timezone = datetime.timezone
        mock_datetime_module.timedelta = datetime.timedelta

        # Create urgent task (3 days from now)
        urgent_date = datetime.datetime(2024, 1, 18, 0, 0, 0, tzinfo=datetime.timezone.utc)
        mock_task = self._create_mock_task_doc('task-2', 'user-1', urgent_date, title='Urgent Task')

        mock_db = Mock()
        mock_firestore.client.return_value = mock_db
        mock_collection = Mock()
        mock_db.collection.return_value = mock_collection
        mock_query = Mock()
        mock_collection.where.return_value = mock_query
        mock_query.order_by.return_value = mock_query
        mock_query.stream.return_value = [mock_task]

        mock_post.return_value = Mock(status_code=200)

        response = main.get_task_digest(mock_req)

        response_data = json.loads(response.response)
        assert len(response_data['urgent']) == 1
        assert response_data['urgent'][0]['title'] == 'Urgent Task'

    @patch('main.firestore')
    @patch('main.MAILGUN_API_KEY')
    @patch('main.requests.post')
    @patch('main.datetime')
    def test_get_task_digest_with_outstanding_tasks(self, mock_datetime_module, mock_post, mock_mailgun, mock_firestore):
        """Test digest categorizes outstanding tasks correctly (more than 7 days out)"""
        mock_req = self._create_mock_request(user_id='user-1')
        mock_mailgun.value = 'test-api-key'

        now = datetime.datetime(2024, 1, 15, 0, 0, 0, tzinfo=datetime.timezone.utc)
        mock_datetime_module.datetime.now.return_value = now
        mock_datetime_module.timezone = datetime.timezone
        mock_datetime_module.timedelta = datetime.timedelta

        # Create outstanding task (10 days from now)
        outstanding_date = datetime.datetime(2024, 1, 25, 0, 0, 0, tzinfo=datetime.timezone.utc)
        mock_task = self._create_mock_task_doc('task-3', 'user-1', outstanding_date, title='Outstanding Task')

        mock_db = Mock()
        mock_firestore.client.return_value = mock_db
        mock_collection = Mock()
        mock_db.collection.return_value = mock_collection
        mock_query = Mock()
        mock_collection.where.return_value = mock_query
        mock_query.order_by.return_value = mock_query
        mock_query.stream.return_value = [mock_task]

        mock_post.return_value = Mock(status_code=200)

        response = main.get_task_digest(mock_req)

        response_data = json.loads(response.response)
        assert len(response_data['outstanding']) == 1
        assert response_data['outstanding'][0]['title'] == 'Outstanding Task'

    @patch('main.firestore')
    @patch('main.MAILGUN_API_KEY')
    @patch('main.requests.post')
    @patch('main.datetime')
    def test_get_task_digest_skips_completed(self, mock_datetime_module, mock_post, mock_mailgun, mock_firestore):
        """Test that completed tasks are skipped"""
        mock_req = self._create_mock_request(user_id='user-1')
        mock_mailgun.value = 'test-api-key'

        now = datetime.datetime(2024, 1, 15, 0, 0, 0, tzinfo=datetime.timezone.utc)
        mock_datetime_module.datetime.now.return_value = now
        mock_datetime_module.timezone = datetime.timezone
        mock_datetime_module.timedelta = datetime.timedelta

        # Create completed task
        overdue_date = datetime.datetime(2024, 1, 10, 0, 0, 0, tzinfo=datetime.timezone.utc)
        mock_task = self._create_mock_task_doc('task-4', 'user-1', overdue_date, status='Completed')

        mock_db = Mock()
        mock_firestore.client.return_value = mock_db
        mock_collection = Mock()
        mock_db.collection.return_value = mock_collection
        mock_query = Mock()
        mock_collection.where.return_value = mock_query
        mock_query.order_by.return_value = mock_query
        mock_query.stream.return_value = [mock_task]

        mock_post.return_value = Mock(status_code=200)

        response = main.get_task_digest(mock_req)

        response_data = json.loads(response.response)
        # All categories should be empty
        assert len(response_data['overdue']) == 0
        assert len(response_data['urgent']) == 0
        assert len(response_data['outstanding']) == 0

    @patch('main.firestore')
    @patch('main.MAILGUN_API_KEY')
    @patch('main.requests.post')
    @patch('main.datetime')
    def test_get_task_digest_skips_missing_due_date(self, mock_datetime_module, mock_post, mock_mailgun, mock_firestore):
        """Test that tasks without due dates are skipped"""
        mock_req = self._create_mock_request(user_id='user-1')
        mock_mailgun.value = 'test-api-key'

        now = datetime.datetime(2024, 1, 15, 0, 0, 0, tzinfo=datetime.timezone.utc)
        mock_datetime_module.datetime.now.return_value = now
        mock_datetime_module.timezone = datetime.timezone
        mock_datetime_module.timedelta = datetime.timedelta

        # Create task without due date
        mock_doc = Mock()
        mock_doc.id = 'task-5'
        mock_doc.to_dict = Mock(return_value={
            'userID': 'user-1',
            'title': 'No Due Date',
            'status': 'Pending',
            'dueDate': None
        })

        mock_db = Mock()
        mock_firestore.client.return_value = mock_db
        mock_collection = Mock()
        mock_db.collection.return_value = mock_collection
        mock_query = Mock()
        mock_collection.where.return_value = mock_query
        mock_query.order_by.return_value = mock_query
        mock_query.stream.return_value = [mock_doc]

        mock_post.return_value = Mock(status_code=200)

        response = main.get_task_digest(mock_req)

        response_data = json.loads(response.response)
        assert len(response_data['overdue']) == 0
        assert len(response_data['urgent']) == 0
        assert len(response_data['outstanding']) == 0

    @patch('main.firestore')
    @patch('main.MAILGUN_API_KEY')
    @patch('main.requests.post')
    def test_get_task_digest_sends_mailgun_email(self, mock_post, mock_mailgun, mock_firestore):
        """Test that Mailgun API is called with correct parameters"""
        mock_req = self._create_mock_request(user_id='user-1')
        mock_mailgun.value = 'test-mailgun-key'

        # Mock empty task list for simplicity
        mock_db = Mock()
        mock_firestore.client.return_value = mock_db
        mock_collection = Mock()
        mock_db.collection.return_value = mock_collection
        mock_query = Mock()
        mock_collection.where.return_value = mock_query
        mock_query.order_by.return_value = mock_query
        mock_query.stream.return_value = []

        mock_post.return_value = Mock(status_code=200)

        response = main.get_task_digest(mock_req)

        # Verify Mailgun was called
        assert mock_post.called
        call_args = mock_post.call_args
        assert 'mailgun.net' in call_args[0][0]
        assert call_args[1]['auth'] == ('api', 'test-mailgun-key')

    @patch('main.firestore')
    @patch('main.MAILGUN_API_KEY')
    @patch('main.requests.post')
    def test_get_task_digest_mailgun_failure(self, mock_post, mock_mailgun, mock_firestore):
        """Test handling of Mailgun API failure"""
        from firebase_functions import https_fn

        mock_req = self._create_mock_request(user_id='user-1')
        mock_mailgun.value = 'test-api-key'

        # Mock user data
        mock_user_doc = Mock()
        mock_user_doc.to_dict = Mock(return_value={
            'userID': 'user-1',
            'email': 'test@example.com',
            'fullName': 'Test User'
        })

        mock_db = Mock()
        mock_firestore.client.return_value = mock_db
        
        # Setup for both collections (users and tasks)
        def collection_side_effect(collection_name):
            if collection_name == 'users':
                mock_users_collection = Mock()
                mock_users_query = Mock()
                mock_users_collection.where.return_value = mock_users_query
                mock_users_query.limit.return_value = mock_users_query
                mock_users_query.stream.return_value = [mock_user_doc]
                return mock_users_collection
            else:  # tasks collection
                mock_tasks_collection = Mock()
                mock_tasks_query = Mock()
                mock_tasks_collection.where.return_value = mock_tasks_query
                mock_tasks_query.order_by.return_value = mock_tasks_query
                mock_tasks_query.stream.return_value = []
                return mock_tasks_collection
        
        mock_db.collection.side_effect = collection_side_effect

        # Make Mailgun fail
        mock_post.side_effect = Exception("Mailgun error")

        with pytest.raises(https_fn.HttpsError) as exc_info:
            main.get_task_digest(mock_req)

        assert exc_info.value.code == https_fn.FunctionsErrorCode.INTERNAL
        assert 'Failed to send email' in str(exc_info.value.message)

    @patch('main.firestore')
    @patch('main.MAILGUN_API_KEY')
    @patch('main.requests.post')
    def test_get_task_digest_sends_to_correct_user_email(self, mock_post, mock_mailgun, mock_firestore):
        """Test that email is sent to the correct user's email address"""
        mock_req = self._create_mock_request(user_id='U101')
        mock_mailgun.value = 'test-mailgun-key'

        # Mock user data with specific email
        mock_user_doc = Mock()
        mock_user_doc.to_dict = Mock(return_value={
            'userID': 'U101',
            'email': 'john.doe@example.com',
            'fullName': 'John Doe'
        })

        mock_db = Mock()
        mock_firestore.client.return_value = mock_db
        
        # Setup for both collections (users and tasks)
        def collection_side_effect(collection_name):
            if collection_name == 'users':
                mock_users_collection = Mock()
                mock_users_query = Mock()
                mock_users_collection.where.return_value = mock_users_query
                mock_users_query.limit.return_value = mock_users_query
                mock_users_query.stream.return_value = [mock_user_doc]
                return mock_users_collection
            else:  # tasks collection
                mock_tasks_collection = Mock()
                mock_tasks_query = Mock()
                mock_tasks_collection.where.return_value = mock_tasks_query
                mock_tasks_query.order_by.return_value = mock_tasks_query
                mock_tasks_query.stream.return_value = []
                return mock_tasks_collection
        
        mock_db.collection.side_effect = collection_side_effect
        mock_post.return_value = Mock(status_code=200)

        response = main.get_task_digest(mock_req)

        # Verify Mailgun was called with correct email
        assert mock_post.called
        call_data = mock_post.call_args[1]['data']
        assert call_data['to'] == 'John Doe <john.doe@example.com>'
        assert response.status == 200

    @patch('main.firestore')
    @patch('main.MAILGUN_API_KEY')
    @patch('main.requests.post')
    def test_get_task_digest_sends_to_different_users(self, mock_post, mock_mailgun, mock_firestore):
        """Test that different users receive emails at their respective addresses"""
        mock_mailgun.value = 'test-mailgun-key'

        # Test data for different users
        test_users = [
            {'userID': 'U101', 'email': 'alice@example.com', 'fullName': 'Alice Smith'},
            {'userID': 'U102', 'email': 'bob@example.com', 'fullName': 'Bob Johnson'},
            {'userID': 'U103', 'email': 'charlie@example.com', 'fullName': 'Charlie Brown'}
        ]

        for user in test_users:
            mock_req = self._create_mock_request(user_id=user['userID'])
            
            # Mock user data
            mock_user_doc = Mock()
            mock_user_doc.to_dict = Mock(return_value=user)

            mock_db = Mock()
            mock_firestore.client.return_value = mock_db
            
            # Setup for both collections
            def collection_side_effect(collection_name):
                if collection_name == 'users':
                    mock_users_collection = Mock()
                    mock_users_query = Mock()
                    mock_users_collection.where.return_value = mock_users_query
                    mock_users_query.limit.return_value = mock_users_query
                    mock_users_query.stream.return_value = [mock_user_doc]
                    return mock_users_collection
                else:  # tasks collection
                    mock_tasks_collection = Mock()
                    mock_tasks_query = Mock()
                    mock_tasks_collection.where.return_value = mock_tasks_query
                    mock_tasks_query.order_by.return_value = mock_tasks_query
                    mock_tasks_query.stream.return_value = []
                    return mock_tasks_collection
            
            mock_db.collection.side_effect = collection_side_effect
            mock_post.return_value = Mock(status_code=200)

            response = main.get_task_digest(mock_req)

            # Verify correct email was used
            call_data = mock_post.call_args[1]['data']
            expected_to = f"{user['fullName']} <{user['email']}>"
            assert call_data['to'] == expected_to, f"Expected email to {expected_to}"
            assert response.status == 200

    @patch('main.firestore')
    @patch('main.MAILGUN_API_KEY')
    @patch('main.requests.post')
    def test_get_task_digest_user_not_found(self, mock_post, mock_mailgun, mock_firestore):
        """Test handling when user is not found in Firestore"""
        from firebase_functions import https_fn

        mock_req = self._create_mock_request(user_id='NONEXISTENT')
        mock_mailgun.value = 'test-api-key'

        # Mock empty user query result
        mock_db = Mock()
        mock_firestore.client.return_value = mock_db
        mock_users_collection = Mock()
        mock_users_query = Mock()
        mock_db.collection.return_value = mock_users_collection
        mock_users_collection.where.return_value = mock_users_query
        mock_users_query.limit.return_value = mock_users_query
        mock_users_query.stream.return_value = []  # No users found

        with pytest.raises(https_fn.HttpsError) as exc_info:
            main.get_task_digest(mock_req)

        assert exc_info.value.code == https_fn.FunctionsErrorCode.NOT_FOUND
        assert 'User with userId NONEXISTENT not found' in str(exc_info.value.message)

    @patch('main.firestore')
    @patch('main.MAILGUN_API_KEY')
    @patch('main.requests.post')
    def test_get_task_digest_user_missing_email(self, mock_post, mock_mailgun, mock_firestore):
        """Test handling when user has no email address"""
        from firebase_functions import https_fn

        mock_req = self._create_mock_request(user_id='U999')
        mock_mailgun.value = 'test-api-key'

        # Mock user without email
        mock_user_doc = Mock()
        mock_user_doc.to_dict = Mock(return_value={
            'userID': 'U999',
            'fullName': 'No Email User'
            # email field is missing
        })

        mock_db = Mock()
        mock_firestore.client.return_value = mock_db
        mock_users_collection = Mock()
        mock_users_query = Mock()
        mock_db.collection.return_value = mock_users_collection
        mock_users_collection.where.return_value = mock_users_query
        mock_users_query.limit.return_value = mock_users_query
        mock_users_query.stream.return_value = [mock_user_doc]

        with pytest.raises(https_fn.HttpsError) as exc_info:
            main.get_task_digest(mock_req)

        assert exc_info.value.code == https_fn.FunctionsErrorCode.FAILED_PRECONDITION
        assert 'does not have an email address configured' in str(exc_info.value.message)

    @patch('main.firestore')
    @patch('main.MAILGUN_API_KEY')
    @patch('main.requests.post')
    def test_get_task_digest_firestore_error(self, mock_post, mock_mailgun, mock_firestore):
        """Test handling of Firestore errors"""
        from firebase_functions import https_fn

        mock_req = self._create_mock_request(user_id='user-1')
        mock_mailgun.value = 'test-api-key'

        # Make Firestore fail
        mock_firestore.client.side_effect = Exception("Firestore error")

        with pytest.raises(https_fn.HttpsError) as exc_info:
            main.get_task_digest(mock_req)

        assert exc_info.value.code == https_fn.FunctionsErrorCode.INTERNAL
        assert 'Failed to retrieve task data' in str(exc_info.value.message)


class TestScheduledTaskDigest:
    """Test the scheduled_task_digest function"""

    @patch('main.firestore')
    @patch('main.requests.post')
    def test_scheduled_task_digest_sends_to_all_users(self, mock_post, mock_firestore):
        """Test that scheduled function sends digest to all users in the database"""
        mock_event = Mock()
        
        # Create mock users with different emails
        mock_user1 = Mock()
        mock_user1.id = 'user-doc-1'
        mock_user1.to_dict = Mock(return_value={
            'userID': 'U101',
            'email': 'user1@example.com',
            'fullName': 'John Doe'
        })
        
        mock_user2 = Mock()
        mock_user2.id = 'user-doc-2'
        mock_user2.to_dict = Mock(return_value={
            'userID': 'U102',
            'email': 'user2@example.com',
            'fullName': 'Jane Smith'
        })
        
        mock_user3 = Mock()
        mock_user3.id = 'user-doc-3'
        mock_user3.to_dict = Mock(return_value={
            'userID': 'U103',
            'email': 'user3@example.com',
            'fullName': 'Bob Johnson'
        })
        
        # Setup Firestore mock
        mock_db = Mock()
        mock_firestore.client.return_value = mock_db
        mock_users_ref = Mock()
        mock_db.collection.return_value = mock_users_ref
        mock_users_ref.stream.return_value = [mock_user1, mock_user2, mock_user3]
        
        # Mock successful POST responses
        mock_post.return_value = Mock(status_code=200)
        
        # Execute the scheduled function
        main.scheduled_task_digest(mock_event)
        
        # Verify POST was called 3 times (once per user)
        assert mock_post.call_count == 3
        
        # Verify each user received their digest
        call_urls = [call[0][0] for call in mock_post.call_args_list]
        assert any('userId=U101' in url for url in call_urls), "User U101 should receive digest"
        assert any('userId=U102' in url for url in call_urls), "User U102 should receive digest"
        assert any('userId=U103' in url for url in call_urls), "User U103 should receive digest"

    @patch('main.firestore')
    @patch('main.requests.post')
    def test_scheduled_task_digest_handles_user_without_userID(self, mock_post, mock_firestore):
        """Test that scheduled function uses document ID when userID is missing"""
        mock_event = Mock()
        
        # Create mock user without userID field
        mock_user = Mock()
        mock_user.id = 'fallback-user-id'
        mock_user.to_dict = Mock(return_value={
            'email': 'fallback@example.com',
            'fullName': 'Fallback User'
        })
        
        # Setup Firestore mock
        mock_db = Mock()
        mock_firestore.client.return_value = mock_db
        mock_users_ref = Mock()
        mock_db.collection.return_value = mock_users_ref
        mock_users_ref.stream.return_value = [mock_user]
        
        mock_post.return_value = Mock(status_code=200)
        
        # Execute the scheduled function
        main.scheduled_task_digest(mock_event)
        
        # Verify the fallback ID was used
        assert mock_post.called
        call_url = mock_post.call_args[0][0]
        assert 'userId=fallback-user-id' in call_url

    @patch('main.firestore')
    @patch('main.requests.post')
    def test_scheduled_task_digest_continues_on_individual_failure(self, mock_post, mock_firestore):
        """Test that scheduled function continues processing even if one user fails"""
        mock_event = Mock()
        
        # Create multiple mock users
        mock_user1 = Mock()
        mock_user1.id = 'user-1'
        mock_user1.to_dict = Mock(return_value={'userID': 'U201', 'email': 'user1@test.com'})
        
        mock_user2 = Mock()
        mock_user2.id = 'user-2'
        mock_user2.to_dict = Mock(return_value={'userID': 'U202', 'email': 'user2@test.com'})
        
        mock_user3 = Mock()
        mock_user3.id = 'user-3'
        mock_user3.to_dict = Mock(return_value={'userID': 'U203', 'email': 'user3@test.com'})
        
        # Setup Firestore mock
        mock_db = Mock()
        mock_firestore.client.return_value = mock_db
        mock_users_ref = Mock()
        mock_db.collection.return_value = mock_users_ref
        mock_users_ref.stream.return_value = [mock_user1, mock_user2, mock_user3]
        
        # Make second user fail
        def side_effect(url):
            if 'U202' in url:
                raise Exception("Network error for U202")
            return Mock(status_code=200)
        
        mock_post.side_effect = side_effect
        
        # Execute the scheduled function - should not raise exception
        try:
            main.scheduled_task_digest(mock_event)
        except Exception:
            pytest.fail("scheduled_task_digest should handle individual failures gracefully")
        
        # Verify all three users were attempted
        assert mock_post.call_count == 3

    @patch('main.requests.post')
    def test_scheduled_task_digest_calls_endpoint(self, mock_post):
        """Test that scheduled function calls the HTTP endpoint"""
        mock_post.return_value = Mock(status_code=200)
        mock_event = Mock()

        main.scheduled_task_digest(mock_event)

        # Verify the endpoint was called
        assert mock_post.called
        call_args = mock_post.call_args[0][0]
        assert 'get_task_digest' in call_args
        assert 'userId=U101' in call_args

    @patch('main.requests.post')
    def test_scheduled_task_digest_with_error(self, mock_post):
        """Test scheduled function handles errors gracefully"""
        mock_post.side_effect = Exception("Network error")
        mock_event = Mock()

        # Should not raise exception
        try:
            main.scheduled_task_digest(mock_event)
        except Exception:
            pytest.fail("scheduled_task_digest should not raise exceptions")


class TestConstants:
    """Test configuration constants"""

    def test_days_for_urgent_constant(self):
        """Test DAYS_FOR_URGENT is set correctly"""
        assert main.DAYS_FOR_URGENT == 7

    def test_tasks_collection_constant(self):
        """Test TASKS_COLLECTION is set correctly"""
        assert main.TASKS_COLLECTION == 'tasks'

    def test_completed_status_constant(self):
        """Test COMPLETED_STATUS is set correctly"""
        assert main.COMPLETED_STATUS == 'Completed'
