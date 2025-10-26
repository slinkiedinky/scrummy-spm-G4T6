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
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

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

        mock_db = Mock()
        mock_firestore.client.return_value = mock_db
        mock_collection = Mock()
        mock_db.collection.return_value = mock_collection
        mock_query = Mock()
        mock_collection.where.return_value = mock_query
        mock_query.order_by.return_value = mock_query
        mock_query.stream.return_value = []

        # Make Mailgun fail
        mock_post.side_effect = Exception("Mailgun error")

        with pytest.raises(https_fn.HttpsError) as exc_info:
            main.get_task_digest(mock_req)

        assert exc_info.value.code == https_fn.FunctionsErrorCode.INTERNAL
        assert 'Failed to send email' in str(exc_info.value.message)

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
