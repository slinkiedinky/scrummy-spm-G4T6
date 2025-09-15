from flask import Flask
from users import users_bp

app = Flask(__name__)
app.register_blueprint(users_bp, url_prefix="/api/users")

# Running app
if __name__ == "__main__":
    app.run(debug=True)