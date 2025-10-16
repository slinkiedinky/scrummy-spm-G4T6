import datetime
from firebase_functions import https_fn, scheduler_fn
from firebase_functions.params import SecretParam
from firebase_admin import firestore, initialize_app
import google.cloud.firestore
import json
import requests
from google.cloud.firestore import FieldFilter

initialize_app()

# --- Configuration Constants --- 
DAYS_FOR_URGENT = 7
TASKS_COLLECTION = 'tasks'
# Status used to identify tasks that should be excluded from the active digest
COMPLETED_STATUS = 'Completed'

def _format_task(doc_id: str, task_data: dict, due_date: datetime.datetime) -> dict:
    """Helper function to format a single task document."""
    
    description = task_data.get('description', '')
    
    return {
        'id': doc_id,
        'title': task_data.get('title', 'No Title'),
        # Format the date as a simple string for the summary
        'dueDate': due_date.strftime('%Y-%m-%d'),
        # Truncate description to max 100 characters
        'description': description[:100] + ('...' if len(description) > 100 else ''),
        'status': task_data.get('status', 'Unknown') # Include the current status
    }

MAILGUN_API_KEY = SecretParam('MAILGUN_API_KEY')

@https_fn.on_request(secrets=['MAILGUN_API_KEY'])
def get_task_digest(req: https_fn.Request) -> https_fn.Response:
    """
    Calculates and summarizes a user's tasks into Overdue, Urgent, and Outstanding categories.
    
    The function expects a JSON payload like: {"userId": "user_id_string"}
    """

    mailgun_key = MAILGUN_API_KEY.value
    db: google.cloud.firestore.Client = firestore.client()
    
    # 1. Input Validation   
    user_id = req.args.get('userId')
    if not user_id:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message='The userId is required to generate the task digest.'
        )

    try:
        # 2. Date Calculation Setup
        # 'now' is set to the start of the current day in UTC for consistent comparisons.
        now = datetime.datetime.now(datetime.timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        # Calculate the threshold for urgency (7 days from now)
        urgent_threshold = now + datetime.timedelta(days=DAYS_FOR_URGENT)

        # 3. Firestore Query
        tasks_ref = db.collection(TASKS_COLLECTION)
        tasks_query = tasks_ref.where(filter=FieldFilter('userID', '==', user_id)).order_by('dueDate')
        
        snapshot = tasks_query.stream()

        # 4. Task Categorization
        overdue_tasks: list[dict] = []
        urgent_tasks: list[dict] = []
        outstanding_tasks: list[dict] = []

        for doc in snapshot:
            task = doc.to_dict()
            status = task.get('status', 'Unknown')
            due_date_ts = task.get('dueDate')

            # Skip if completed status or if dueDate is missing
            if status == COMPLETED_STATUS or not due_date_ts:
                continue

            # Convert Timestamp to date object for comparison (normalized to start of day)
            due_date = due_date_ts.astimezone(datetime.timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

            # A. Overdue: Due date is strictly in the past (before today)
            if due_date < now:
                overdue_tasks.append(_format_task(doc.id, task, due_date_ts.astimezone(datetime.timezone.utc)))
            # B. Urgent: Due date is today or within the next 7 days (including today)
            elif due_date <= urgent_threshold:
                urgent_tasks.append(_format_task(doc.id, task, due_date_ts.astimezone(datetime.timezone.utc)))
            # C. Outstanding: Due date is more than 7 days in the future
            else:
                outstanding_tasks.append(_format_task(doc.id, task, due_date_ts.astimezone(datetime.timezone.utc)))
        
        # 5. Final Summary Generation
        total_count = len(overdue_tasks) + len(urgent_tasks) + len(outstanding_tasks)
        digest_summary = (
            f"Found {total_count} active tasks. "
            f"{len(overdue_tasks)} overdue, {len(urgent_tasks)} urgent, "
            f"and {len(outstanding_tasks)} outstanding."
        )

        response_data = {
            'summary': digest_summary,
            'overdue': overdue_tasks,
            'urgent': urgent_tasks,
            'outstanding': outstanding_tasks,
        }

        mailgun_variables = {
            "UserID": user_id,
            "digestSummary": digest_summary,
            "overdueTasks": len(overdue_tasks),
            "urgentTasks": len(urgent_tasks),
            "outstandingTasks": len(outstanding_tasks),
            "overdue": overdue_tasks,
            "urgent": urgent_tasks,
            "outstanding": outstanding_tasks
        }

        try:
            response = requests.post(
                "https://api.mailgun.net/v3/sandbox110b9105efa84fe1a5ba07a4e13452f8.mailgun.org/messages",
                auth=("api", mailgun_key),
                data={"from": "Mailgun Sandbox <postmaster@sandbox110b9105efa84fe1a5ba07a4e13452f8.mailgun.org>",
                    "to": "Yong Ray <teoyongray@hotmail.com>",
                    "subject": "Daily Digest for TaskFlow",
                    "template": "Daily Digest for TaskFlow",
                    "h:X-Mailgun-Variables": json.dumps(mailgun_variables)
                    })
            
            print(f"Status: {response.status_code}")
        except Exception as e:
            raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message='Failed to send email due to a server error.'
        )

        return https_fn.Response(
            response=json.dumps(response_data),
            status=200,
            mimetype='application/json'
        )

    except Exception as e:
        print(f"Error fetching task digest: {e}")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message='Failed to retrieve task data due to a server error.'
        )

@scheduler_fn.on_schedule(schedule="every day 09:00", timezone="Asia/Singapore")
def scheduled_task_digest(event):
    userID = "U101"
    response = requests.post(f"https://us-central1-scrummy-be0d6.cloudfunctions.net/get_task_digest?userId={userID}") 
    print("Triggered:", response.status_code)
    # db: google.cloud.firestore.Client = firestore.client()
    # users_ref = db.collection('users')
    # users = users_ref.stream()
    # for user_doc in users:
    #     user_data = user_doc.to_dict()
    #     user_id = user_data.get('userID') or user_doc.id
    #     try:
    #         response = requests.post(
    #             f"https://us-central1-scrummy-be0d6.cloudfunctions.net/get_task_digest?userId={user_id}"
    #         )
    #         print(f"Digest sent for user {user_id}: {response.status_code}")
    #     except Exception as e:
    #         print(f"Failed to send digest for user {user_id}: {e}")