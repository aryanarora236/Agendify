// Calendar Service for Google Calendar API integration
class CalendarService {
  constructor(accessToken) {
    this.accessToken = accessToken;
    this.baseUrl = 'https://www.googleapis.com/calendar/v3';
  }

  // Create a new calendar event
  async createEvent(eventData) {
    try {
      const response = await fetch(
        `${this.baseUrl}/calendars/primary/events`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(eventData)
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Calendar API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const createdEvent = await response.json();
      console.log('Event created successfully:', createdEvent);
      
      return createdEvent;
    } catch (error) {
      console.error('Failed to create calendar event:', error);
      throw error;
    }
  }

  // Update an existing calendar event
  async updateEvent(eventId, eventData) {
    try {
      const response = await fetch(
        `${this.baseUrl}/calendars/primary/events/${eventId}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(eventData)
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Calendar API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const updatedEvent = await response.json();
      console.log('Event updated successfully:', updatedEvent);
      
      return updatedEvent;
    } catch (error) {
      console.error('Failed to update calendar event:', error);
      throw error;
    }
  }

  // Delete a calendar event
  async deleteEvent(eventId) {
    try {
      const response = await fetch(
        `${this.baseUrl}/calendars/primary/events/${eventId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          }
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Calendar API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      console.log('Event deleted successfully');
      return true;
    } catch (error) {
      console.error('Failed to delete calendar event:', error);
      throw error;
    }
  }

  // Get calendar events for a date range
  async getEvents(startDate, endDate, maxResults = 100) {
    try {
      const response = await fetch(
        `${this.baseUrl}/calendars/primary/events?` +
        `timeMin=${startDate.toISOString()}&` +
        `timeMax=${endDate.toISOString()}&` +
        `singleEvents=true&` +
        `orderBy=startTime&` +
        `maxResults=${maxResults}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Calendar API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      return data.items || [];
    } catch (error) {
      console.error('Failed to fetch calendar events:', error);
      throw error;
    }
  }

  // Get a specific calendar event
  async getEvent(eventId) {
    try {
      const response = await fetch(
        `${this.baseUrl}/calendars/primary/events/${eventId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Calendar API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const event = await response.json();
      return event;
    } catch (error) {
      console.error('Failed to fetch calendar event:', error);
      throw error;
    }
  }

  // Check if user has calendar access
  async checkCalendarAccess() {
    try {
      const response = await fetch(
        `${this.baseUrl}/calendars/primary`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.ok;
    } catch (error) {
      console.error('Failed to check calendar access:', error);
      return false;
    }
  }

  // Format event data for calendar creation
  formatEventData(eventData) {
    const {
      summary,
      description,
      start,
      end,
      location,
      attendees,
      reminders
    } = eventData;

    // Set default end time if not provided (1 hour duration)
    let endTime = end;
    if (start && !end) {
      const startDate = new Date(start.dateTime || start.date);
      startDate.setHours(startDate.getHours() + 1);
      endTime = {
        dateTime: startDate.toISOString(),
        timeZone: start.timeZone
      };
    }

    return {
      summary: summary || 'Untitled Event',
      description: description || '',
      start: start,
      end: endTime,
      location: location || '',
      attendees: attendees || [],
      reminders: reminders || {
        useDefault: true
      },
      source: {
        title: 'Agendify',
        url: 'https://agendify.app'
      }
    };
  }

  // Validate event data before sending to API
  validateEventData(eventData) {
    const errors = [];

    if (!eventData.summary) {
      errors.push('Event summary is required');
    }

    if (!eventData.start) {
      errors.push('Event start time is required');
    }

    if (!eventData.end) {
      errors.push('Event end time is required');
    }

    // Validate date format
    if (eventData.start && eventData.start.dateTime) {
      try {
        new Date(eventData.start.dateTime);
      } catch {
        errors.push('Invalid start date format');
      }
    }

    if (eventData.end && eventData.end.dateTime) {
      try {
        new Date(eventData.end.dateTime);
      } catch {
        errors.push('Invalid end date format');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

export default CalendarService;
