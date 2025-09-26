import os
import sys
from collections import defaultdict
from datetime import datetime, timezone
from typing import Dict, Iterable, List, Optional, Tuple

import pytest

# Ensure the back-end folder is on the import path
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from app import app as flask_app  # noqa: E402
import projects  # noqa: E402


class FakeDocument:
    """In-memory representation of a Firestore document."""

    def __init__(self, data: Optional[Dict] = None):
        self.data: Dict = data.copy() if data else {}
        self.subcollections: Dict[str, Dict[str, "FakeDocument"]] = defaultdict(dict)


class FakeDocumentSnapshot:
    def __init__(self, doc_id: str, document: FakeDocument, collection: "FakeCollection"):
        self.id = doc_id
        self._document = document
        self._collection = collection
        self.exists = document is not None

    def to_dict(self):
        if not self.exists:
            return None
        return self._document.data.copy()


class FakeDocumentReference:
    def __init__(self, collection: "FakeCollection", doc_id: str):
        self._collection = collection
        self.id = doc_id

    def _get_document(self, create_if_missing: bool = False) -> Optional[FakeDocument]:
        docs = self._collection._docs
        if self.id not in docs and create_if_missing:
            docs[self.id] = FakeDocument()
        return docs.get(self.id)

    def get(self):
        doc = self._collection._docs.get(self.id)
        if doc is None:
            snapshot = FakeDocumentSnapshot(self.id, FakeDocument(), self._collection)
            snapshot.exists = False
            return snapshot
        return FakeDocumentSnapshot(self.id, doc, self._collection)

    def set(self, data: Dict):
        self._collection._docs[self.id] = FakeDocument(data)

    def update(self, patch: Dict):
        doc = self._get_document(create_if_missing=True)
        doc.data.update(patch)

    def delete(self):
        self._collection._docs.pop(self.id, None)

    def collection(self, name: str) -> "FakeCollection":
        doc = self._get_document(create_if_missing=True)
        subdocs = doc.subcollections[name]
        return FakeCollection(self._collection._firestore, name, subdocs)


class FakeQuery:
    def __init__(self, collection: "FakeCollection", filters: Optional[List[Tuple[str, str, object]]] = None):
        self._collection = collection
        self._filters = filters or []

    def where(self, field: str = None, op: str = None, value: object = None, *, filter=None):
        if filter is not None:
            field, op, value = filter.field, filter.op, filter.value
        if op != "==":
            raise NotImplementedError("FakeQuery only supports equality filters")
        return FakeQuery(self._collection, self._filters + [(field, value)])

    def stream(self) -> Iterable[FakeDocumentSnapshot]:
        for doc_id, document in self._collection._docs.items():
            if self._matches(document.data):
                yield FakeDocumentSnapshot(doc_id, document, self._collection)

    def _matches(self, data: Dict) -> bool:
        for field, value in self._filters:
            if data.get(field) != value:
                return False
        return True


class FakeCollection:
    def __init__(self, firestore: "FakeFirestore", name: str, docs: Dict[str, FakeDocument]):
        self._firestore = firestore
        self._name = name
        self._docs = docs

    def add(self, data: Dict):
        doc_id = self._firestore._next_id(self._name)
        self._docs[doc_id] = FakeDocument(data)
        return None, FakeDocumentReference(self, doc_id)

    def document(self, doc_id: str):
        return FakeDocumentReference(self, doc_id)

    def where(self, field: str = None, op: str = None, value: object = None, *, filter=None):
        return FakeQuery(self, [(field if filter is None else filter.field,
                                 value if filter is None else filter.value)])

    def stream(self) -> Iterable[FakeDocumentSnapshot]:
        for doc_id, document in self._docs.items():
            yield FakeDocumentSnapshot(doc_id, document, self)


class FakeCollectionGroup:
    def __init__(self, firestore: "FakeFirestore", name: str):
        self._firestore = firestore
        self._name = name
        self._filters: List[Tuple[str, object]] = []

    def where(self, field: str = None, op: str = None, value: object = None, *, filter=None):
        if filter is not None:
            field, op, value = filter.field, filter.op, filter.value
        if op != "==":
            raise NotImplementedError("FakeCollectionGroup only supports equality filters")
        self._filters.append((field, value))
        return self

    def stream(self) -> Iterable[FakeDocumentSnapshot]:
        for path, collection in self._firestore._iterate_subcollections(self._name):
            for doc_id, document in collection._docs.items():
                if all(document.data.get(field) == value for field, value in self._filters):
                    yield FakeDocumentSnapshot(doc_id, document, collection)


