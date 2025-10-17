def fetch_document_by_field(collection_name, field_name, value):
    try:
        db = firestore.client()
        docs = db.collection(collection_name).where(field_name, '==', value).stream()
        for doc in docs:
            return {"id": doc.id, **doc.to_dict()}
        return None
    except Exception as e:
        return {"error": str(e)}
from firebase_admin import firestore

def fetch_collection(collection_name):
    try:
        db = firestore.client()
        collection_ref = db.collection(collection_name)
        docs = collection_ref.stream()
        return [{"id": doc.id, **doc.to_dict()} for doc in docs]
    except Exception as e:
        return {"error": str(e)}
    
def delete_document(collection_name, document_id):
    try:
        db = firestore.client()
        doc_ref = db.collection(collection_name).document(document_id)
        doc_ref.delete()
        return {"success": True}
    except Exception as e:
        return {"error": str(e)}

def update_document(collection_name, document_id, data):
    try:
        db = firestore.client()
        doc_ref = db.collection(collection_name).document(document_id)
        doc_ref.set(data, merge=True)
        return {"success": True}
    except Exception as e:
        return {"error": str(e)}

def add_document(collection_name, data):
    try:
        db = firestore.client()
        collection_ref = db.collection(collection_name)
        doc_ref = collection_ref.add(data)
        # add returns (reference, write_result) in firebase-admin
        return {"success": True}
    except Exception as e:
        return {"error": str(e)}