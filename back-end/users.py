from flask import Blueprint, request, jsonify
from firebase_admin import firestore
from datetime import datetime

db = firestore.client()
users_bp = Blueprint("users", __name__, url_prefix="/users")

def _to_iso(value):
    if isinstance(value, datetime):
        return value.isoformat()
    return value

def _canon_status(status):
    return status.lower() if status else "new"

def _canon_priority(priority):
    return priority.lower() if priority else "medium"

def normalize_user(doc):
    data = doc.copy()  # assume doc is a dict
    # normalize dates
    for k in ("createdAt", "updatedAt", "dueDate"):
        if k in data and data[k] is not None:
            data[k] = _to_iso(data[k])
    # canonicalize status and priority
    data["status"] = _canon_status(data.get("status"))
    data["priority"] = _canon_priority(data.get("priority"))
    # ensure lists exist
    data.setdefault("collaboratorsIds", [])
    data.setdefault("tags", [])
    # ensure strings exist
    for field in ("ownerId", "description", "title"):
        data.setdefault(field, "")
    return data

# Create user
@users_bp.route("/", methods=["POST"])
def create_user():
    data = request.json
    doc_ref = db.collection("users").add(data)
    return jsonify({"id": doc_ref[1].id, "message": "User created"}), 201

# Read all users
@users_bp.route("/", methods=["GET"])
def get_users():
    docs = db.collection("users").stream()
    users = [normalize_user({**doc.to_dict(), "id": doc.id}) for doc in docs]
    return jsonify(users), 200

# Read one user
@users_bp.route("/<user_id>", methods=["GET"])
def get_user(user_id):
    doc = db.collection("users").document(user_id).get()
    if not doc.exists:
        return jsonify({"error": "Not found"}), 404
    user = normalize_user({**doc.to_dict(), "id": doc.id})
    return jsonify(user), 200

# Update user
@users_bp.route("/<user_id>", methods=["PUT"])
def update_user(user_id):
    data = request.json
    db.collection("users").document(user_id).update(data)
    return jsonify({"message": "User updated"}), 200

# Delete user
@users_bp.route("/<user_id>", methods=["DELETE"])
def delete_user(user_id):
    db.collection("users").document(user_id).delete()
    return jsonify({"message": "User deleted"}), 200

