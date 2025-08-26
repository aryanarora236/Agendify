// AI Service for intelligent event extraction from emails
class AIService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.openai.com/v1/chat/completions';
  }

  // Extract event information from email content using AI
  async extractEventFromEmail(emailContent) {
    try {
      const prompt = this.buildEventExtractionPrompt(emailContent);
      
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini', // Using GPT-4o-mini for cost efficiency
          messages: [
            {
              role: 'system',
              content: 'You are an expert at extracting event information from emails. Extract event details in a structured format.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.1, // Low temperature for consistent extraction
          max_tokens: 500
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const extractedEvent = this.parseAIResponse(data.choices[0].message.content);
      
      return extractedEvent;
    } catch (error) {
      console.error('Failed to extract event using AI:', error);
      // Fallback to pattern matching if AI fails
      return this.fallbackEventExtraction(emailContent);
    }
  }

  // Build prompt for event extraction
  buildEventExtractionPrompt(emailContent) {
    return `
Please extract event information from this email. Return ONLY a JSON object with the following structure:

{
  "event_name": "Name of the event",
  "date": "Event date in YYYY-MM-DD format",
  "time": "Event time in HH:MM format (24-hour)",
  "timezone": "Timezone (e.g., EST, PST, UTC)",
  "location": "Event location if mentioned",
  "description": "Brief event description",
  "confidence": "High/Medium/Low based on clarity of information"
}

If no event is found, return:
{
  "event_name": null,
  "date": null,
  "time": null,
  "timezone": null,
  "location": null,
  "description": null,
  "confidence": "None"
}

Email content:
Subject: ${emailContent.subject}
From: ${emailContent.from}
Date: ${emailContent.date}
Text: ${emailContent.text}

Extract the event information:`;
  }

  // Parse AI response into structured event data
  parseAIResponse(aiResponse) {
    try {
      // Clean the response and extract JSON
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }

      const eventData = JSON.parse(jsonMatch[0]);
      
      // Validate and clean the extracted data
      return {
        event_name: eventData.event_name || null,
        date: eventData.date || null,
        time: eventData.time || null,
        timezone: eventData.timezone || null,
        location: eventData.location || null,
        description: eventData.description || null,
        confidence: eventData.confidence || 'Low',
        source: 'AI'
      };
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      return null;
    }
  }

  // Fallback pattern matching for event extraction
  fallbackEventExtraction(emailContent) {
    const text = emailContent.text.toLowerCase();
    const subject = emailContent.subject.toLowerCase();
    
    // Common event patterns
    const eventPatterns = [
      /(?:event|meeting|chat|webinar|conference|workshop|seminar|presentation)/i,
      /(?:tomorrow|today|next week|this week)/i,
      /(?:at \d{1,2}:\d{2}|from \d{1,2}:\d{2}|starting at \d{1,2}:\d{2})/i
    ];

    // Check if email contains event-like content
    const hasEventPatterns = eventPatterns.some(pattern => 
      pattern.test(text) || pattern.test(subject)
    );

    if (!hasEventPatterns) {
      return {
        event_name: null,
        date: null,
        time: null,
        timezone: null,
        location: null,
        description: null,
        confidence: 'None',
        source: 'Pattern Matching'
      };
    }

    // Basic extraction using regex patterns
    const eventName = this.extractEventName(text, subject);
    const dateTime = this.extractDateTime(text);
    
    return {
      event_name: eventName,
      date: dateTime.date,
      time: dateTime.time,
      timezone: dateTime.timezone,
      location: this.extractLocation(text),
      description: emailContent.subject,
      confidence: 'Low',
      source: 'Pattern Matching'
    };
  }

  // Extract event name from text
  extractEventName(text, subject) {
    // Look for event names in subject or text
    const eventKeywords = ['event', 'meeting', 'chat', 'webinar', 'conference'];
    
    for (const keyword of eventKeywords) {
      const regex = new RegExp(`([^.!?]*${keyword}[^.!?]*)`, 'i');
      const match = text.match(regex) || subject.match(regex);
      if (match) {
        return match[1].trim();
      }
    }
    
    return subject || 'Unknown Event';
  }

  // Extract date and time information
  extractDateTime(text) {
    // Common date/time patterns
    const datePatterns = [
      /(?:tomorrow|today)/i,
      /(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
      /(?:january|february|march|april|may|june|july|august|september|october|november|december)/i,
      /\d{1,2}\/\d{1,2}\/\d{4}/,
      /\d{4}-\d{2}-\d{2}/
    ];

    const timePatterns = [
      /(\d{1,2}):(\d{2})\s*(am|pm)/i,
      /(\d{1,2}):(\d{2})\s*(est|pst|cst|mst|utc)/i,
      /(\d{1,2}):(\d{2})/
    ];

    let date = null;
    let time = null;
    let timezone = null;

    // Extract date
    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        date = this.parseDate(match[0]);
        break;
      }
    }

    // Extract time
    for (const pattern of timePatterns) {
      const match = text.match(pattern);
      if (match) {
        time = `${match[1]}:${match[2]}`;
        if (match[3]) {
          timezone = match[3].toUpperCase();
        }
        break;
      }
    }

    return { date, time, timezone };
  }

  // Parse date string into YYYY-MM-DD format
  parseDate(dateString) {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return null;
      }
      return date.toISOString().split('T')[0];
    } catch (error) {
      return null;
    }
  }

  // Extract location information
  extractLocation(text) {
    const locationPatterns = [
      /(?:at|in|location:?)\s*([^.!?\n]+)/i,
      /(?:venue:?|place:?)\s*([^.!?\n]+)/i
    ];

    for (const pattern of locationPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return null;
  }
}

export default AIService;
