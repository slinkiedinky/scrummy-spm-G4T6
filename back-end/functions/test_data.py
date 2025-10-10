import datetime
from firebase_admin import initialize_app, firestore, credentials

SERVICE_ACCOUNT_PATH = ''
TASKS_COLLECTION = 'tasks'

# Test Users and Projects
USER_ID_1 = 'U101'   # The primary user for testing the digest function
USER_ID_2 = 'U102'     # A second user to test filtering (should be excluded)
PROJECT_ID_1 = 'P101'
PROJECT_ID_2 = 'P102'

def run_data_seeder():
    """Initializes the Admin SDK and inserts sample tasks into Firestore."""
    try:
        # 1. Initialize Firebase Admin SDK
        cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
        initialize_app(cred)
        db = firestore.client()
        
    except FileNotFoundError:
        print(f"ERROR: Service account file not found at '{SERVICE_ACCOUNT_PATH}'")
        print("Please update SERVICE_ACCOUNT_PATH to run the seeder.")
        return
    except Exception as e:
        print(f"ERROR initializing Firebase Admin SDK: {e}")
        return

    print("--- Initializing Firestore Task Seeder ---")
    print(f"Primary Test User: {USER_ID_1}")
    print(f"Filter Check User: {USER_ID_2}")

    # Set up date references (using UTC timezone is best practice for Firestore)
    now = datetime.datetime.now(datetime.timezone.utc)
    
    sample_tasks = [
        # =================================================================
        # 1. TASKS FOR PRIMARY USER: user_alpha_001 (Should be included in digest)
        # =================================================================

        # --- ALPHA: OVERDUE (Project Bravo) ---
        {
            'userID': USER_ID_1,
            'projectID': PROJECT_ID_1,
            'title': 'Final Project Design Review',
            'description': 'Review architectural diagrams and submit the final wireframes.',
            'dueDate': now - datetime.timedelta(days=9), # 9 days ago
            'status': 'Pending',
        },
        {
            'userID': USER_ID_1,
            'projectID': PROJECT_ID_1,
            'title': 'Fix Critical Bug #404',
            'description': 'The main API endpoint is returning a 404 error intermittently in the production environment.',
            'dueDate': now - datetime.timedelta(hours=12), # 12 hours ago
            'status': 'Blocked',
        },

        # --- ALPHA: URGENT (Project Delta) ---
        {
            'userID': USER_ID_1,
            'projectID': PROJECT_ID_2,
            'title': 'Prepare Weekly Status Report',
            'description': 'Compile metrics for user engagement and system uptime for the meeting tomorrow.',
            'dueDate': now + datetime.timedelta(days=1), # Tomorrow
            'status': 'In Progress',
        },
        {
            'userID': USER_ID_1,
            'projectID': PROJECT_ID_2,
            'title': 'HR Training Module',
            'description': 'Mandatory anti-harassment training module must be completed by next week.',
            'dueDate': now + datetime.timedelta(days=7), # 7 days from now
            'status': 'Pending',
        },
        
        # --- ALPHA: OUTSTANDING (Project Bravo) ---
        {
            'userID': USER_ID_1,
            'projectID': PROJECT_ID_1,
            'title': 'Q4 Budget Submission',
            'description': 'Prepare the full budget proposal for the final quarter of the fiscal year.',
            'dueDate': now + datetime.timedelta(days=25), # 25 days from now
            'status': 'Pending',
        },

        # --- ALPHA: COMPLETED (Will be ignored by function) ---
        {
            'userID': USER_ID_1,
            'projectID': PROJECT_ID_2,
            'title': 'Set up Initial Project Repo',
            'description': 'Create the GitHub repository and initialize basic readme and license files.',
            'dueDate': now - datetime.timedelta(days=30),
            'status': 'Completed',
        },
        {
            'userID': USER_ID_1,
            'projectID': PROJECT_ID_1,
            'title': 'Install Firebase CLI',
            'description': 'Install firebase-tools globally via npm to enable project deployments.',
            'dueDate': now - datetime.timedelta(days=1),
            'status': 'Completed',
        },

        # --- ALPHA: MISC ACTIVE (Project Bravo) ---
        {
            'userID': USER_ID_1,
            'projectID': PROJECT_ID_1,
            'title': 'Review PR #120',
            'description': 'Review and merge the pull request for the new user profile feature.',
            'dueDate': now + datetime.timedelta(days=10), # Outstanding
            'status': 'In Review',
        },
        {
            'userID': USER_ID_1,
            'projectID': PROJECT_ID_2,
            'title': 'Refactor Authentication Service',
            'description': 'Update the legacy authentication calls to use the new identity platform APIs.',
            'dueDate': now + datetime.timedelta(days=4), # Urgent
            'status': 'In Progress',
        },
        {
            'userID': USER_ID_1,
            'projectID': PROJECT_ID_2,
            'title': 'Database Migration Plan',
            'description': 'Finalize the schema changes and prepare the roll-back plan.',
            'dueDate': now - datetime.timedelta(days=5), # Overdue
            'status': 'Pending',
        },

        # =================================================================
        # 2. TASKS FOR SECONDARY USER: user_beta_002 (Should be filtered out)
        # =================================================================
        {
            'userID': USER_ID_2,
            'projectID': PROJECT_ID_1,
            'title': 'Beta: Onboarding Checklist',
            'description': 'Complete all steps in the new employee onboarding document.',
            'dueDate': now + datetime.timedelta(days=2), # Urgent for Beta
            'status': 'Pending',
        },
        {
            'userID': USER_ID_2,
            'projectID': PROJECT_ID_2,
            'title': 'Beta: Vacation Request',
            'description': 'Submit the required vacation request form for December.',
            'dueDate': now + datetime.timedelta(days=30), # Outstanding for Beta
            'status': 'Pending',
        },
        {
            'userID': USER_ID_2,
            'projectID': PROJECT_ID_2,
            'title': 'Beta: Expense Report',
            'description': 'Finalize last month\'s expense report for processing.',
            'dueDate': now - datetime.timedelta(days=3), # Overdue for Beta
            'status': 'Pending',
        },
        {
            'userID': USER_ID_2,
            'projectID': PROJECT_ID_2,
            'title': 'Beta: Weekly Check-in',
            'description': 'Completed the mandatory weekly check-in form.',
            'dueDate': now + datetime.timedelta(days=6),
            'status': 'Completed', # Completed status, should be skipped
        },
        {
            'userID': USER_ID_2,
            'projectID': PROJECT_ID_1,
            'title': 'Beta: Team Lunch Booking',
            'description': 'Book a table for 8 people for the upcoming team celebration.',
            'dueDate': now - datetime.timedelta(days=1), # Overdue for Beta
            'status': 'Pending',
        },
    ]

    # 3. Add documents to Firestore
    print(f"Attempting to add {len(sample_tasks)} documents...")
    
    for task_data in sample_tasks:
        try:
            db.collection(TASKS_COLLECTION).add(task_data)
            print(f"  [SUCCESS] Added task: {task_data['title']} (User: {task_data['userID']})")
        except Exception as e:
            print(f"  [FAILURE] Failed to add task {task_data['title']}: {e}")

    print("--- Seeding complete. ---")


if __name__ == '__main__':
    run_data_seeder()
