import firebase_admin
from firebase_admin import credentials, firestore

cred = credentials.Certificate('./scrummy-be0d6-firebase-adminsdk-fbsvc-9b33421a7f.json')
firebase_admin.initialize_app(cred)
db = firestore.client()