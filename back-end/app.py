from flask import Flask
from flask_cors import CORS
from firebase import db
import datetime as dt
from users import users_bp
from projects import projects_bp
import threading
import time
import os

# Only import scheduler if enabled
ENABLE_DEADLINE_NOTIFICATIONS = os.environ.get('ENABLE_DEADLINE_NOTIFICATIONS', 'true').lower() == 'true'

if ENABLE_DEADLINE_NOTIFICATIONS:
    import schedule
    from deadline_notifications import check_and_create_deadline_notifications

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})
app.register_blueprint(users_bp, url_prefix="/api/users")
app.register_blueprint(projects_bp, url_prefix="/api/projects")

# Debug endpoint to manually trigger deadline check
@app.route("/api/notifications/check-deadlines", methods=["POST"])
def trigger_deadline_check():
    """Manually trigger deadline notification check (for debugging)"""
    if ENABLE_DEADLINE_NOTIFICATIONS:
        try:
            check_and_create_deadline_notifications()
            return {"success": True, "message": "Deadline check completed. Check console for details."}, 200
        except Exception as e:
            return {"success": False, "error": str(e)}, 500
    else:
        return {"success": False, "message": "Deadline notifications are disabled"}, 400

# Deadline notification scheduler (only if enabled)
if ENABLE_DEADLINE_NOTIFICATIONS:
    # Safe wrapper for deadline checks
    def safe_deadline_check():
        """Wrapper function to safely run deadline check with error handling"""
        try:
            check_and_create_deadline_notifications()
            print("✅ Deadline check completed")
        except Exception as e:
            print(f"❌ Deadline check error: {e}")
            # Don't crash the scheduler, just log and continue

    # Background scheduler for deadline notifications
    def run_scheduler():
        """Run scheduled jobs in a background thread"""
        # Wait longer before starting to ensure Flask is fully ready
        print("📅 Deadline notification scheduler will start in 30 seconds...")
        time.sleep(30)

        # Schedule deadline check every 30 minutes
        schedule.every(30).minutes.do(safe_deadline_check)

        # Also schedule daily check at 9:00 AM
        schedule.every().day.at("09:00").do(safe_deadline_check)

        print("📅 Deadline notification scheduler started")
        print("   - Checks every 30 minutes")
        print("   - Daily check at 9:00 AM")
        print("   - First check will run in 30 minutes")

        # Keep running scheduled tasks (removed immediate check)
        while True:
            schedule.run_pending()
            time.sleep(60)  # Check every minute for pending jobs

    # Start scheduler in background thread
    def start_background_scheduler():
        """Start the scheduler in a daemon thread"""
        scheduler_thread = threading.Thread(target=run_scheduler, daemon=True)
        scheduler_thread.start()

# Running app
if __name__ == "__main__":
    # Start the background scheduler if enabled
    if ENABLE_DEADLINE_NOTIFICATIONS:
        start_background_scheduler()
    else:
        print("⏸️  Deadline notifications are disabled")
        print("   Set ENABLE_DEADLINE_NOTIFICATIONS=true to enable")

    # Run Flask app
    app.run(debug=True, use_reloader=False)  # use_reloader=False prevents double initialization