from flask import Blueprint, request, jsonify
from datetime import datetime
import pytz
import uuid
from firebase import db

comments_bp = Blueprint('comments', __name__)

@comments_bp.route('/standalone-tasks/<task_id>/comments', methods=['GET', 'POST', 'OPTIONS'])
def standalone_comments_collection(task_id):
    if request.method == 'OPTIONS':
        return '', 200
    task_ref = db.collection('tasks').document(task_id)
    if not task_ref.get().exists:
        return jsonify({'error': 'Task not found'}), 404
    if request.method == 'GET':
        comments_ref = task_ref.collection('comments').order_by('timestamp', direction='ASCENDING')
        comments = []
        for doc in comments_ref.stream():
            comment = doc.to_dict()
            user_id = comment.get('user_id')
            author = None
            if user_id:
                user_doc = db.collection('users').document(user_id).get()
                if user_doc.exists:
                    user_data = user_doc.to_dict()
                    author = user_data.get('fullName') or user_data.get('name')
                else:
                    author = None
            comment['author'] = author
            comment['id'] = doc.id
            comments.append(comment)
        return jsonify(comments)
    if request.method == 'POST':
        data = request.json
        comment_id = str(uuid.uuid4())
        user_id = data.get('user_id')
        author = None
        if user_id:
            user_doc = db.collection('users').document(user_id).get()
            if user_doc.exists:
                user_data = user_doc.to_dict()
                author = user_data.get('fullName') or user_data.get('name')
            else:
                author = None
        utc_now = datetime.utcnow()
        sgt = pytz.timezone('Asia/Singapore')
        sgt_now = pytz.utc.localize(utc_now).astimezone(sgt)
        comment = {
            'user_id': user_id,
            'author': author,
            'text': data.get('text'),
            'timestamp': sgt_now.isoformat(),
            'edited': False
        }
        task_ref.collection('comments').document(comment_id).set(comment)
        comment['id'] = comment_id
        return jsonify(comment), 201

# Standalone task comment item endpoints
@comments_bp.route('/standalone-tasks/<task_id>/comments/<comment_id>', methods=['PUT', 'DELETE', 'OPTIONS'])
def standalone_comment_item(task_id, comment_id):
    if request.method == 'OPTIONS':
        return '', 200
    task_ref = db.collection('tasks').document(task_id)
    if not task_ref.get().exists:
        return jsonify({'error': 'Task not found'}), 404
    
    comment_ref = task_ref.collection('comments').document(comment_id)
    
    if request.method == 'PUT':
        data = request.json
        doc = comment_ref.get()
        if not doc.exists:
            return jsonify({'error': 'Comment not found'}), 404
        comment = doc.to_dict()
        comment['text'] = data.get('text', comment.get('text'))
        comment['edited'] = True
        # Format edited_timestamp in SGT and ISO format
        utc_now = datetime.utcnow()
        sgt = pytz.timezone('Asia/Singapore')
        sgt_now = pytz.utc.localize(utc_now).astimezone(sgt)
        comment['edited_timestamp'] = sgt_now.isoformat()
        # Update author if user_id changes
        user_id = comment.get('user_id')
        author = comment.get('author')
        if user_id:
            user_doc = db.collection('users').document(user_id).get()
            if user_doc.exists:
                user_data = user_doc.to_dict()
                author = user_data.get('fullName') or user_data.get('name')
            else:
                author = None
        comment['author'] = author
        comment_ref.set(comment)
        comment['id'] = comment_id
        return jsonify(comment)
    
    if request.method == 'DELETE':
        doc = comment_ref.get()
        if not doc.exists:
            return jsonify({'error': 'Comment not found'}), 404
        comment_ref.delete()
        return jsonify({'success': True})


