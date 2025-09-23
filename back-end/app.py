from flask import Flask
from flask_cors import CORS
from firebase import db
import datetime as dt
from users import users_bp
from projects import projects_bp

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})
app.register_blueprint(users_bp, url_prefix="/api/users")
app.register_blueprint(projects_bp, url_prefix="/api/projects")

# Running app
if __name__ == "__main__":
    app.run(debug=True)