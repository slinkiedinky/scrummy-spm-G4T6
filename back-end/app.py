# back-end/app.py
from flask import Flask, jsonify
from flask_cors import CORS
from firebase import db  # from back-end/firebase.py

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

def _ts_to_iso(ts):
    # Handles Firestore Timestamp or str
    try:
        return ts.isoformat() if hasattr(ts, "isoformat") else str(ts)
    except Exception:
        return str(ts)

@app.get("/api/projects")
def list_projects():
    docs = db.collection("projects").stream()
    items = []
    for d in docs:
        data = d.to_dict() or {}
        # Normalize dates that are Timestamp, dict({seconds}), or string
        for k in ("dueDate", "createdAt", "updatedAt"):
            v = data.get(k)
            if v is None:
                continue
            # Firestore Timestamp object
            if hasattr(v, "to_datetime"):
                data[k] = v.to_datetime().isoformat()
            # {seconds, nanoseconds}
            elif isinstance(v, dict) and "seconds" in v:
                import datetime as _dt
                data[k] = _dt.datetime.utcfromtimestamp(v["seconds"]).isoformat()
            else:
                data[k] = _ts_to_iso(v)

        # Provide sane defaults for UI
        data.setdefault("progress", 0)
        data.setdefault("status", "active")
        data.setdefault("priority", "medium")
        data.setdefault("team", [])              # array of {id,name,avatar}
        data.setdefault("overduePercentage", 0)  # optional

        items.append({"id": d.id, **data})
    # Sort newest updated first if available
    items.sort(key=lambda x: x.get("updatedAt", ""), reverse=True)
    return jsonify(items)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
