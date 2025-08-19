from flask import Flask, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_login import LoginManager
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

# Initialize Flask extensions
db = SQLAlchemy()
migrate = Migrate()
login_manager = LoginManager()

def create_app():
    """Application factory pattern"""
    app = Flask(__name__)
    
    # Configuration
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key')
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///agendify.db')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    login_manager.init_app(app)
    login_manager.login_view = 'auth.login'
    
    # CORS configuration
    CORS(app, origins=[os.getenv('FRONTEND_URL', 'http://localhost:3000')])
    
    # Register blueprints
    from .routes.auth import auth_bp
    from .routes.calendar import calendar_bp
    from .routes.tasks import tasks_bp
    from .routes.notifications import notifications_bp
    
    app.register_blueprint(auth_bp, url_prefix='/auth')
    app.register_blueprint(calendar_bp, url_prefix='/api/calendar')
    app.register_blueprint(tasks_bp, url_prefix='/api/tasks')
    app.register_blueprint(notifications_bp, url_prefix='/api/notifications')
    
    # Health check endpoint
    @app.route('/health')
    def health_check():
        return jsonify({'status': 'healthy', 'service': 'Agendify Backend'})
    
    return app

# Create app instance
app = create_app()

if __name__ == '__main__':
    app.run(debug=os.getenv('DEBUG', 'True').lower() == 'true', host='0.0.0.0', port=5000) 