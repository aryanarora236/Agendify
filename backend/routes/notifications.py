from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from datetime import datetime, timedelta
from ..models import db, Task
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

notifications_bp = Blueprint('notifications', __name__)

def get_calendar_service():
    """Get Google Calendar service with user's credentials"""
    credentials = Credentials(
        token=current_user.access_token,
        refresh_token=current_user.refresh_token,
        token_uri='https://oauth2.googleapis.com/token',
        client_id=os.getenv('GOOGLE_CLIENT_ID'),
        client_secret=os.getenv('GOOGLE_CLIENT_SECRET')
    )
    
    # Refresh token if expired
    if credentials.expired and credentials.refresh_token:
        credentials.refresh(Request())
        
        # Update user's access token
        current_user.access_token = credentials.token
        current_user.token_expiry = datetime.utcnow() + timedelta(seconds=credentials.expiry.timestamp() - datetime.utcnow().timestamp())
        db.session.commit()
    
    return build('calendar', 'v3', credentials=credentials)

@notifications_bp.route('/upcoming')
@login_required
def get_upcoming_notifications():
    """Get upcoming events and tasks for notifications"""
    try:
        # Get events in the next 2 hours
        now = datetime.utcnow()
        time_min = now.isoformat() + 'Z'
        time_max = (now + timedelta(hours=2)).isoformat() + 'Z'
        
        # Get calendar events
        try:
            service = get_calendar_service()
            events_result = service.events().list(
                calendarId='primary',
                timeMin=time_min,
                timeMax=time_max,
                singleEvents=True,
                orderBy='startTime'
            ).execute()
            
            events = events_result.get('items', [])
        except HttpError:
            events = []
        
        # Get tasks due in the next 2 hours
        tasks = Task.query.filter(
            Task.user_id == current_user.id,
            Task.due_at >= now,
            Task.due_at <= now + timedelta(hours=2),
            Task.completed == False
        ).order_by(Task.due_at.asc()).all()
        
        # Format upcoming items
        upcoming_items = []
        
        # Add calendar events
        for event in events:
            start = event['start'].get('dateTime', event['start'].get('date'))
            if 'T' in start:  # Has time
                start_dt = datetime.fromisoformat(start.replace('Z', '+00:00'))
                minutes_until = int((start_dt - now).total_seconds() / 60)
                
                if 0 <= minutes_until <= 120:  # Within 2 hours
                    upcoming_items.append({
                        'id': event['id'],
                        'title': event['summary'],
                        'type': 'calendar_event',
                        'start_time': start,
                        'minutes_until': minutes_until,
                        'location': event.get('location', ''),
                        'description': event.get('description', '')
                    })
        
        # Add tasks
        for task in tasks:
            minutes_until = int((task.due_at - now).total_seconds() / 60)
            if 0 <= minutes_until <= 120:  # Within 2 hours
                upcoming_items.append({
                    'id': task.id,
                    'title': task.title,
                    'type': 'task',
                    'start_time': task.due_at.isoformat(),
                    'minutes_until': minutes_until,
                    'priority': task.priority,
                    'description': task.description
                })
        
        # Sort by time
        upcoming_items.sort(key=lambda x: x['minutes_until'])
        
        return jsonify({
            'success': True,
            'upcoming_items': upcoming_items,
            'count': len(upcoming_items)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@notifications_bp.route('/daily-digest')
@login_required
def send_daily_digest():
    """Send daily digest email (called by scheduler)"""
    try:
        today = datetime.utcnow().date()
        
        # Get today's calendar events
        try:
            service = get_calendar_service()
            time_min = datetime.combine(today, datetime.min.time()).isoformat() + 'Z'
            time_max = datetime.combine(today, datetime.max.time()).isoformat() + 'Z'
            
            events_result = service.events().list(
                calendarId='primary',
                timeMin=time_min,
                timeMax=time_max,
                singleEvents=True,
                orderBy='startTime'
            ).execute()
            
            events = events_result.get('items', [])
        except HttpError:
            events = []
        
        # Get today's tasks
        tasks = Task.query.filter(
            Task.user_id == current_user.id,
            db.func.date(Task.due_at) == today
        ).order_by(Task.due_at.asc().nullslast()).all()
        
        # Format email content
        email_content = f"""
        <h2>📅 Your Daily Agenda for {today.strftime('%A, %B %d, %Y')}</h2>
        
        <h3>🗓️ Calendar Events</h3>
        """
        
        if events:
            for event in events:
                start = event['start'].get('dateTime', event['start'].get('date'))
                if 'T' in start:  # Has time
                    start_dt = datetime.fromisoformat(start.replace('Z', '+00:00'))
                    time_str = start_dt.strftime('%I:%M %p')
                else:
                    time_str = 'All Day'
                
                email_content += f"""
                <div style="margin-bottom: 10px;">
                    <strong>{time_str}</strong> - {event['summary']}
                    {f"<br><em>📍 {event.get('location', '')}</em>" if event.get('location') else ''}
                </div>
                """
        else:
            email_content += "<p>No events scheduled for today.</p>"
        
        email_content += "<h3>✅ Tasks</h3>"
        
        if tasks:
            for task in tasks:
                time_str = task.due_at.strftime('%I:%M %p') if task.due_at else 'No due time'
                status = "✅" if task.completed else "⏳"
                email_content += f"""
                <div style="margin-bottom: 10px;">
                    {status} <strong>{task.title}</strong> - Due: {time_str}
                    {f"<br><em>Priority: {task.priority.title()}</em>" if task.priority != 'medium' else ''}
                </div>
                """
        else:
            email_content += "<p>No tasks due today.</p>"
        
        # Send email
        try:
            send_email(
                to_email=current_user.email,
                subject=f"Your Daily Agenda - {today.strftime('%B %d, %Y')}",
                html_content=email_content
            )
            
            return jsonify({
                'success': True,
                'message': 'Daily digest sent successfully'
            })
            
        except Exception as e:
            return jsonify({'error': f'Failed to send email: {str(e)}'}), 500
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def send_email(to_email, subject, html_content):
    """Send email using configured SMTP settings"""
    try:
        # Create message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = os.getenv('SMTP_USERNAME')
        msg['To'] = to_email
        
        # Add HTML content
        html_part = MIMEText(html_content, 'html')
        msg.attach(html_part)
        
        # Send email
        with smtplib.SMTP(os.getenv('SMTP_SERVER'), int(os.getenv('SMTP_PORT', 587))) as server:
            server.starttls()
            server.login(os.getenv('SMTP_USERNAME'), os.getenv('SMTP_PASSWORD'))
            server.send_message(msg)
            
    except Exception as e:
        raise Exception(f"SMTP error: {str(e)}")

@notifications_bp.route('/test-email')
@login_required
def test_email():
    """Test email functionality"""
    try:
        send_email(
            to_email=current_user.email,
            subject="Test Email from Agendify",
            html_content="<h1>Test Email</h1><p>This is a test email to verify your email configuration.</p>"
        )
        
        return jsonify({
            'success': True,
            'message': 'Test email sent successfully'
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500 