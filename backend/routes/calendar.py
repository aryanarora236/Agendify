from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from datetime import datetime, timedelta
import os

calendar_bp = Blueprint('calendar', __name__)

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
        from ..models import db
        db.session.commit()
    
    return build('calendar', 'v3', credentials=credentials)

@calendar_bp.route('/events')
@login_required
def get_events():
    """Get upcoming calendar events"""
    try:
        # Get query parameters
        days = request.args.get('days', 1, type=int)
        max_results = request.args.get('max_results', 50, type=int)
        
        # Calculate time range
        now = datetime.utcnow()
        time_min = now.isoformat() + 'Z'
        time_max = (now + timedelta(days=days)).isoformat() + 'Z'
        
        service = get_calendar_service()
        
        # Get events from primary calendar
        events_result = service.events().list(
            calendarId='primary',
            timeMin=time_min,
            timeMax=time_max,
            maxResults=max_results,
            singleEvents=True,
            orderBy='startTime'
        ).execute()
        
        events = events_result.get('items', [])
        
        # Format events for frontend
        formatted_events = []
        for event in events:
            start = event['start'].get('dateTime', event['start'].get('date'))
            end = event['end'].get('dateTime', event['end'].get('date'))
            
            # Convert to datetime objects for sorting
            if 'T' in start:  # Has time
                start_dt = datetime.fromisoformat(start.replace('Z', '+00:00'))
                end_dt = datetime.fromisoformat(end.replace('Z', '+00:00'))
                is_all_day = False
            else:  # All-day event
                start_dt = datetime.fromisoformat(start)
                end_dt = datetime.fromisoformat(end)
                is_all_day = True
            
            formatted_events.append({
                'id': event['id'],
                'title': event['summary'],
                'description': event.get('description', ''),
                'start': start,
                'end': end,
                'start_dt': start_dt.isoformat(),
                'end_dt': end_dt.isoformat(),
                'is_all_day': is_all_day,
                'location': event.get('location', ''),
                'attendees': [attendee['email'] for attendee in event.get('attendees', [])],
                'calendar_id': event.get('organizer', {}).get('email', 'primary')
            })
        
        # Sort by start time
        formatted_events.sort(key=lambda x: x['start_dt'])
        
        return jsonify({
            'success': True,
            'events': formatted_events,
            'count': len(formatted_events)
        })
        
    except HttpError as error:
        return jsonify({'error': f'Calendar API error: {error}'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@calendar_bp.route('/events/today')
@login_required
def get_today_events():
    """Get today's calendar events"""
    try:
        # Get today's events
        today = datetime.utcnow().date()
        time_min = datetime.combine(today, datetime.min.time()).isoformat() + 'Z'
        time_max = datetime.combine(today, datetime.max.time()).isoformat() + 'Z'
        
        service = get_calendar_service()
        
        events_result = service.events().list(
            calendarId='primary',
            timeMin=time_min,
            timeMax=time_max,
            singleEvents=True,
            orderBy='startTime'
        ).execute()
        
        events = events_result.get('items', [])
        
        # Format events
        formatted_events = []
        for event in events:
            start = event['start'].get('dateTime', event['start'].get('date'))
            end = event['end'].get('dateTime', event['end'].get('date'))
            
            if 'T' in start:  # Has time
                start_dt = datetime.fromisoformat(start.replace('Z', '+00:00'))
                end_dt = datetime.fromisoformat(end.replace('Z', '+00:00'))
                is_all_day = False
            else:  # All-day event
                start_dt = datetime.fromisoformat(start)
                end_dt = datetime.fromisoformat(end)
                is_all_day = True
            
            formatted_events.append({
                'id': event['id'],
                'title': event['summary'],
                'description': event.get('description', ''),
                'start': start,
                'end': end,
                'start_dt': start_dt.isoformat(),
                'end_dt': end_dt.isoformat(),
                'is_all_day': is_all_day,
                'location': event.get('location', ''),
                'type': 'calendar_event'
            })
        
        # Sort by start time
        formatted_events.sort(key=lambda x: x['start_dt'])
        
        return jsonify({
            'success': True,
            'events': formatted_events,
            'count': len(formatted_events)
        })
        
    except HttpError as error:
        return jsonify({'error': f'Calendar API error: {error}'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@calendar_bp.route('/calendars')
@login_required
def get_calendars():
    """Get user's available calendars"""
    try:
        service = get_calendar_service()
        
        calendar_list = service.calendarList().list().execute()
        calendars = calendar_list.get('items', [])
        
        formatted_calendars = []
        for calendar in calendars:
            formatted_calendars.append({
                'id': calendar['id'],
                'summary': calendar['summary'],
                'description': calendar.get('description', ''),
                'primary': calendar.get('primary', False),
                'accessRole': calendar.get('accessRole', ''),
                'selected': calendar.get('selected', True)
            })
        
        return jsonify({
            'success': True,
            'calendars': formatted_calendars
        })
        
    except HttpError as error:
        return jsonify({'error': f'Calendar API error: {error}'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500 