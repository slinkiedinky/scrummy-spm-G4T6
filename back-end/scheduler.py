"""
Scheduler to run background jobs for notifications.

This script should be run as a cron job or background service.
Example cron job (runs every day at 9 AM):
0 9 * * * cd /path/to/back-end && python scheduler.py

Or run continuously with APScheduler:
python scheduler.py --daemon
"""

import schedule
import time
import argparse
from deadline_notifications import check_and_create_deadline_notifications

def run_deadline_check():
    """Run the deadline notification check"""
    print(f"Running deadline notification check at {time.strftime('%Y-%m-%d %H:%M:%S')}")
    try:
        check_and_create_deadline_notifications()
        print("Deadline notification check completed successfully")
    except Exception as e:
        print(f"Error running deadline notification check: {e}")

def run_scheduler_daemon():
    """Run the scheduler as a daemon process"""
    # Schedule the job to run every day at 9:00 AM
    schedule.every().day.at("09:00").do(run_deadline_check)

    # Also check every hour for immediate testing
    # Comment out in production if not needed
    schedule.every().hour.do(run_deadline_check)

    print("Scheduler started. Waiting for scheduled jobs...")
    print("- Deadline checks will run every day at 9:00 AM")
    print("- Deadline checks will also run every hour (for testing)")

    # Run once immediately on startup
    run_deadline_check()

    while True:
        schedule.run_pending()
        time.sleep(60)  # Check every minute

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Run notification scheduler')
    parser.add_argument('--daemon', action='store_true', help='Run as daemon process')
    parser.add_argument('--once', action='store_true', help='Run once and exit')

    args = parser.parse_args()

    if args.daemon:
        run_scheduler_daemon()
    elif args.once:
        run_deadline_check()
    else:
        # Default: run as daemon
        run_scheduler_daemon()
