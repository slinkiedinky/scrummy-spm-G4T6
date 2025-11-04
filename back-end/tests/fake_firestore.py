"""
Fake Firestore implementation for testing without requiring Firebase credentials.
"""
import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple
from unittest.mock import MagicMock


class FakeDocument:
    """Mock Firestore document"""
    
    def __init__(self, doc_id: str, data: Dict[str, Any]):
        self.id = doc_id
        self._data = data
    
    def to_dict(self) -> Dict[str, Any]:
        return self._data.copy()
    
    def exists(self) -> bool:
        return self._data is not None
    
    def get(self, field_path: str = None):
        if field_path:
            return self._data.get(field_path)
        return self._data


class FakeDocumentReference:
    """Mock Firestore document reference"""
    
    def __init__(self, doc_id: str, collection: 'FakeCollection'):
        self.id = doc_id
        self._collection = collection
    
    def set(self, data: Dict[str, Any]):
        """Set document data"""
        processed_data = self._collection._process_server_timestamps(data)
        self._collection._documents[self.id] = processed_data
        return self
    
    def update(self, data: Dict[str, Any]):
        """Update document data"""
        if self.id in self._collection._documents:
            existing_data = self._collection._documents[self.id].copy()
            processed_updates = self._collection._process_server_timestamps(data)
            existing_data.update(processed_updates)
            self._collection._documents[self.id] = existing_data
        else:
            self.set(data)
        return self
    
    def get(self):
        """Get document data"""
        if self.id in self._collection._documents:
            return FakeDocument(self.id, self._collection._documents[self.id])
        return FakeDocument(self.id, {})
    
    def delete(self):
        """Delete document"""
        if self.id in self._collection._documents:
            del self._collection._documents[self.id]
        return self
    
    def collection(self, collection_name: str):
        """Get subcollection"""
        full_name = f"{self._collection.name}/{self.id}/{collection_name}"
        return FakeCollection(full_name)


class FakeCollection:
    """Mock Firestore collection"""
    
    def __init__(self, name: str):
        self.name = name
        self._documents: Dict[str, Dict[str, Any]] = {}
    
    def document(self, doc_id: str = None):
        """Get or create a document reference"""
        if doc_id is None:
            doc_id = str(uuid.uuid4())
        
        # Return a document reference
        doc_ref = FakeDocumentReference(doc_id, self)
        return doc_ref
    
    def add(self, data: Dict[str, Any], doc_id: str = None) -> Tuple[Any, FakeDocumentReference]:
        """Add a document to the collection - returns tuple like real Firestore"""
        if doc_id is None:
            doc_id = str(uuid.uuid4())
        
        # Process server timestamps
        processed_data = self._process_server_timestamps(data)
        self._documents[doc_id] = processed_data
        
        # Create document reference
        doc_ref = FakeDocumentReference(doc_id, self)
        
        # Return tuple format like real Firestore: (update_time, document_reference)
        return (datetime.now(), doc_ref)
    
    def stream(self):
        """Stream all documents in the collection"""
        for doc_id, data in self._documents.items():
            yield FakeDocument(doc_id, data)
    
    def where(self, field_path: str, op: str, value: Any):
        """Simple where query implementation"""
        query = FakeQuery(self, [(field_path, op, value)])
        return query
    
    def get(self):
        """Get all documents"""
        return list(self.stream())
    
    def _process_server_timestamps(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Process SERVER_TIMESTAMP placeholders"""
        processed = data.copy()
        for key, value in processed.items():
            if hasattr(value, '_sentinel') or str(value) == 'SERVER_TIMESTAMP':
                processed[key] = datetime.now()
        return processed


class FakeQuery:
    """Mock Firestore query"""
    
    def __init__(self, collection: FakeCollection, filters: List[tuple]):
        self._collection = collection
        self._filters = filters
    
    def where(self, field_path: str, op: str, value: Any):
        """Add another where clause"""
        new_filters = self._filters + [(field_path, op, value)]
        return FakeQuery(self._collection, new_filters)
    
    def stream(self):
        """Stream filtered documents"""
        for doc_id, data in self._collection._documents.items():
            if self._matches_filters(data):
                yield FakeDocument(doc_id, data)
    
    def get(self):
        """Get filtered documents"""
        return list(self.stream())
    
    def _matches_filters(self, data: Dict[str, Any]) -> bool:
        """Check if document matches all filters"""
        for field_path, op, value in self._filters:
            field_value = data.get(field_path)
            
            if op == '==':
                if field_value != value:
                    return False
            elif op == '!=':
                if field_value == value:
                    return False
            elif op == '<':
                if field_value >= value:
                    return False
            elif op == '<=':
                if field_value > value:
                    return False
            elif op == '>':
                if field_value <= value:
                    return False
            elif op == '>=':
                if field_value < value:
                    return False
            elif op == 'in':
                if field_value not in value:
                    return False
            elif op == 'not-in':
                if field_value in value:
                    return False
            elif op == 'array-contains':
                if not isinstance(field_value, list) or value not in field_value:
                    return False
        
        return True


class FakeFirestore:
    """Mock Firestore client"""
    
    def __init__(self):
        self._collections: Dict[str, FakeCollection] = {}
    
    def collection(self, collection_name: str):
        """Get or create a collection"""
        if collection_name not in self._collections:
            self._collections[collection_name] = FakeCollection(collection_name)
        return self._collections[collection_name]
    
    def document(self, document_path: str):
        """Get document by path (e.g., 'users/user1')"""
        parts = document_path.split('/')
        if len(parts) < 2:
            raise ValueError("Document path must include collection and document ID")
        
        collection_name = parts[0]
        doc_id = parts[1]
        
        collection = self.collection(collection_name)
        return collection.document(doc_id)


# Mock SERVER_TIMESTAMP for compatibility
class ServerTimestamp:
    _sentinel = True
    
    def __str__(self):
        return 'SERVER_TIMESTAMP'


# Create a mock firestore module with SERVER_TIMESTAMP
class MockFirestore:
    SERVER_TIMESTAMP = ServerTimestamp()
    
    @staticmethod
    def client():
        return FakeFirestore()


# Make it available for import
firestore = MockFirestore()