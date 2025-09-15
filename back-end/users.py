from flask import Blueprint, jsonify
from firebase import db

users_bp = Blueprint("users", __name__)

@users_bp.route("/all", methods=["GET"])
def get_all_users():
    users_ref = db.collection("users")
    users = [doc.to_dict() for doc in users_ref.stream()]
    return jsonify(users)