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

        # Notify assignee and collaborators
        try:
            from notifications import add_notification
            task_doc = task_ref.get().to_dict()
            assignee_id = task_doc.get('assigneeId') or task_doc.get('ownerId')
            collaborators = task_doc.get('collaboratorsIds', [])
            notified = set()
            project_doc = db.collection('projects').document(task_doc.get('projectId')).get().to_dict() if task_doc.get('projectId') else None
            notif_author = comment.get('author', author) or 'Unknown'
            notif_project_name = project_doc['name'] if project_doc and 'name' in project_doc else 'Standalone'
            notif = {
                'userId': None,
                'taskId': task_id,
                'commentId': comment_id,
                'type': 'task comment',
                'icon': 'messageSquare',
                'title': task_doc.get('title', '-') if task_doc else '-',
                'projectName': notif_project_name,
                'author': notif_author,
                'message': f"{notif_author} has posted a new comment \"{comment.get('text', '-')}\"",
                'text': comment.get('text', '-'),
                'timestamp': comment.get('timestamp', '-')
            }
            print('DEBUG NOTIF PAYLOAD:', notif)
            if assignee_id:
                notif['userId'] = assignee_id
                add_notification(notif, None)
                notified.add(assignee_id)
            for collab_id in collaborators:
                if collab_id and collab_id not in notified:
                    notif['userId'] = collab_id
                    add_notification(notif, None)
                    notified.add(collab_id)
        except Exception as e:
            print(f"Comment notification error: {e}")

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

        # Notify assignee and collaborators
        try:
            from notifications import add_notification
            task_doc = task_ref.get().to_dict()
            assignee_id = task_doc.get('assigneeId') or task_doc.get('ownerId')
            collaborators = task_doc.get('collaboratorsIds', [])
            notified = set()
            project_doc = db.collection('projects').document(project_id).get().to_dict() if project_id else None
            notif_author = author or 'Unknown'
            notif_project_name = project_doc['name'] if project_doc and 'name' in project_doc else 'Unknown Project'
            notif = {
                'userId': None,
                'projectId': project_id,
                'taskId': task_id,
                'commentId': comment_id,
                'type': 'task comment',
                'icon': 'messageSquare',
                'title': task_doc.get('title', '-') if task_doc else '-',
                'projectName': notif_project_name,
                'author': notif_author,
                'message': comment.get('text', '-'),
                'text': comment.get('text', '-'),
                'timestamp': comment.get('timestamp', '-')
            }
            # print('DEBUG NOTIF PAYLOAD:', notif)
            if assignee_id:
                notif['userId'] = assignee_id
                add_notification(notif, notif_project_name)
                notified.add(assignee_id)
            for collab_id in collaborators:
                if collab_id and collab_id not in notified:
                    notif['userId'] = collab_id
                    add_notification(notif, notif_project_name)
                    notified.add(collab_id)
        except Exception as e:
            print(f"Comment notification error: {e}")

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