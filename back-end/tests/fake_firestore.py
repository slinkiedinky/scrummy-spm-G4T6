from collections import defaultdict
from typing import Dict, Iterable, List, Optional, Tuple

from firebase_admin import firestore


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
        self.reference = FakeDocumentReference(collection, doc_id)

    def to_dict(self):
        if not self.exists:
            return None
        return self._document.data.copy()


class FakeDocumentReference:
    def __init__(self, collection: "FakeCollection", doc_id: str):
        self._collection = collection
        self.id = doc_id

    @property
    def parent(self) -> "FakeCollection":
        return self._collection

    @property
    def path(self) -> str:
        base = getattr(self._collection, "_path", self._collection._name)
        return f"{base}/{self.id}"

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

    def set(self, data: Dict, merge: bool = False):
        if merge and self.id in self._collection._docs:
            self._collection._docs[self.id].data.update(data)
        else:
            self._collection._docs[self.id] = FakeDocument(data)

    def update(self, patch: Dict):
        doc = self._get_document(create_if_missing=True)
        for key, value in patch.items():
            if isinstance(value, firestore.ArrayUnion):
                current = doc.data.get(key, [])
                if not isinstance(current, list):
                    current = []
                for item in value.values:
                    if item not in current:
                        current.append(item)
                doc.data[key] = current
            else:
                doc.data[key] = value

    def delete(self):
        self._collection._docs.pop(self.id, None)

    def collection(self, name: str) -> "FakeCollection":
        doc = self._get_document(create_if_missing=True)
        subdocs = doc.subcollections[name]
        return FakeCollection(
            self._collection._firestore,
            name,
            subdocs,
            f"{self.path}/{name}",
            parent_ref=self,
        )


class FakeQuery:
    def __init__(self, collection: "FakeCollection", filters: Optional[List[Tuple[str, str, object]]] = None, order_by_field=None, order_direction=None):
        self._collection = collection
        self._filters = filters or []
        self._order_by_field = order_by_field
        self._order_direction = order_direction

    def where(self, field: str = None, op: str = None, value: object = None, *, filter=None):
        if filter is not None:
            field, op, value = filter.field, filter.op, filter.value
        op = op or "=="
        return FakeQuery(self._collection, self._filters + [(field, op, value)], self._order_by_field, self._order_direction)

    def order_by(self, field: str, direction: str = "ASCENDING"):
        """Add ordering to query"""
        return FakeQuery(self._collection, self._filters, field, direction)

    def limit(self, count: int):
        """Limit query results (for compatibility, returns self)"""
        # For simplicity, we don't actually limit in fake implementation
        # This is just for API compatibility
        return self

    def stream(self) -> Iterable[FakeDocumentSnapshot]:
        results = []
        for doc_id, document in self._collection._docs.items():
            if self._matches(document.data):
                results.append((doc_id, document))

        # Apply ordering if specified
        if self._order_by_field:
            reverse = self._order_direction == "DESCENDING"
            results.sort(key=lambda x: x[1].data.get(self._order_by_field, ""), reverse=reverse)

        for doc_id, document in results:
            yield FakeDocumentSnapshot(doc_id, document, self._collection)

    def _matches(self, data: Dict) -> bool:
        for field, op, value in self._filters:
            candidate = data.get(field)
            if op == "==":
                if candidate != value:
                    return False
            elif op == "array_contains":
                if not isinstance(candidate, list) or value not in candidate:
                    return False
            else:
                raise NotImplementedError(f"Unsupported operator: {op}")
        return True


class FakeCollection:
    def __init__(
        self,
        firestore: "FakeFirestore",
        name: str,
        docs: Dict[str, FakeDocument],
        path: Optional[str] = None,
        parent_ref: Optional[FakeDocumentReference] = None,
    ):
        self._firestore = firestore
        self._name = name
        self._docs = docs
        self._path = path or name
        self._parent_ref = parent_ref

    @property
    def parent(self) -> Optional[FakeDocumentReference]:
        return self._parent_ref

    def add(self, data: Dict):
        doc_id = self._firestore._next_id(self._name)
        self._docs[doc_id] = FakeDocument(data)
        return None, FakeDocumentReference(self, doc_id)

    def document(self, doc_id: Optional[str] = None):
        if doc_id is None:
            doc_id = self._firestore._next_id(self._name)
        return FakeDocumentReference(self, doc_id)

    def where(self, field: str = None, op: str = None, value: object = None, *, filter=None):
        if filter is not None:
            field, op, value = filter.field, filter.op, filter.value
        op = op or "=="
        return FakeQuery(self, [(field, op, value)])

    def order_by(self, field: str, direction: str = "ASCENDING"):
        """Add ordering to query"""
        return FakeQuery(self, order_by_field=field, order_direction=direction)

    def stream(self) -> Iterable[FakeDocumentSnapshot]:
        for doc_id, document in list(self._docs.items()):
            yield FakeDocumentSnapshot(doc_id, document, self)


class FakeCollectionGroup:
    def __init__(self, firestore: "FakeFirestore", name: str):
        self._firestore = firestore
        self._name = name
        self._filters: List[Tuple[str, object]] = []

    def where(self, field: str = None, op: str = None, value: object = None, *, filter=None):
        if filter is not None:
            field = (
                getattr(filter, "field", None)
                or getattr(filter, "field_path", None)
                or getattr(filter, "_field_path", None)
            )
            op = getattr(filter, "op", None) or getattr(filter, "_operator", None) or getattr(filter, "op_string", None)
            value = getattr(filter, "value", None) or getattr(filter, "_value", None)
        if op is not None and op != "==":
            raise NotImplementedError("FakeCollectionGroup only supports equality filters")
        self._filters.append((field, value))
        return self

    def stream(self) -> Iterable[FakeDocumentSnapshot]:
        for _, collection in self._firestore._iterate_subcollections(self._name):
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
        return FakeCollection(self, name, self._collections[name], name)

    def collection_group(self, name: str) -> FakeCollectionGroup:
        return FakeCollectionGroup(self, name)

    def _iterate_subcollections(self, target_name: str):
        for collection_name, collection in self._collections.items():
            parent_collection = FakeCollection(self, collection_name, collection, collection_name)
            for doc_id, document in collection.items():
                parent_ref = FakeDocumentReference(parent_collection, doc_id)
                if target_name in document.subcollections:
                    parent_path = parent_ref.path
                    yield target_name, FakeCollection(
                        self,
                        target_name,
                        document.subcollections[target_name],
                        f"{parent_path}/{target_name}",
                        parent_ref=parent_ref,
                    )
