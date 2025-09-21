# back-end/firebase.py
import os
import firebase_admin
from firebase_admin import credentials, firestore

# Resolve path relative to THIS file (not where you run python)
HERE = os.path.dirname(os.path.abspath(__file__))
KEY_PATH = os.path.join(HERE, "scrummy-be0d6-firebase-adminsdk-fbsvc-9b33421a7f.json")

def _init():
    try:
        return firebase_admin.get_app()
    except ValueError:
        pass

    if not os.path.exists(KEY_PATH):
        raise FileNotFoundError(f"Firebase service account file not found at: {KEY_PATH}")

    cred = credentials.Certificate(KEY_PATH)
    return firebase_admin.initialize_app(cred)

_init()
db = firestore.client()
