import React, { useState, useEffect } from 'react';
import EmailService from '../services/emailService';
import AIService from '../services/aiService';
import CalendarService from '../services/calendarService';

const EventApproval = ({ accessToken, onEventAdded }) => {
  const [monitoredEmails, setMonitoredEmails] = useState(['pennwitg@gmail.com']);
  const [extractedEvents, setExtractedEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Initialize services
  const emailService = new EmailService(accessToken);
  const aiService = new AIService(process.env.REACT_APP_OPENAI_API_KEY);
  const calendarService = new CalendarService(accessToken);

  // Load and process emails
  useEffect(() => {
    if (accessToken && monitoredEmails.length > 0) {
      processEmails();
    }
  }, [accessToken, monitoredEmails]);

  // Process emails to extract events
  const processEmails = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get recent emails from monitored addresses
      const emailIds = await emailService.getRecentEmails(monitoredEmails);
      
      const events = [];
      
      // Process each email
      for (const emailId of emailIds) {
        const emailContent = await emailService.getEmailContent(emailId.id);
        
        if (emailContent && emailContent.text) {
          // Extract event using AI
          const extractedEvent = await aiService.extractEventFromEmail(emailContent);
          
          if (extractedEvent && extractedEvent.event_name) {
            events.push({
              ...extractedEvent,
              emailId: emailId.id,
              emailSubject: emailContent.subject,
              emailFrom: emailContent.from,
              emailDate: emailContent.date,
              processed: false
            });
          }
        }
      }

      setExtractedEvents(events);
    } catch (error) {
      console.error('Failed to process emails:', error);
      setError('Failed to process emails. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Approve event and add to calendar
  const approveEvent = async (event) => {
    try {
      // Create calendar event
      const calendarEvent = {
        summary: event.event_name,
        description: `${event.description}\n\nExtracted from email: ${event.emailSubject}\nSource: ${event.emailFrom}`,
        start: {
          dateTime: `${event.date}T${event.time}:00`,
          timeZone: event.timezone || 'America/New_York'
        },
        end: {
          dateTime: `${event.date}T${event.time}:00`,
          timeZone: event.timezone || 'America/New_York'
        },
        location: event.location,
        source: {
          title: 'Agendify Email Extraction',
          url: `https://mail.google.com/mail/u/0/#inbox/${event.emailId}`
        }
      };

      const createdEvent = await calendarService.createEvent(calendarEvent);
      
      // Mark as processed
      setExtractedEvents(prev => 
        prev.map(e => 
          e.emailId === event.emailId 
            ? { ...e, processed: true, calendarEventId: createdEvent.id }
            : e
        )
      );

      // Notify parent component
      if (onEventAdded) {
        onEventAdded(createdEvent);
      }

    } catch (error) {
      console.error('Failed to add event to calendar:', error);
      setError('Failed to add event to calendar. Please try again.');
    }
  };

  // Deny event
  const denyEvent = (event) => {
    setExtractedEvents(prev => 
      prev.map(e => 
        e.emailId === event.emailId 
          ? { ...e, processed: true, denied: true }
          : e
      )
    );
  };

  // Add new email address to monitor
  const addMonitoredEmail = (email) => {
    if (email && !monitoredEmails.includes(email)) {
      setMonitoredEmails([...monitoredEmails, email]);
    }
  };

  // Remove email address from monitoring
  const removeMonitoredEmail = (email) => {
    setMonitoredEmails(monitoredEmails.filter(e => e !== email));
  };

  // Format time for display
  const formatTime = (time, timezone) => {
    if (!time) return 'Time not specified';
    return `${time} ${timezone || ''}`.trim();
  };

  // Format date for display
  const formatDate = (date) => {
    if (!date) return 'Date not specified';
    try {
      return new Date(date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return date;
    }
  };

  return (
    <div className="event-approval">
      <div className="header">
        <h2>Email Event Extraction</h2>
        <button 
          onClick={processEmails} 
          disabled={loading}
          className="btn btn-primary"
        >
          {loading ? 'Processing...' : 'Refresh Events'}
        </button>
      </div>

      {/* Monitored Emails */}
      <div className="monitored-emails">
        <h3>Monitored Email Addresses</h3>
        <div className="email-list">
          {monitoredEmails.map(email => (
            <div key={email} className="email-item">
              <span>{email}</span>
              <button 
                onClick={() => removeMonitoredEmail(email)}
                className="btn btn-small btn-danger"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <div className="add-email">
          <input 
            type="email" 
            placeholder="Add email address to monitor"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                addMonitoredEmail(e.target.value);
                e.target.value = '';
              }
            }}
            className="email-input"
          />
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)} className="btn btn-small">
            Dismiss
          </button>
        </div>
      )}

      {/* Extracted Events */}
      <div className="extracted-events">
        <h3>Extracted Events ({extractedEvents.filter(e => !e.processed).length})</h3>
        
        {loading && (
          <div className="loading">
            <div className="spinner"></div>
            <p>Processing emails and extracting events...</p>
          </div>
        )}

        {!loading && extractedEvents.length === 0 && (
          <div className="no-events">
            <p>No events found in recent emails.</p>
            <p>Make sure you have emails from monitored addresses.</p>
          </div>
        )}

        {extractedEvents.map(event => (
          <div 
            key={event.emailId} 
            className={`event-card ${event.processed ? 'processed' : ''}`}
          >
            <div className="event-header">
              <h4>{event.event_name}</h4>
              <span className={`confidence ${event.confidence?.toLowerCase()}`}>
                {event.confidence} Confidence
              </span>
            </div>
            
            <div className="event-details">
              <div className="detail">
                <strong>Date:</strong> {formatDate(event.date)}
              </div>
              <div className="detail">
                <strong>Time:</strong> {formatTime(event.time, event.timezone)}
              </div>
              {event.location && (
                <div className="detail">
                  <strong>Location:</strong> {event.location}
                </div>
              )}
              <div className="detail">
                <strong>Source:</strong> {event.emailFrom}
              </div>
              <div className="detail">
                <strong>Subject:</strong> {event.emailSubject}
              </div>
            </div>

            {!event.processed && (
              <div className="event-actions">
                <button 
                  onClick={() => approveEvent(event)}
                  className="btn btn-success"
                >
                  Add to Calendar
                </button>
                <button 
                  onClick={() => denyEvent(event)}
                  className="btn btn-secondary"
                >
                  Deny
                </button>
              </div>
            )}

            {event.processed && (
              <div className="event-status">
                {event.calendarEventId ? (
                  <span className="status-success">
                    ✅ Added to Calendar
                  </span>
                ) : (
                  <span className="status-denied">
                    ❌ Denied
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default EventApproval;
