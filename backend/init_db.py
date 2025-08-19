#!/usr/bin/env python3
"""
Database initialization script for Agendify
"""

from app import create_app, db
from models import User, Task

def init_database():
    """Initialize the database and create tables"""
    app = create_app()
    
    with app.app_context():
        # Create all tables
        db.create_all()
        print("✅ Database tables created successfully!")
        
        # Check if we have any users
        user_count = User.query.count()
        print(f"📊 Current users in database: {user_count}")
        
        # Check if we have any tasks
        task_count = Task.query.count()
        print(f"📋 Current tasks in database: {task_count}")

if __name__ == '__main__':
    init_database() 