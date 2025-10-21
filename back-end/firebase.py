import os

import firebase_admin
from firebase_admin import credentials, firestore

DEFAULT_SERVICE_ACCOUNT_PATH = "./scrummy-be0d6-firebase-adminsdk-fbsvc-9b33421a7f.json"
SERVICE_ACCOUNT_PATH = os.environ.get("FIREBASE_SERVICE_ACCOUNT_PATH", DEFAULT_SERVICE_ACCOUNT_PATH)
USE_EMULATOR = os.environ.get("FIREBASE_USE_EMULATOR", "").lower() in {"1", "true", "yes"}
PROJECT_ID = os.environ.get("FIREBASE_PROJECT_ID", "scrummy-be0d6")

if not firebase_admin._apps:
    if USE_EMULATOR:
        firebase_admin.initialize_app(options={"projectId": PROJECT_ID})
    else:
        try:
            cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
        except FileNotFoundError:
            firebase_admin.initialize_app(options={"projectId": PROJECT_ID})
        else:
            firebase_admin.initialize_app(cred)

db = firestore.client()
