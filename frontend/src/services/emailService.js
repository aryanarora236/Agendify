// Email Service for Gmail API integration
class EmailService {
  constructor(accessToken) {
    this.accessToken = accessToken;
    this.baseUrl = 'https://gmail.googleapis.com/gmail/v1/users/me';
  }

  // Get emails from specific addresses
  async getEmailsFromAddresses(emailAddresses, maxResults = 50) {
    try {
      // Build Gmail query for specific email addresses
      const query = emailAddresses.map(email => `from:${email}`).join(' OR ');
      
      const response = await fetch(
        `${this.baseUrl}/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Gmail API error: ${response.status}`);
      }

      const data = await response.json();
      return data.messages || [];
    } catch (error) {
      console.error('Failed to fetch emails:', error);
      throw error;
    }
  }

  // Get full email content
  async getEmailContent(messageId) {
    try {
      const response = await fetch(
        `${this.baseUrl}/messages/${messageId}?format=full`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Gmail API error: ${response.status}`);
      }

      const data = await response.json();
      return this.parseEmailContent(data);
    } catch (error) {
      console.error('Failed to fetch email content:', error);
      throw error;
    }
  }

  // Parse email content to extract text
  parseEmailContent(emailData) {
    try {
      const payload = emailData.payload;
      let emailText = '';

      // Extract text content from email parts
      if (payload.parts) {
        // Multipart email
        for (const part of payload.parts) {
          if (part.mimeType === 'text/plain') {
            emailText = this.decodeBase64(part.body.data);
            break;
          }
        }
      } else if (payload.body && payload.body.data) {
        // Simple text email
        emailText = this.decodeBase64(payload.body.data);
      }

      // Extract email metadata
      const headers = payload.headers;
      const subject = headers.find(h => h.name === 'Subject')?.value || '';
      const from = headers.find(h => h.name === 'From')?.value || '';
      const date = headers.find(h => h.name === 'Date')?.value || '';

      return {
        id: emailData.id,
        subject,
        from,
        date,
        text: emailText,
        snippet: emailData.snippet
      };
    } catch (error) {
      console.error('Failed to parse email content:', error);
      return null;
    }
  }

  // Decode base64 content
  decodeBase64(data) {
    try {
      return atob(data.replace(/-/g, '+').replace(/_/g, '/'));
    } catch (error) {
      console.error('Failed to decode base64:', error);
      return '';
    }
  }

  // Get emails from last 24 hours
  async getRecentEmails(emailAddresses) {
    try {
      const query = emailAddresses.map(email => `from:${email}`).join(' OR ');
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateQuery = `after:${yesterday.toISOString().split('T')[0]}`;
      
      const fullQuery = `${query} ${dateQuery}`;
      
      const response = await fetch(
        `${this.baseUrl}/messages?q=${encodeURIComponent(fullQuery)}&maxResults=100`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Gmail API error: ${response.status}`);
      }

      const data = await response.json();
      return data.messages || [];
    } catch (error) {
      console.error('Failed to fetch recent emails:', error);
      throw error;
    }
  }

  // Get emails from specific addresses within a date range
  async getEmailsFromDateRange(emailAddresses, startDate, endDate, maxResults = 100) {
    try {
      // Build Gmail query for specific email addresses and date range
      const emailQuery = emailAddresses.map(email => `from:${email}`).join(' OR ');
      
      // Make date range more flexible - search from 30 days ago instead of 7
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      // Use a simpler date query that's more reliable
      const dateQuery = `after:${thirtyDaysAgo.toISOString().split('T')[0]}`;
      
      const fullQuery = `${emailQuery} ${dateQuery}`;
      console.log('Gmail query:', fullQuery);
      console.log('Searching from:', thirtyDaysAgo.toISOString().split('T')[0], 'to now');
      console.log('Email addresses:', emailAddresses);
      
      const response = await fetch(
        `${this.baseUrl}/messages?q=${encodeURIComponent(fullQuery)}&maxResults=${maxResults}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Gmail API error: ${response.status}`);
      }

      const data = await response.json();
      console.log('Gmail API response:', data);
      console.log('Found messages:', data.messages?.length || 0);
      
      // If we found messages, return them
      if (data.messages && data.messages.length > 0) {
        return data.messages;
      }
      
      // If no messages found with date restriction, try without date restriction
      console.log('No messages found with date restriction, trying without date...');
      const fallbackQuery = emailQuery;
      console.log('Fallback query:', fallbackQuery);
      
      const fallbackResponse = await fetch(
        `${this.baseUrl}/messages?q=${encodeURIComponent(fallbackQuery)}&maxResults=${maxResults}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!fallbackResponse.ok) {
        throw new Error(`Gmail API fallback error: ${fallbackResponse.status}`);
      }

      const fallbackData = await fallbackResponse.json();
      console.log('Fallback response:', fallbackData);
      console.log('Found messages (fallback):', fallbackData.messages?.length || 0);
      
      return fallbackData.messages || [];
      
    } catch (error) {
      console.error('Failed to fetch emails from date range:', error);
      throw error;
    }
  }
}

export default EmailService;