# Expect project_id as query param for all endpoints
@comments_bp.route('/tasks/<task_id>/comments', methods=['GET', 'POST', 'OPTIONS'])
def comments_collection(task_id):
    project_id = request.args.get('project_id')
    if not project_id:
        return jsonify({'error': 'Missing project_id'}), 400
    if request.method == 'OPTIONS':
        return '', 200
    if request.method == 'GET':
        # Check if project and task exist
        project_ref = db.collection('projects').document(project_id)
        if not project_ref.get().exists:
            return jsonify({'error': 'Project not found'}), 404
        task_ref = project_ref.collection('tasks').document(task_id)
        if not task_ref.get().exists:
            return jsonify({'error': 'Task not found'}), 404
        # Query Firestore for comments ordered by timestamp ascending
        comments_ref = task_ref.collection('comments').order_by('timestamp', direction='ASCENDING')
        comments = []
        for doc in comments_ref.stream():
            comment = doc.to_dict()
            user_id = comment.get('user_id')
            author = None
            if user_id:
                user_doc = db.collection('users').document(user_id).get()
                if user_doc.exists:
                    user_data = user_doc.to_dict()
                    author = user_data.get('fullName') or user_data.get('name')
                else:
                    author = None
            comment['author'] = author
            comment['id'] = doc.id
            comments.append(comment)
        return jsonify(comments)
    if request.method == 'POST':
        # Check if project and task exist
        project_ref = db.collection('projects').document(project_id)
        if not project_ref.get().exists:
            return jsonify({'error': 'Project not found'}), 404
        task_ref = project_ref.collection('tasks').document(task_id)
        if not task_ref.get().exists:
            return jsonify({'error': 'Task not found'}), 404
        data = request.json
        comment_id = str(uuid.uuid4())
        user_id = data.get('user_id')
        author = None
        if user_id:
            user_doc = db.collection('users').document(user_id).get()
            if user_doc.exists:
                user_data = user_doc.to_dict()
                author = user_data.get('fullName') or user_data.get('name')
            else:
                author = None
        # Use pytz to convert UTC to Singapore Time (SGT, UTC+8)
        utc_now = datetime.utcnow()
        sgt = pytz.timezone('Asia/Singapore')
        sgt_now = pytz.utc.localize(utc_now).astimezone(sgt)
        comment = {
            'user_id': user_id,
            'author': author,
            'text': data.get('text'),
            'timestamp': sgt_now.isoformat(),
            'edited': False
        }
        task_ref.collection('comments').document(comment_id).set(comment)
        comment['id'] = comment_id
        return jsonify(comment), 201

@comments_bp.route('/tasks/<task_id>/comments/<comment_id>', methods=['PUT', 'DELETE', 'OPTIONS'])
def comment_item(task_id, comment_id):
    project_id = request.args.get('project_id')
    if not project_id:
        return jsonify({'error': 'Missing project_id'}), 400
    if request.method == 'OPTIONS':
        return '', 200
    # Check if project and task exist
    project_ref = db.collection('projects').document(project_id)
    if not project_ref.get().exists:
        return jsonify({'error': 'Project not found'}), 404
    task_ref = project_ref.collection('tasks').document(task_id)
    if not task_ref.get().exists:
        return jsonify({'error': 'Task not found'}), 404
    comment_ref = task_ref.collection('comments').document(comment_id)
    if request.method == 'PUT':
        data = request.json
        doc = comment_ref.get()
        if not doc.exists:
            return jsonify({'error': 'Comment not found'}), 404
        comment = doc.to_dict()
        comment['text'] = data.get('text', comment.get('text'))
        comment['edited'] = True
        # Format edited_timestamp in SGT and ISO format
        utc_now = datetime.utcnow()
        sgt = pytz.timezone('Asia/Singapore')
        sgt_now = pytz.utc.localize(utc_now).astimezone(sgt)
        comment['edited_timestamp'] = sgt_now.isoformat()
        # update author if user_id changes
        user_id = comment.get('user_id')
        author = comment.get('author')
        if user_id:
            user_doc = db.collection('users').document(user_id).get()
            if user_doc.exists:
                user_data = user_doc.to_dict()
                author = user_data.get('fullName') or user_data.get('name')
            else:
                author = None
        comment['author'] = author
        comment_ref.set(comment)
        comment['id'] = comment_id
        return jsonify(comment)
    if request.method == 'DELETE':
        doc = comment_ref.get()
        if not doc.exists:
            return jsonify({'error': 'Comment not found'}), 404
        comment_ref.delete()
        return jsonify({'success': True})