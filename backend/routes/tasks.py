from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from datetime import datetime
from ..models import db, Task

tasks_bp = Blueprint('tasks', __name__)

@tasks_bp.route('/', methods=['GET'])
@login_required
def get_tasks():
    """Get user's tasks with optional filtering"""
    try:
        # Get query parameters
        date_filter = request.args.get('date')
        completed = request.args.get('completed')
        
        # Build query
        query = Task.query.filter_by(user_id=current_user.id)
        
        # Filter by date if specified
        if date_filter:
            try:
                filter_date = datetime.fromisoformat(date_filter).date()
                query = query.filter(
                    db.func.date(Task.due_at) == filter_date
                )
            except ValueError:
                return jsonify({'error': 'Invalid date format'}), 400
        
        # Filter by completion status
        if completed is not None:
            completed_bool = completed.lower() == 'true'
            query = query.filter(Task.completed == completed_bool)
        
        # Get tasks ordered by due date and priority
        tasks = query.order_by(
            Task.due_at.asc().nullslast(),
            Task.priority.desc(),
            Task.created_at.desc()
        ).all()
        
        return jsonify({
            'success': True,
            'tasks': [task.to_dict() for task in tasks],
            'count': len(tasks)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@tasks_bp.route('/today')
@login_required
def get_today_tasks():
    """Get today's tasks"""
    try:
        today = datetime.utcnow().date()
        
        tasks = Task.query.filter(
            Task.user_id == current_user.id,
            db.func.date(Task.due_at) == today
        ).order_by(
            Task.due_at.asc().nullslast(),
            Task.priority.desc()
        ).all()
        
        return jsonify({
            'success': True,
            'tasks': [task.to_dict() for task in tasks],
            'count': len(tasks)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@tasks_bp.route('/', methods=['POST'])
@login_required
def create_task():
    """Create a new task"""
    try:
        data = request.get_json()
        
        # Validate required fields
        if not data or 'title' not in data:
            return jsonify({'error': 'Title is required'}), 400
        
        # Parse due date if provided
        due_at = None
        if data.get('due_at'):
            try:
                due_at = datetime.fromisoformat(data['due_at'].replace('Z', '+00:00'))
            except ValueError:
                return jsonify({'error': 'Invalid due date format'}), 400
        
        # Create task
        task = Task(
            user_id=current_user.id,
            title=data['title'],
            description=data.get('description', ''),
            due_at=due_at,
            priority=data.get('priority', 'medium')
        )
        
        db.session.add(task)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'task': task.to_dict(),
            'message': 'Task created successfully'
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@tasks_bp.route('/<int:task_id>', methods=['GET'])
@login_required
def get_task(task_id):
    """Get a specific task"""
    try:
        task = Task.query.filter_by(
            id=task_id,
            user_id=current_user.id
        ).first()
        
        if not task:
            return jsonify({'error': 'Task not found'}), 404
        
        return jsonify({
            'success': True,
            'task': task.to_dict()
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@tasks_bp.route('/<int:task_id>', methods=['PUT'])
@login_required
def update_task(task_id):
    """Update a task"""
    try:
        task = Task.query.filter_by(
            id=task_id,
            user_id=current_user.id
        ).first()
        
        if not task:
            return jsonify({'error': 'Task not found'}), 404
        
        data = request.get_json()
        
        # Update fields
        if 'title' in data:
            task.title = data['title']
        if 'description' in data:
            task.description = data['description']
        if 'due_at' in data:
            if data['due_at']:
                try:
                    task.due_at = datetime.fromisoformat(data['due_at'].replace('Z', '+00:00'))
                except ValueError:
                    return jsonify({'error': 'Invalid due date format'}), 400
            else:
                task.due_at = None
        if 'priority' in data:
            task.priority = data['priority']
        if 'completed' in data:
            task.completed = bool(data['completed'])
        
        task.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'success': True,
            'task': task.to_dict(),
            'message': 'Task updated successfully'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@tasks_bp.route('/<int:task_id>', methods=['DELETE'])
@login_required
def delete_task(task_id):
    """Delete a task"""
    try:
        task = Task.query.filter_by(
            id=task_id,
            user_id=current_user.id
        ).first()
        
        if not task:
            return jsonify({'error': 'Task not found'}), 404
        
        db.session.delete(task)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Task deleted successfully'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@tasks_bp.route('/<int:task_id>/toggle', methods=['POST'])
@login_required
def toggle_task(task_id):
    """Toggle task completion status"""
    try:
        task = Task.query.filter_by(
            id=task_id,
            user_id=current_user.id
        ).first()
        
        if not task:
            return jsonify({'error': 'Task not found'}), 404
        
        task.completed = not task.completed
        task.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'success': True,
            'task': task.to_dict(),
            'message': f'Task marked as {"completed" if task.completed else "incomplete"}'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500 