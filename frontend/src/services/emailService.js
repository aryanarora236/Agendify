// Email Service for Gmail API integration
class EmailService {
  constructor(accessToken) {
    this.accessToken = accessToken;
    this.baseUrl = 'https://gmail.googleapis.com/gmail/v1/users/me';
  }

  async getEmailsFromAddresses(emailAddresses, maxResults = 50) {
    try {
      const query = emailAddresses.map(email => `from:${email}`).join(' OR ');
      const response = await fetch(
        `${this.baseUrl}/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`,
        { headers: { 'Authorization': `Bearer ${this.accessToken}` } }
      );
      if (!response.ok) throw new Error(`Gmail API error: ${response.status}`);
      const data = await response.json();
      return data.messages || [];
    } catch (error) {
      console.error('Failed to fetch emails:', error);
      throw error;
    }
  }

  async getEmailContent(messageId) {
    try {
      const response = await fetch(
        `${this.baseUrl}/messages/${messageId}?format=full`,
        { headers: { 'Authorization': `Bearer ${this.accessToken}` } }
      );
      if (!response.ok) throw new Error(`Gmail API error: ${response.status}`);
      const data = await response.json();
      return this.parseEmailContent(data);
    } catch (error) {
      console.error('Failed to fetch email content:', error);
      throw error;
    }
  }

  parseEmailContent(emailData) {
    try {
      const payload = emailData.payload;
      const headers = payload.headers || [];
      const subject = headers.find(h => h.name === 'Subject')?.value || '';
      const from = headers.find(h => h.name === 'From')?.value || '';
      const date = headers.find(h => h.name === 'Date')?.value || '';

      const emailText = this.extractTextFromPayload(payload);

      return {
        id: emailData.id,
        subject,
        from,
        date,
        text: emailText,
        snippet: emailData.snippet || ''
      };
    } catch (error) {
      console.error('Failed to parse email content:', error);
      return null;
    }
  }

  // Recursively search MIME parts for readable text content.
  // Gmail wraps text/plain inside multipart/alternative which may itself
  // be nested inside multipart/mixed — a shallow scan always misses it.
  extractTextFromPayload(payload) {
    // Leaf node with data
    if (payload.body?.data) {
      const decoded = this.decodeBase64(payload.body.data);
      if (payload.mimeType === 'text/html') {
        return this.stripHtml(decoded);
      }
      return decoded;
    }

    if (!payload.parts || payload.parts.length === 0) {
      // No body data and no parts — try snippet fallback handled upstream
      return '';
    }

    // First pass: prefer text/plain at any depth
    const plain = this.findPartByMimeType(payload.parts, 'text/plain');
    if (plain) return this.decodeBase64(plain.body.data);

    // Second pass: recurse into nested multipart containers
    for (const part of payload.parts) {
      if (part.mimeType?.startsWith('multipart/')) {
        const text = this.extractTextFromPayload(part);
        if (text) return text;
      }
    }

    // Third pass: fall back to HTML (strip tags)
    const html = this.findPartByMimeType(payload.parts, 'text/html');
    if (html) return this.stripHtml(this.decodeBase64(html.body.data));

    return '';
  }

  // Depth-first search for the first part matching mimeType that has body data
  findPartByMimeType(parts, mimeType) {
    for (const part of parts) {
      if (part.mimeType === mimeType && part.body?.data) {
        return part;
      }
      if (part.parts) {
        const found = this.findPartByMimeType(part.parts, mimeType);
        if (found) return found;
      }
    }
    return null;
  }

  // Decode base64url to a proper UTF-8 string
  decodeBase64(data) {
    if (!data) return '';
    try {
      const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new TextDecoder('utf-8').decode(bytes);
    } catch (error) {
      console.error('Failed to decode base64:', error);
      return '';
    }
  }

  // Strip HTML tags and decode common entities
  stripHtml(html) {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  async getEmailsFromDateRange(emailAddresses, startDate, endDate, maxResults = 100) {
    try {
      const emailQuery = emailAddresses.map(email => `from:${email}`).join(' OR ');

      // Search last 30 days — wider window is more reliable than a narrow one
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const dateQuery = `after:${thirtyDaysAgo.toISOString().split('T')[0]}`;
      const fullQuery = `(${emailQuery}) ${dateQuery}`;

      console.log('Gmail query:', fullQuery);

      const response = await fetch(
        `${this.baseUrl}/messages?q=${encodeURIComponent(fullQuery)}&maxResults=${maxResults}`,
        { headers: { 'Authorization': `Bearer ${this.accessToken}` } }
      );

      if (!response.ok) throw new Error(`Gmail API error: ${response.status}`);
      const data = await response.json();
      console.log('Found messages:', data.messages?.length || 0);

      if (data.messages?.length > 0) return data.messages;

      // Retry without date restriction if nothing found
      console.log('No results with date filter, retrying without date...');
      const fallbackResponse = await fetch(
        `${this.baseUrl}/messages?q=${encodeURIComponent(`(${emailQuery})`)}&maxResults=${maxResults}`,
        { headers: { 'Authorization': `Bearer ${this.accessToken}` } }
      );

      if (!fallbackResponse.ok) throw new Error(`Gmail API fallback error: ${fallbackResponse.status}`);
      const fallbackData = await fallbackResponse.json();
      console.log('Found messages (fallback):', fallbackData.messages?.length || 0);
      return fallbackData.messages || [];
    } catch (error) {
      console.error('Failed to fetch emails from date range:', error);
      throw error;
    }
  }
}

export default EmailService;
