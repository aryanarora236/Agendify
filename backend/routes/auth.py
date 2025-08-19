from flask import Blueprint, request, jsonify, session, redirect, url_for
from flask_login import login_user, logout_user, login_required, current_user
from authlib.integrations.flask_client import OAuth
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
import os
from datetime import datetime, timedelta
from ..models import db, User

auth_bp = Blueprint('auth', __name__)

# OAuth setup
oauth = OAuth()
google = oauth.register(
    name='google',
    client_id=os.getenv('GOOGLE_CLIENT_ID'),
    client_secret=os.getenv('GOOGLE_CLIENT_SECRET'),
    access_token_url='https://accounts.google.com/o/oauth2/token',
    access_token_params=None,
    authorize_url='https://accounts.google.com/o/oauth2/auth',
    authorize_params=None,
    api_base_url='https://www.googleapis.com/oauth2/v1/',
    userinfo_endpoint='https://openidconnect.googleapis.com/v1/userinfo',
    client_kwargs={'scope': os.getenv('GOOGLE_SCOPES', 'openid email profile')}
)

@auth_bp.route('/login')
def login():
    """Initiate Google OAuth login"""
    redirect_uri = url_for('auth.callback', _external=True)
    return google.authorize_redirect(redirect_uri)

@auth_bp.route('/callback')
def callback():
    """Handle Google OAuth callback"""
    try:
        token = google.authorize_access_token()
        resp = google.get('userinfo')
        user_info = resp.json()
        
        # Check if user exists
        user = User.query.filter_by(google_sub=user_info['sub']).first()
        
        if not user:
            # Create new user
            user = User(
                email=user_info['email'],
                google_sub=user_info['sub'],
                name=user_info.get('name'),
                picture=user_info.get('picture'),
                access_token=token['access_token'],
                refresh_token=token.get('refresh_token'),
                token_expiry=datetime.utcnow() + timedelta(seconds=token.get('expires_in', 3600))
            )
            db.session.add(user)
        else:
            # Update existing user's tokens
            user.access_token = token['access_token']
            user.refresh_token = token.get('refresh_token')
            user.token_expiry = datetime.utcnow() + timedelta(seconds=token.get('expires_in', 3600))
            user.name = user_info.get('name')
            user.picture = user_info.get('picture')
        
        db.session.commit()
        login_user(user)
        
        # Return success response for API calls
        if request.headers.get('Accept') == 'application/json':
            return jsonify({
                'success': True,
                'user': user.to_dict(),
                'message': 'Login successful'
            })
        
        # Redirect for web interface
        return redirect(os.getenv('FRONTEND_URL', 'http://localhost:3000'))
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/logout')
@login_required
def logout():
    """Logout user"""
    logout_user()
    return jsonify({'success': True, 'message': 'Logout successful'})

@auth_bp.route('/me')
@login_required
def get_current_user():
    """Get current user information"""
    return jsonify({
        'success': True,
        'user': current_user.to_dict()
    })

@auth_bp.route('/refresh-token')
@login_required
def refresh_token():
    """Refresh Google access token"""
    try:
        if not current_user.refresh_token:
            return jsonify({'error': 'No refresh token available'}), 400
        
        credentials = Credentials(
            token=current_user.access_token,
            refresh_token=current_user.refresh_token,
            token_uri='https://oauth2.googleapis.com/token',
            client_id=os.getenv('GOOGLE_CLIENT_ID'),
            client_secret=os.getenv('GOOGLE_CLIENT_SECRET')
        )
        
        if credentials.expired and credentials.refresh_token:
            credentials.refresh(Request())
            
            # Update user's tokens
            current_user.access_token = credentials.token
            current_user.token_expiry = datetime.utcnow() + timedelta(seconds=credentials.expiry.timestamp() - datetime.utcnow().timestamp())
            db.session.commit()
            
            return jsonify({'success': True, 'message': 'Token refreshed'})
        
        return jsonify({'success': True, 'message': 'Token still valid'})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500 