class FakeFirestore:
    def __init__(self):
        self._collections: Dict[str, Dict[str, FakeDocument]] = defaultdict(dict)
        self._counters = defaultdict(int)

    def _next_id(self, prefix: str) -> str:
        self._counters[prefix] += 1
        return f"{prefix}-{self._counters[prefix]}"

    def collection(self, name: str) -> FakeCollection:
        return FakeCollection(self, name, self._collections[name])

    def collection_group(self, name: str) -> FakeCollectionGroup:
        return FakeCollectionGroup(self, name)

    def _iterate_subcollections(self, target_name: str):
        for collection in self._collections.values():
            for document in collection.values():
                if target_name in document.subcollections:
                    yield target_name, FakeCollection(self, target_name, document.subcollections[target_name])


@pytest.fixture
def test_client(monkeypatch):
    fake_db = FakeFirestore()
    monkeypatch.setattr(projects, "db", fake_db)
    monkeypatch.setattr(projects, "now_utc", lambda: datetime(2024, 1, 1, tzinfo=timezone.utc))

    flask_app.config.update(TESTING=True)
    with flask_app.test_client() as client:
        yield client, fake_db


def test_create_project_includes_owner_in_team(test_client):
    client, fake_db = test_client

    payload = {
        "name": "New Initiative",
        "ownerId": "owner-1",
        "teamIds": ["member-1"],
        "status": "doing",
        "priority": "HIGH",
    }

    resp = client.post("/api/projects/", json=payload)
    assert resp.status_code == 201

    project_id = resp.get_json()["id"]
    doc_snapshot = fake_db.collection("projects").document(project_id).get()
    assert doc_snapshot.exists

    stored = doc_snapshot.to_dict()
    assert stored["ownerId"] == "owner-1"
    # owner should be automatically part of the team
    assert "owner-1" in stored["teamIds"]
    # priority is normalised to the low/medium/high bucket
    assert stored["priority"] == "high"
    # status is canonicalised
    assert stored["status"] == "in progress"


def test_list_projects_filters_by_assigned_member(test_client):
    client, fake_db = test_client
    projects_col = fake_db.collection("projects")

    projects_col.document("proj-a").set({
        "name": "Alpha",
        "status": "doing",
        "priority": "medium",
        "teamIds": ["user-1"],
        "ownerId": "user-1",
    })
    projects_col.document("proj-b").set({
        "name": "Beta",
        "status": "blocked",
        "priority": "low",
        "teamIds": ["user-2"],
        "ownerId": "user-2",
    })

    resp = client.get("/api/projects/?assignedTo=user-1")
    assert resp.status_code == 200
    data = resp.get_json()
    assert len(data) == 1
    assert data[0]["name"] == "Alpha"
    # status is normalised
    assert data[0]["status"] == "in progress"


def test_get_project_forbidden_when_user_not_on_team(test_client):
    client, fake_db = test_client
    fake_db.collection("projects").document("proj-x").set({
        "name": "Secret",
        "status": "to-do",
        "priority": "medium",
        "teamIds": ["owner-1"],
        "ownerId": "owner-1",
    })

    resp = client.get("/api/projects/proj-x?assignedTo=user-2")
    assert resp.status_code == 403
    assert resp.get_json()["error"] == "Forbidden"


def test_list_tasks_filters_by_assignee(test_client):
    client, fake_db = test_client
    project_ref = fake_db.collection("projects").document("proj-t")
    project_ref.set({
        "name": "Web Revamp",
        "status": "in progress",
        "priority": "medium",
        "teamIds": ["owner-1", "user-1", "user-2"],
        "ownerId": "owner-1",
    })

    tasks_col = project_ref.collection("tasks")
    tasks_col.document("task-1").set({
        "title": "Design",
        "assigneeId": "user-1",
        "status": "to-do",
        "priority": 5,
    })
    tasks_col.document("task-2").set({
        "title": "Testing",
        "assigneeId": "user-2",
        "status": "completed",
        "priority": 3,
    })

    resp = client.get("/api/projects/proj-t/tasks?assigneeId=user-1")
    assert resp.status_code == 200
    data = resp.get_json()
    assert len(data) == 1
    assert data[0]["title"] == "Design"
    assert data[0]["assigneeId"] == "user-1"


def test_update_project_casts_tags_and_priority(test_client):
    client, fake_db = test_client
    project_ref = fake_db.collection("projects").document("proj-update")
    project_ref.set({
        "name": "Ops",
        "status": "to-do",
        "priority": "low",
        "teamIds": ["owner"],
        "ownerId": "owner",
    })

    resp = client.put(
        "/api/projects/proj-update",
        json={"priority": "9", "tags": "ops"},
    )
    assert resp.status_code == 200

    stored = project_ref.get().to_dict()
    # numeric priority mapped to bucket
    assert stored["priority"] == "high"
    # tags coerced into list
    assert stored["tags"] == ["ops"]
