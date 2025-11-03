"""
Fake Firestore implementation for testing
"""
from datetime import datetime, timezone
from unittest.mock import MagicMock
import copy


class FakeDocument:
    def __init__(self, doc_id, data=None):
        self.id = doc_id
        self._data = data or {}
        self.exists = data is not None
        self._collections = {}  # For nested collections
    
    def to_dict(self):
        return copy.deepcopy(self._data)
    
    def get(self):
        return self
    
    def update(self, data):
        if self._data is None:
            self._data = {}
        self._data.update(data)
        self._data['updatedAt'] = datetime.now(timezone.utc)
    
    def set(self, data):
        self._data = copy.deepcopy(data)
    
    def delete(self):
        self._data = None
        self.exists = False
    
    def collection(self, name):
        """Support nested collections like projects/{id}/tasks"""
        if name not in self._collections:
            self._collections[name] = FakeCollection(name)
        return self._collections[name]


# Add the missing FakeDocumentReference class (alias for FakeDocument)
class FakeDocumentReference(FakeDocument):
    """Document reference - same as FakeDocument but with reference semantics"""
    pass


class FakeCollection:
    def __init__(self, name):
        self.name = name
        self.documents = {}
        self._doc_counter = 0
    
    def add(self, data):
        # Generate a new document ID
        self._doc_counter += 1
        doc_id = f"{self.name}_doc_{self._doc_counter}"
        
        # Add timestamps
        now = datetime.now(timezone.utc)
        doc_data = copy.deepcopy(data)
        doc_data.update({
            'createdAt': now,
            'updatedAt': now
        })
        
        # Create document reference
        doc_ref = FakeDocumentReference(doc_id, doc_data)
        self.documents[doc_id] = doc_ref
        
        # Return (timestamp, document_reference) tuple
        return (now, doc_ref)
    
    def document(self, doc_id):
        if doc_id in self.documents:
            return self.documents[doc_id]
        else:
            # Return a document reference that doesn't exist
            return FakeDocumentReference(doc_id, None)
    
    def where(self, field, operator, value):
        # Return a query object
        return FakeQuery(self, field, operator, value)
    
    def stream(self):
        return list(self.documents.values())
    
    def get(self):
        return list(self.documents.values())


class FakeQuery:
    def __init__(self, collection, field, operator, value):
        self.collection = collection
        self.field = field
        self.operator = operator
        self.value = value
    
    def stream(self):
        results = []
        for doc in self.collection.documents.values():
            if doc.exists and self._matches(doc._data):
                results.append(doc)
        return results
    
    def get(self):
        return self.stream()
    
    def where(self, field, operator, value):
        # Chain additional where clauses
        return FakeQuery(self.collection, field, operator, value)
    
    def _matches(self, data):
        if self.field not in data:
            return False
        
        field_value = data[self.field]
        
        if self.operator == "==":
            return field_value == self.value
        elif self.operator == "!=":
            return field_value != self.value
        elif self.operator == "in":
            return field_value in self.value
        elif self.operator == "not-in":
            return field_value not in self.value
        elif self.operator == ">":
            return field_value > self.value
        elif self.operator == ">=":
            return field_value >= self.value
        elif self.operator == "<":
            return field_value < self.value
        elif self.operator == "<=":
            return field_value <= self.value
        
        return False


class FakeFirestore:
    def __init__(self):
        self.collections = {}
    
    def collection(self, name):
        if name not in self.collections:
            self.collections[name] = FakeCollection(name)
        return self.collections[name]
    
    def reset(self):
        """Reset all collections for testing"""
        self.collections.clear()