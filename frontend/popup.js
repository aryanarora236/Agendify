// Chrome Extension Popup Logic
class AgendifyPopup {
  constructor() {
    this.isAuthenticated = false;
    this.accessToken = null;
    this.user = null;
    this.tasks = [];
    this.events = [];
    this.monitoredEmails = []; // Start with empty array
    
    this.init();
  }

  async init() {
    console.log('Initializing popup...');
    console.log('Chrome identity available:', !!chrome.identity);
    console.log('Chrome storage available:', !!chrome.storage);
    console.log('Chrome runtime available:', !!chrome.runtime);
    
    // Load saved monitored emails
    await this.loadMonitoredEmails();
    
    await this.checkAuthStatus();
    this.setupEventListeners();
    this.updateDate();
    
    if (this.isAuthenticated) {
      await this.loadAgenda();
    }
    
    console.log('Popup initialization complete');
  }

  async checkAuthStatus() {
    try {
      console.log('Checking auth status...');
      const token = await this.getStoredToken();
      console.log('Stored token:', token ? 'exists' : 'none');
      
      if (token) {
        console.log('Token found, showing agenda...');
        this.accessToken = token;
        this.isAuthenticated = true;
        
        // Check token validity and scopes
        await this.validateToken(token);
        
        await this.getUserInfo();
        this.showAgenda();
      } else {
        console.log('No token, showing login...');
        this.showLogin();
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      this.showLogin();
    }
  }

  // Validate token and check scopes
  async validateToken(token) {
    try {
      // Check if token is valid by calling a simple API
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        console.log('Token is expired or invalid, need to re-authenticate');
        // Clear invalid token
        await this.clearStoredToken();
        this.accessToken = null;
        this.isAuthenticated = false;
        this.showLogin();
        return false;
      }

      if (response.ok) {
        const userInfo = await response.json();
        console.log('Token is valid, user info:', userInfo);
        
        // Check what scopes we have access to
        await this.checkTokenScopes(token);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Token validation failed:', error);
      return false;
    }
  }

  // Check what scopes the token has access to
  async checkTokenScopes(token) {
    try {
      // Try to access calendar API to see if we have calendar permissions
      const calendarResponse = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (calendarResponse.ok) {
        console.log('✅ Token has calendar access');
      } else {
        console.log('❌ Token missing calendar permissions:', calendarResponse.status);
      }

      // Try to access Gmail API to see if we have Gmail permissions
      const gmailResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (gmailResponse.ok) {
        console.log('✅ Token has Gmail access');
      } else {
        console.log('❌ Token missing Gmail permissions:', gmailResponse.status);
      }

    } catch (error) {
      console.error('Failed to check token scopes:', error);
    }
  }

  async getUserInfo() {
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      });
      
      if (response.ok) {
        this.user = await response.json();
      }
    } catch (error) {
      console.error('Failed to get user info:', error);
    }
  }

  async authenticate() {
    console.log('Starting authentication...');
    try {
      console.log('Calling chrome.identity.getAuthToken...');
      
      // Add timeout to prevent hanging
      const authPromise = new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: true }, (result) => {
          if (chrome.runtime.lastError) {
            console.error('Chrome identity error:', chrome.runtime.lastError);
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            console.log('Auth result received:', result);
            resolve(result);
          }
        });
      });
      
      // Add 10 second timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Authentication timeout - no response from Google OAuth')), 10000);
      });
      
      const authResult = await Promise.race([authPromise, timeoutPromise]);
      console.log('Auth result:', authResult);
      
      if (authResult) {
        console.log('Got token, proceeding with authentication...');
        this.accessToken = authResult;
        this.isAuthenticated = true;
        await this.storeToken(authResult);
        await this.getUserInfo();
        this.showAgenda();
        await this.loadAgenda();
      } else {
        console.log('No token received');
      }
    } catch (error) {
      console.error('Authentication failed:', error);
      this.showError(`Authentication failed: ${error.message}`);
    }
  }

  async loadAgenda() {
    try {
      this.showLoading();
      
      // Load calendar events and tasks in parallel
      const [eventsData, tasksData] = await Promise.all([
        this.loadCalendarEvents(),
        this.loadTasks()
      ]);
      
      this.events = eventsData;
      this.tasks = tasksData;
      
      this.renderAgenda();
      this.hideLoading();
    } catch (error) {
      console.error('Failed to load agenda:', error);
      this.hideLoading();
      this.showError('Failed to load agenda. Please try again.');
    }
  }

  async loadCalendarEvents() {
    try {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(startOfDay);
      endOfDay.setDate(endOfDay.getDate() + 1);

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
        `timeMin=${startOfDay.toISOString()}&` +
        `timeMax=${endOfDay.toISOString()}&` +
        `singleEvents=true&` +
        `orderBy=startTime`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data.items.map(event => ({
          id: event.id,
          title: event.summary || 'Untitled Event',
          description: event.description || '',
          start: event.start.dateTime || event.start.date,
          end: event.end.dateTime || event.end.date,
          location: event.location || '',
          type: 'calendar_event',
          isAllDay: !event.start.dateTime
        }));
      }
      return [];
    } catch (error) {
      console.error('Failed to load calendar events:', error);
      return [];
    }
  }

  async loadTasks() {
    try {
      const stored = await this.getStoredTasks();
      return stored || [];
    } catch (error) {
      console.error('Failed to load tasks:', error);
      return [];
    }
  }

  async createTask(taskData) {
    try {
      const task = {
        id: Date.now().toString(),
        title: taskData.title,
        description: taskData.description || '',
        dueDate: taskData.dueDate || null,
        priority: taskData.priority || 'medium',
        completed: false,
        createdAt: new Date().toISOString(),
        type: 'task'
      };

      this.tasks.push(task);
      await this.storeTasks(this.tasks);
      this.renderAgenda();
      this.closeTaskModal();
      
      return task;
    } catch (error) {
      console.error('Failed to create task:', error);
      throw error;
    }
  }

  async toggleTask(taskId) {
    try {
      const task = this.tasks.find(t => t.id === taskId);
      if (task) {
        task.completed = !task.completed;
        await this.storeTasks(this.tasks);
        this.renderAgenda();
      }
    } catch (error) {
      console.error('Failed to toggle task:', error);
    }
  }

  async deleteTask(taskId) {
    try {
      this.tasks = this.tasks.filter(t => t.id !== taskId);
      await this.storeTasks(this.tasks);
      this.renderAgenda();
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  }

  renderAgenda() {
    const agendaItems = document.getElementById('agendaItems');
    const emptyState = document.getElementById('emptyState');
    
    // Combine and sort events and tasks
    const allItems = [...this.events, ...this.tasks].sort((a, b) => {
      const aTime = a.start || a.dueDate;
      const bTime = b.start || b.dueDate;
      
      if (!aTime && !bTime) return 0;
      if (!aTime) return 1;
      if (!bTime) return -1;
      
      return new Date(aTime) - new Date(bTime);
    });

    if (allItems.length === 0) {
      agendaItems.style.display = 'none';
      emptyState.style.display = 'block';
      return;
    }

    agendaItems.style.display = 'block';
    emptyState.style.display = 'none';

    agendaItems.innerHTML = allItems.map(item => this.renderAgendaItem(item)).join('');
  }

  renderAgendaItem(item) {
    const isTask = item.type === 'task';
    const isEvent = item.type === 'calendar_event';
    
    let timeDisplay = '';
    if (isTask && item.dueDate) {
      timeDisplay = this.formatTime(item.dueDate);
    } else if (isEvent && item.start) {
      timeDisplay = this.formatTime(item.start);
    }

    let iconClass = isTask ? 'task' : 'calendar';
    let iconSvg = isTask ? 
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>' :
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>';

    let priorityBadge = '';
    if (isTask && item.priority) {
      priorityBadge = `<span class="priority-badge ${item.priority}">${item.priority}</span>`;
    }

    let actions = '';
    if (isTask) {
      actions = `
        <button class="btn btn-icon" onclick="popup.toggleTask('${item.id}')" title="${item.completed ? 'Mark incomplete' : 'Mark complete'}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 11 12 14 22 4"></polyline>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
          </svg>
        </button>
        <button class="btn btn-icon" onclick="popup.deleteTask('${item.id}')" title="Delete task">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3,6 5,6 21,6"></polyline>
            <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
          </svg>
        </button>
      `;
    }

    return `
      <div class="agenda-item ${isTask && item.completed ? 'completed' : ''}">
        <div class="agenda-item-header">
          <div class="item-icon ${iconClass}">
            ${iconSvg}
          </div>
          <div class="item-content">
            <div class="item-title" style="${isTask && item.completed ? 'text-decoration: line-through; opacity: 0.6;' : ''}">
              ${item.title}
            </div>
            ${timeDisplay ? `<div class="item-time">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12,6 12,12 16,14"></polyline>
              </svg>
              ${timeDisplay}
            </div>` : ''}
            ${item.description ? `<div class="item-description">${item.description}</div>` : ''}
            ${priorityBadge ? `<div class="item-meta">${priorityBadge}</div>` : ''}
          </div>
          ${actions ? `<div class="item-actions">${actions}</div>` : ''}
        </div>
      </div>
    `;
  }

  formatTime(dateString) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) {
      return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return `Tomorrow at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return date.toLocaleDateString([], { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }
  }

  updateDate() {
    const dateElement = document.getElementById('date');
    if (dateElement) {
      const today = new Date();
      dateElement.textContent = today.toLocaleDateString([], { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    }
  }

  showLogin() {
    console.log('Showing login screen...');
    document.getElementById('loading').style.display = 'none';
    document.getElementById('login').style.display = 'block';
    document.getElementById('agenda').style.display = 'none';
    console.log('Login screen should now be visible');
  }

  showAgenda() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('login').style.display = 'none';
    document.getElementById('agenda').style.display = 'block';
  }

  showLoading() {
    document.getElementById('loading').style.display = 'flex';
  }

  hideLoading() {
    document.getElementById('loading').style.display = 'none';
  }

  showTaskModal() {
    document.getElementById('taskModal').style.display = 'flex';
  }

  closeTaskModal() {
    document.getElementById('taskModal').style.display = 'none';
    document.getElementById('taskForm').reset();
  }

  showError(message) {
    // Simple error display - you can enhance this
    console.error(message);
  }

  async logout() {
    try {
      await chrome.identity.removeCachedAuthToken({ token: this.accessToken });
      this.accessToken = null;
      this.isAuthenticated = false;
      this.user = null;
      this.tasks = [];
      this.events = [];
      await this.clearStoredToken();
      await this.clearStoredTasks();
      this.showLogin();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }

  setupEventListeners() {
    // Login button
    const loginBtn = document.getElementById('loginBtn');
    console.log('Login button found:', loginBtn);
    
    if (loginBtn) {
      loginBtn.addEventListener('click', () => {
        console.log('Login button clicked!');
        this.authenticate();
      });
      console.log('Login button event listener added');
    } else {
      console.error('Login button not found!');
    }

    // Tab navigation
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.switchTab(btn.dataset.tab);
      });
    });

    // Add task button
    document.getElementById('addTaskBtn').addEventListener('click', () => {
      this.showTaskModal();
    });

    // Refresh button
    document.getElementById('refreshBtn').addEventListener('click', () => {
      this.loadAgenda();
    });

    // Logout button
    document.getElementById('logoutBtn').addEventListener('click', () => {
      this.logout();
    });

    // Task form
    document.getElementById('taskForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      
      try {
        await this.createTask({
          title: formData.get('title'),
          description: formData.get('description'),
          dueDate: formData.get('dueDate'),
          priority: formData.get('priority')
        });
      } catch (error) {
        this.showError('Failed to create task');
      }
    });

    // Close modal buttons
    document.getElementById('closeModal').addEventListener('click', () => {
      this.closeTaskModal();
    });

    document.getElementById('cancelTask').addEventListener('click', () => {
      this.closeTaskModal();
    });
  }

  // Switch between tabs
  switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.tab === tabName) {
        btn.classList.add('active');
      }
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });

    if (tabName === 'agenda') {
      document.getElementById('agendaTab').classList.add('active');
    } else if (tabName === 'email-events') {
      document.getElementById('emailEventsTab').classList.add('active');
      this.loadEmailEventsTab();
    }
  }

  // Load email events tab content
  async loadEmailEventsTab() {
    const emailEventsContent = document.getElementById('emailEventsContent');
    
    if (!this.isAuthenticated) {
      emailEventsContent.innerHTML = `
        <div class="login-prompt">
          <p>Please sign in to access email event extraction.</p>
        </div>
      `;
      return;
    }

    // Load the email events interface
    try {
      // Import and initialize the email events interface
      await this.initializeEmailEvents();
    } catch (error) {
      console.error('Failed to load email events:', error);
      emailEventsContent.innerHTML = `
        <div class="error-message">
          Failed to load email events. Please try again.
        </div>
      `;
    }
  }

  // Initialize email events functionality
  async initializeEmailEvents() {
    const emailEventsContent = document.getElementById('emailEventsContent');
    
    // Create the email events interface HTML
    emailEventsContent.innerHTML = `
      <div class="event-approval">
        <div class="header">
          <h2>Email Event Extraction</h2>
          <div class="header-actions">
            <button id="testExtraction" class="btn btn-secondary">
              Test
            </button>
            <button id="clearAllEvents" class="btn btn-secondary">
              Clear All
            </button>
            <button id="refreshEmailEvents" class="btn btn-primary">
              Refresh Events
            </button>
          </div>
        </div>

        <div class="monitored-emails">
          <h3>Monitored Email Addresses</h3>
          <div class="email-list" id="emailList">
            <!-- Email list will be populated dynamically -->
          </div>
          <div class="add-email">
            <input 
              type="email" 
              id="newEmailInput"
              placeholder="Add email address to monitor"
              class="email-input"
            >
            <button id="addEmailBtn" class="btn btn-primary btn-small">
              Add
            </button>
          </div>
        </div>

        <div id="emailEventsError" class="error-message" style="display: none;"></div>

        <div class="extracted-events">
          <h3>Extracted Events (<span id="eventCount">0</span>)</h3>
          
          <div id="emailEventsLoading" class="loading" style="display: none;">
            <div class="spinner"></div>
            <p>Processing emails and extracting events...</p>
          </div>

          <div id="emailEventsList"></div>
        </div>
      </div>
    `;

    // Set up event listeners for email events
    this.setupEmailEventListeners();
    
    // Initialize the email list display
    this.updateMonitoredEmailsList();
    
    // Load initial email events
    await this.processEmailEvents();
  }

  // Set up event listeners for email events interface
  setupEmailEventListeners() {
    // Test extraction button
    const testBtn = document.getElementById('testExtraction');
    if (testBtn) {
      testBtn.addEventListener('click', () => {
        this.testSimpleExtraction();
      });
    }

    // Clear all events button
    const clearBtn = document.getElementById('clearAllEvents');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.clearAllProcessedEmailEvents();
      });
    }

    // Refresh events button
    const refreshBtn = document.getElementById('refreshEmailEvents');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.processEmailEvents();
      });
    }

    // Add email input
    const emailInput = document.getElementById('newEmailInput');
    if (emailInput) {
      emailInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.addMonitoredEmail();
        }
      });
    }

    // Add email button
    const addEmailBtn = document.getElementById('addEmailBtn');
    if (addEmailBtn) {
      addEmailBtn.addEventListener('click', () => {
        this.addMonitoredEmail();
      });
    }

    // Set up event delegation for remove buttons
    document.addEventListener('click', (e) => {
      if (e.target.matches('[data-email]')) {
        const email = e.target.dataset.email;
        this.removeMonitoredEmail(email);
      }
    });
  }

  // Process emails to extract events
  async processEmailEvents() {
    const loadingEl = document.getElementById('emailEventsLoading');
    const eventsListEl = document.getElementById('emailEventsList');
    const errorEl = document.getElementById('emailEventsError');
    const eventCountEl = document.getElementById('eventCount');

    if (loadingEl) loadingEl.style.display = 'flex';
    if (errorEl) errorEl.style.display = 'none';
    if (eventsListEl) eventsListEl.innerHTML = '';

    try {
      // Check if we have any monitored emails
      if (!this.monitoredEmails || this.monitoredEmails.length === 0) {
        if (eventsListEl) {
          eventsListEl.innerHTML = `
            <div class="no-events">
              <p>No email addresses monitored yet.</p>
              <p>Add an email address above to start monitoring for events.</p>
            </div>
          `;
        }
        if (eventCountEl) eventCountEl.textContent = '0';
        return;
      }

      // Use real Gmail API to scan actual emails
      const emailService = new (await import('./src/services/emailService.js')).default(this.accessToken);
      
      // Get emails from the last week from monitored addresses
      const monitoredEmails = this.monitoredEmails;
      console.log('Scanning emails from addresses:', monitoredEmails);
      console.log('Monitored emails array:', this.monitoredEmails);
      console.log('Monitored emails length:', this.monitoredEmails.length);
      
      // Get emails from the last 7 days
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      console.log('Searching emails from:', oneWeekAgo.toISOString(), 'to', new Date().toISOString());
      
      const emailIds = await emailService.getEmailsFromDateRange(monitoredEmails, oneWeekAgo, new Date());
      console.log('Found emails:', emailIds.length);
      
      if (emailIds.length === 0) {
        if (eventsListEl) {
          eventsListEl.innerHTML = `
            <div class="no-events">
              <p>No emails found from monitored addresses in the last 7 days.</p>
              <p>Make sure the email addresses are correct and you have recent emails.</p>
            </div>
          `;
        }
        if (eventCountEl) eventCountEl.textContent = '0';
        return;
      }
      
      const events = [];
      
      // Process each real email
      for (const emailId of emailIds) {
        try {
          const emailContent = await emailService.getEmailContent(emailId.id);
          
          console.log('📧 Processing email:', {
            subject: emailContent?.subject,
            from: emailContent?.from,
            hasText: !!emailContent?.text,
            textLength: emailContent?.text?.length,
            textPreview: emailContent?.text?.substring(0, 300)
          });
          
          if (emailContent && emailContent.text) {
            // Extract event using pattern matching
            const extractedEvent = this.extractEventWithPatterns(emailContent);
            
            console.log('🔍 Extraction result:', extractedEvent);
            
            if (extractedEvent && extractedEvent.event_name) {
              events.push({
                ...extractedEvent,
                emailId: emailId.id,
                emailSubject: emailContent.subject,
                emailFrom: emailContent.from,
                emailDate: emailContent.date,
                processed: false
              });
              console.log('✅ Event added to list');
            } else {
              console.log('❌ No event extracted from this email');
            }
          }
        } catch (emailError) {
          console.error('Failed to process email:', emailId.id, emailError);
          // Continue with other emails
        }
      }

      console.log('Extracted events:', events.length);
      
      if (events.length === 0) {
        if (eventsListEl) {
          eventsListEl.innerHTML = `
            <div class="no-events">
              <p>No events found in the scanned emails.</p>
              <p>Make sure your emails contain meeting/event information with dates and times.</p>
            </div>
          `;
        }
        if (eventCountEl) eventCountEl.textContent = '0';
      } else {
        // Display events
        this.displayEmailEvents(events);
        if (eventCountEl) eventCountEl.textContent = events.filter(e => !e.processed).length;
      }

    } catch (error) {
      console.error('Failed to process email events:', error);
      if (errorEl) {
        errorEl.textContent = `Failed to process emails: ${error.message}`;
        errorEl.style.display = 'flex';
      }
      if (eventsListEl) {
        eventsListEl.innerHTML = `
          <div class="error-message">
            <p>Failed to process emails. Please try again.</p>
            <p>Error: ${error.message}</p>
          </div>
        `;
      }
    } finally {
      if (loadingEl) loadingEl.style.display = 'none';
    }
  }

  // Pattern matching event extraction (fallback when AI is not available)
  extractEventWithPatterns(emailContent) {
    const text = emailContent.text.toLowerCase();
    const subject = emailContent.subject.toLowerCase();
    
    console.log('🔍 Extracting event from:', { 
      subject, 
      textPreview: text.substring(0, 200),
      textLength: text.length
    });
    
    // Much more flexible event detection - look for ANY meeting/event related content
    const eventIndicators = [
      'meeting', 'event', 'chat', 'webinar', 'conference', 'workshop', 'seminar', 
      'presentation', 'fireside', 'welcome', 'orientation', 'session', 'gathering',
      'get-together', 'reception', 'ceremony', 'celebration', 'party', 'social',
      'call', 'discussion', 'review', 'planning', 'standup', 'sync', 'catch-up'
    ];
    
    // Check if this email contains ANY event-related content
    const hasEventContent = eventIndicators.some(indicator => 
      text.includes(indicator) || subject.includes(indicator)
    );
    
    // Also check for time/date patterns that suggest an event
    const hasTimePattern = /\d{1,2}:\d{2}\s*(am|pm|est|pst|cst|mst|utc)/i.test(text);
    const hasDatePattern = /(tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}\/\d{1,2})/i.test(text);
    
    console.log('🎯 Detection results:', { 
      hasEventContent, 
      hasTimePattern, 
      hasDatePattern,
      eventIndicatorsFound: eventIndicators.filter(indicator => text.includes(indicator) || subject.includes(indicator))
    });
    
    // If we have ANY of these indicators, try to extract an event
    if (!hasEventContent && !hasTimePattern && !hasDatePattern) {
      console.log('❌ No event indicators found');
      return null;
    }

    // Extract event name - much more flexible now
    const eventName = this.extractEventName(text, subject);
    
    // Extract date and time with simplified patterns
    const dateTime = this.extractDateTimeFromText(text);
    
    // Extract location
    const location = this.extractLocationFromText(text);
    
    // Extract description
    const description = this.extractDescription(text, subject);

    console.log('🎉 Final extracted event:', { eventName, dateTime, location, description });

    return {
      event_name: eventName,
      date: dateTime.date,
      time: dateTime.time,
      timezone: dateTime.timezone,
      location: location,
      description: description,
      confidence: 'High',
      source: 'Pattern Matching'
    };
  }

  // Extract event name from text - much more flexible
  extractEventName(text, subject) {
    // First, try to get event name from subject line
    if (subject && subject.trim() && subject !== 're:' && subject !== 'fw:') {
      // Clean up subject line
      let cleanSubject = subject
        .replace(/^(re|fw|fwd):\s*/i, '') // Remove email prefixes
        .replace(/^\s+|\s+$/g, '') // Trim whitespace
        .replace(/[.!?]$/, ''); // Remove trailing punctuation
      
      if (cleanSubject.length > 2) {
        return cleanSubject;
      }
    }
    
    // Look for meeting patterns in the text
    const meetingPatterns = [
      /(?:we\s+have\s+a\s+)([^.!?\n]*?)(?:\s+(?:meeting|event|session|call))/i,
      /(?:our\s+)([^.!?\n]*?)(?:\s+(?:meeting|event|session|call))/i,
      /(?:the\s+)([^.!?\n]*?)(?:\s+(?:meeting|event|session|call))/i,
      /(?:a\s+)([^.!?\n]*?)(?:\s+(?:meeting|event|session|call))/i,
      /(?:meeting|event|session|call)\s+(?:about\s+)?([^.!?\n]*?)(?:\s+(?:tomorrow|today|at\s+\d|on\s+\w+))/i
    ];
    
    for (const pattern of meetingPatterns) {
      const match = text.match(pattern);
      if (match && match[1] && match[1].trim().length > 2) {
        return match[1].trim();
      }
    }
    
    // Look for specific event patterns like "meeting at X time" or "X at Y time"
    const timeBasedPatterns = [
      /([^.!?\n]*?)\s+(?:at|on)\s+\d{1,2}:\d{2}/i,
      /([^.!?\n]*?)\s+(?:at|on)\s+\d{1,2}\s*(?:am|pm)/i,
      /([^.!?\n]*?)\s+(?:at|on)\s+(?:tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i
    ];
    
    for (const pattern of timeBasedPatterns) {
      const match = text.match(pattern);
      if (match && match[1] && match[1].trim().length > 2) {
        const eventName = match[1].trim();
        // Filter out generic words
        if (!['we', 'have', 'a', 'the', 'our', 'will', 'be', 'going', 'to'].includes(eventName.toLowerCase())) {
          return eventName;
        }
      }
    }
    
    // Fallback: look for any capitalized words that might be event names
    const capitalizedWords = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g);
    if (capitalizedWords && capitalizedWords.length > 0) {
      // Filter out common words and return the first meaningful one
      const commonWords = ['hello', 'hi', 'dear', 'best', 'regards', 'thanks', 'thank', 'please', 'come', 'join', 'we', 'have', 'a', 'the', 'our', 'will', 'be', 'going', 'to'];
      const meaningfulWord = capitalizedWords.find(word => 
        !commonWords.includes(word.toLowerCase()) && word.length > 2
      );
      if (meaningfulWord) {
        return meaningfulWord;
      }
    }
    
    // Last resort: use subject or generic name
    return subject || 'Meeting';
  }

  // Extract date and time from text - simplified and more robust
  extractDateTimeFromText(text) {
    let date = null;
    let time = null;
    let timezone = null;

    console.log('🔍 Starting time/date extraction from text:', text.substring(0, 200));

    // Simplified date patterns - prioritize common formats
    const datePatterns = [
      /(tomorrow|today)/i,
      /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
      /(monday|tuesday|wednesday|thursday|friday|saturday|sunday),\s*\d{1,2}\/\d{1,2}/i,
      /\d{1,2}\/\d{1,2}/,
      /\d{1,2}\/\d{1,2}\/\d{4}/
    ];

    // Extract date first
    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        date = this.parseDateFromText(match[0]);
        if (date) {
          console.log('📅 Date extracted:', date);
          break;
        }
      }
    }

    // Extract timezone first (to avoid confusion)
    const timezoneMatch = text.match(/\b(est|pst|cst|mst|utc|gmt|pdt|edt|cdt|mdt)\b/i);
    if (timezoneMatch) {
      timezone = timezoneMatch[1].toUpperCase();
      console.log('🌍 Timezone found:', timezone);
    }

    // SIMPLIFIED TIME EXTRACTION - focus on the most common patterns
    console.log('⏰ Looking for time patterns...');
    console.log('🔍 Processing text:', text.substring(0, 200));
    
    // Pattern 1: "6:40 PM" (with colon and minutes) - MOST COMMON
    const detailedTimeMatch = text.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
    if (detailedTimeMatch) {
      console.log('✅ Detailed time pattern matched:', detailedTimeMatch);
      const hour = detailedTimeMatch[1];
      const minute = detailedTimeMatch[2];
      const ampm = detailedTimeMatch[3].toLowerCase();
      time = `${hour}:${minute} ${ampm}`;
      console.log('⏰ Created detailed time:', time);
    } else {
      console.log('❌ Detailed time pattern did not match');
    }
    
    // Pattern 2: "6 PM" (without colon) - SECOND MOST COMMON
    if (!time) {
      const basicTimeMatch = text.match(/(\d{1,2})\s*(am|pm)/i);
      if (basicTimeMatch) {
        console.log('✅ Basic time pattern matched:', basicTimeMatch);
        const hour = basicTimeMatch[1];
        const ampm = basicTimeMatch[2].toLowerCase();
        time = `${hour}:00 ${ampm}`; // Always add :00
        console.log('⏰ Created basic time:', time);
      } else {
        console.log('❌ Basic time pattern did not match');
      }
    }

    // Pattern 3: "15:30" (24-hour format)
    if (!time) {
      const militaryTimeMatch = text.match(/(\d{1,2}):(\d{2})/);
      if (militaryTimeMatch) {
        console.log('✅ Military time pattern matched:', militaryTimeMatch);
        const hour = militaryTimeMatch[1];
        const minute = militaryTimeMatch[2];
        time = `${hour}:${minute}`;
        console.log('⏰ Created military time:', time);
      } else {
        console.log('❌ Military time pattern did not match');
      }
    }

    // If still no time, let's debug what we're seeing
    if (!time) {
      console.log('❌ No time patterns matched');
      // Show all potential time-related text
      const allTimeText = text.match(/\d{1,2}(?:\s*[:]?\s*(?:am|pm|est|pst|cst|mst|utc))/gi);
      console.log('🔍 All potential time text found:', allTimeText);
      
      // Also show all numbers followed by AM/PM
      const allAmPmText = text.match(/\d+\s*(?:am|pm)/gi);
      console.log('🔍 All AM/PM text found:', allAmPmText);
    }

    console.log('🎯 Final extraction results:', { date, time, timezone });
    return { date, time, timezone };
  }

  // Parse date from text - improved for various formats
  parseDateFromText(dateText) {
    try {
      const lowerText = dateText.toLowerCase();
      
      // Handle "tomorrow" - this should be the most common case
      if (lowerText.includes('tomorrow')) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split('T')[0];
      }
      
      if (lowerText.includes('today')) {
        const today = new Date();
        return today.toISOString().split('T')[0];
      }

      // Handle day names like "Monday" - find next occurrence
      const dayMap = {
        'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4,
        'friday': 5, 'saturday': 6, 'sunday': 0
      };
      
      const dayMatch = lowerText.match(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
      if (dayMatch) {
        const currentDate = new Date();
        const currentDay = currentDate.getDay();
        const targetDay = dayMap[dayMatch[1].toLowerCase()];
        
        let daysUntilTarget = targetDay - currentDay;
        if (daysUntilTarget <= 0) daysUntilTarget += 7; // Next week
        
        const targetDate = new Date();
        targetDate.setDate(currentDate.getDate() + daysUntilTarget);
        return targetDate.toISOString().split('T')[0];
      }

      // Handle "Monday, 8/25" format
      const dateMatch = lowerText.match(/(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday),\s*(\d{1,2})\/(\d{1,2})/i);
      if (dateMatch) {
        const month = parseInt(dateMatch[2]) - 1; // Month is 0-indexed
        const day = parseInt(dateMatch[1]);
        const year = new Date().getFullYear();
        
        const date = new Date(year, month, day);
        if (date < new Date()) {
          date.setFullYear(year + 1);
        }
        
        return date.toISOString().split('T')[0];
      }

      // Handle "8/25" format
      const simpleDateMatch = dateText.match(/(\d{1,2})\/(\d{1,2})/);
      if (simpleDateMatch) {
        const month = parseInt(simpleDateMatch[1]) - 1; // Month is 0-indexed
        const day = parseInt(simpleDateMatch[2]);
        const year = new Date().getFullYear();
        
        const date = new Date(year, month, day);
        if (date < new Date()) {
          date.setFullYear(year + 1);
        }
        
        return date.toISOString().split('T')[0];
      }

      // Handle abbreviated month formats like "aug 27", "aug 27th", "aug 27th 2025"
      const monthAbbrevMap = {
        'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
        'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
      };
      
      const abbrevMonthMatch = lowerText.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s*(\d{1,2})(?:st|nd|rd|th)?\s*(\d{4})?/i);
      if (abbrevMonthMatch) {
        const monthAbbrev = abbrevMonthMatch[1].toLowerCase();
        const day = parseInt(abbrevMonthMatch[2]);
        const year = abbrevMonthMatch[3] ? parseInt(abbrevMonthMatch[3]) : new Date().getFullYear();
        
        if (monthAbbrevMap[monthAbbrev] !== undefined) {
          const month = monthAbbrevMap[monthAbbrev];
          const date = new Date(year, month, day);
          
          // If the date has passed this year and no year was specified, use next year
          if (!abbrevMonthMatch[3] && date < new Date()) {
            date.setFullYear(year + 1);
          }
          
          return date.toISOString().split('T')[0];
        }
      }

      // Try to parse the date directly
      const date = new Date(dateText);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }

      return null;
    } catch (error) {
      console.error('Error parsing date:', dateText, error);
      return null;
    }
  }

  // Extract location from text - improved patterns
  extractLocationFromText(text) {
    const locationPatterns = [
      // Look for specific location patterns first
      /(?:in\s+the\s+)(\d{1,2}(?:st|nd|rd|th)?-floor\s+[^.!?\n]+)/i,
      /(?:at\s+)(\d{1,2}(?:st|nd|rd|th)?-floor\s+[^.!?\n]+)/i,
      /(?:floor\s+)(\d{1,2}(?:st|nd|rd|th)?\s+[^.!?\n]+)/i,
      /(?:conference room|room)\s*([a-z0-9]+)/i,
      /(?:at|in|location:?)\s*([^.!?\n]+?)(?:\s+(?:tomorrow|today|at\s+\d|on\s+\w+))/i,
      /(?:venue:?|place:?)\s*([^.!?\n]+)/i
    ];

    for (const pattern of locationPatterns) {
      const match = text.match(pattern);
      if (match) {
        const location = match[1].trim();
        // Filter out generic locations and very short text
        if (location.length > 3 && 
            !location.toLowerCase().includes('tomorrow') &&
            !location.toLowerCase().includes('today') &&
            !location.toLowerCase().includes('at') &&
            !location.toLowerCase().includes('on') &&
            !location.toLowerCase().includes('pm') &&
            !location.toLowerCase().includes('am')) {
          return location;
        }
      }
    }

    // Look for specific location keywords
    const locationKeywords = [
      'conference room', 'meeting room', 'office', 'lounge', 'hall', 'auditorium',
      'cafeteria', 'library', 'lab', 'studio', 'gym', 'park', 'restaurant'
    ];

    for (const keyword of locationKeywords) {
      if (text.includes(keyword)) {
        // Extract the phrase containing the location keyword
        const locationMatch = text.match(new RegExp(`([^.!?\n]*${keyword}[^.!?\n]*)`, 'i'));
        if (locationMatch) {
          const location = locationMatch[1].trim();
          if (location.length > keyword.length + 5) { // Make sure it's not just the keyword
            return location;
          }
        }
      }
    }

    return null; // Return null if no meaningful location found
  }

  // Extract description from text
  extractDescription(text, subject) {
    // Look for meeting description in the text
    const descriptionPatterns = [
      /(?:meeting|event|session)\s+will\s+be\s+held[^.!?\n]*/i,
      /(?:meeting|event|session)\s+is\s+scheduled[^.!?\n]*/i,
      /(?:meeting|event|session)\s+on[^.!?\n]*/i
    ];
    
    for (const pattern of descriptionPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0].trim();
      }
    }
    
    return subject;
  }

  // Display extracted email events
  displayEmailEvents(events) {
    const eventsListEl = document.getElementById('emailEventsList');
    
    if (!eventsListEl) return;

    if (events.length === 0) {
      eventsListEl.innerHTML = `
        <div class="no-events">
          <p>No events found in recent emails.</p>
          <p>Make sure you have emails from monitored addresses.</p>
        </div>
      `;
      return;
    }

    eventsListEl.innerHTML = events.map(event => `
      <div class="event-card ${event.processed ? 'processed' : ''}" data-email-id="${event.emailId}">
        <div class="event-header">
          <h4>${event.event_name}</h4>
          <span class="confidence ${event.confidence?.toLowerCase()}">
            ${event.confidence} Confidence
          </span>
        </div>
        
        <div class="event-details">
          <div class="detail">
            <strong>Date:</strong> ${this.formatEventDate(event.date)}
          </div>
          <div class="detail">
            <strong>Time:</strong> ${this.formatEventTime(event.time, event.timezone)}
          </div>
          ${event.location ? `
            <div class="detail">
              <strong>Location:</strong> ${event.location}
            </div>
          ` : ''}
          <div class="detail">
            <strong>Source:</strong> ${event.emailFrom}
          </div>
          <div class="detail">
            <strong>Subject:</strong> ${event.emailSubject}
          </div>
        </div>

        ${!event.processed ? `
          <div class="event-actions">
            <button class="btn btn-success approve-event" data-email-id="${event.emailId}">
              Add to Calendar
            </button>
            <button class="btn btn-secondary deny-event" data-email-id="${event.emailId}">
              Deny
            </button>
          </div>
        ` : `
          <div class="event-status">
            ${event.calendarEventId ? 
              '<span class="status-success">✅ Added to Calendar</span>' : 
              '<span class="status-denied">❌ Denied</span>'
            }
          </div>
        `}
      </div>
    `).join('');

    // Add event listeners for approve/deny buttons
    this.setupEventActionListeners();
  }

  // Set up event listeners for approve/deny buttons
  setupEventActionListeners() {
    // Approve event buttons
    document.querySelectorAll('.approve-event').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const emailId = e.target.dataset.emailId;
        this.approveEmailEvent(emailId);
      });
    });

    // Deny event buttons
    document.querySelectorAll('.deny-event').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const emailId = e.target.dataset.emailId;
        this.denyEmailEvent(emailId);
      });
    });
  }

  // Format event date for display
  formatEventDate(date) {
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
  }

  // Format event time for display
  formatEventTime(time, timezone) {
    if (!time) return 'Time not specified';
    // Don't add timezone again since it's already in the time field
    return time;
  }

  // Approve email event and add to calendar
  async approveEmailEvent(emailId) {
    try {
      // Find the event card
      const eventCard = document.querySelector(`[data-email-id="${emailId}"]`);
      if (!eventCard) return;

      // Get event data from the card
      const eventName = eventCard.querySelector('h4').textContent;
      
      // Get date and time from details
      const details = eventCard.querySelectorAll('.detail');
      let dateText = '';
      let timeText = '';
      let locationText = '';
      let sourceText = '';
      let subjectText = '';

      details.forEach(detail => {
        const text = detail.textContent;
        if (text.includes('Date:')) {
          dateText = text.replace('Date:', '').trim();
        } else if (text.includes('Time:')) {
          timeText = text.replace('Time:', '').trim();
        } else if (text.includes('Location:')) {
          locationText = text.replace('Location:', '').trim();
        } else if (text.includes('Source:')) {
          sourceText = text.replace('Source:', '').trim();
        } else if (text.includes('Subject:')) {
          subjectText = text.replace('Subject:', '').trim();
        }
      });

      // Create calendar event data
      const calendarEvent = {
        summary: eventName,
        description: `Event extracted from email by Agendify\n\nSubject: ${subjectText}\nSource: ${sourceText}`,
        start: {
          dateTime: this.createDateTimeString(dateText, timeText),
          timeZone: this.extractTimezone(timeText) || 'America/New_York'
        },
        end: {
          dateTime: this.createEndDateTimeString(dateText, timeText),
          timeZone: this.extractTimezone(timeText) || 'America/New_York'
        }
      };

      // Add location if available
      if (locationText) {
        calendarEvent.location = locationText;
      }

      // Create the calendar event
      const calendarService = new (await import('./src/services/calendarService.js')).default(this.accessToken);
      const createdEvent = await calendarService.createEvent(calendarEvent);
      
      console.log('Event added to calendar:', createdEvent);
      
      // Mark as processed and show success
      eventCard.classList.add('processed');
      const actionsEl = eventCard.querySelector('.event-actions');
      if (actionsEl) {
        actionsEl.innerHTML = `
          <div class="event-status">
            <span class="status-success">✅ Added to Calendar</span>
          </div>
        `;
      }

      // Show success message
      this.showSuccessMessage(`Event "${eventName}" added to your Google Calendar!`);
      
    } catch (error) {
      console.error('Failed to add event to calendar:', error);
      this.showErrorMessage('Failed to add event to calendar. Please try again.');
    }
  }

  // Deny email event
  denyEmailEvent(emailId) {
    const eventCard = document.querySelector(`[data-email-id="${emailId}"]`);
    if (eventCard) {
      eventCard.classList.add('processed');
      // Update the status to show denied
      const actionsEl = eventCard.querySelector('.event-actions');
      if (actionsEl) {
        actionsEl.innerHTML = `
          <div class="event-status">
            <span class="status-denied">❌ Denied</span>
          </div>
        `;
      }
    }
  }

  // Create datetime string for calendar
  createDateTimeString(dateText, timeText) {
    try {
      let date = new Date();
      
      // Parse date from text
      if (dateText.includes('Tomorrow')) {
        date.setDate(date.getDate() + 1);
      } else if (dateText.includes('Today')) {
        // Use today
      } else {
        // Try to parse specific date
        const parsedDate = new Date(dateText);
        if (!isNaN(parsedDate.getTime())) {
          date = parsedDate;
        }
      }

      // Parse time - updated to handle "3:00 pm" format
      if (timeText) {
        console.log('Parsing time for calendar:', timeText);
        
        // Handle "3:00 pm" format
        const timeMatch = timeText.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
        if (timeMatch) {
          let hours = parseInt(timeMatch[1]);
          const minutes = parseInt(timeMatch[2]);
          const period = timeMatch[3].toLowerCase();

          // Convert to 24-hour format
          if (period === 'pm' && hours !== 12) {
            hours += 12;
          } else if (period === 'am' && hours === 12) {
            hours = 0;
          }

          date.setHours(hours, minutes, 0, 0);
          console.log('Set time to:', hours, minutes, period, '->', date.toISOString());
        } else {
          // Fallback: try to parse without minutes
          const simpleTimeMatch = timeText.match(/(\d{1,2})\s*(am|pm)/i);
          if (simpleTimeMatch) {
            let hours = parseInt(simpleTimeMatch[1]);
            const period = simpleTimeMatch[2].toLowerCase();

            // Convert to 24-hour format
            if (period === 'pm' && hours !== 12) {
              hours += 12;
            } else if (period === 'am' && hours === 12) {
              hours = 0;
            }

            date.setHours(hours, 0, 0, 0);
            console.log('Set time to (fallback):', hours, 0, period, '->', date.toISOString());
          }
        }
      }

      return date.toISOString();
    } catch (error) {
      console.error('Failed to create datetime string:', error);
      // Fallback to current time
      return new Date().toISOString();
    }
  }

  // Create end datetime (1 hour after start)
  createEndDateTimeString(dateText, timeText) {
    const startDate = new Date(this.createDateTimeString(dateText, timeText));
    startDate.setHours(startDate.getHours() + 1);
    return startDate.toISOString();
  }

  // Extract timezone from time text
  extractTimezone(timeText) {
    const timezoneMatch = timeText.match(/(est|pst|cst|mst|utc)/i);
    if (timezoneMatch) {
      const tz = timezoneMatch[1].toUpperCase();
      // Convert to IANA timezone format
      const timezoneMap = {
        'EST': 'America/New_York',
        'PST': 'America/Los_Angeles',
        'CST': 'America/Chicago',
        'MST': 'America/Denver',
        'UTC': 'UTC'
      };
      return timezoneMap[tz] || 'America/New_York';
    }
    return 'America/New_York'; // Default timezone
  }

  // Show success message
  showSuccessMessage(message) {
    // Create success notification
    const notification = document.createElement('div');
    notification.className = 'success-notification';
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-icon">✅</span>
        <span class="notification-text">${message}</span>
        <button class="notification-close">×</button>
      </div>
    `;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 5000);
    
    // Close button
    notification.querySelector('.notification-close').addEventListener('click', () => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    });
  }

  // Show error message
  showErrorMessage(message) {
    // Create error notification
    const notification = document.createElement('div');
    notification.className = 'error-notification';
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-icon">❌</span>
        <span class="notification-text">${message}</span>
        <button class="notification-close">×</button>
      </div>
    `;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 5000);
    
    // Close button
    notification.querySelector('.notification-close').addEventListener('click', () => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    });
  }

  // Add monitored email
  addMonitoredEmail() {
    const emailInput = document.getElementById('newEmailInput');
    if (!emailInput) {
      console.error('❌ Email input element not found!');
      return;
    }
    
    const email = emailInput.value.trim();
    if (!email) {
      console.log('⚠️ No email entered');
      return;
    }
    
    console.log('➕ Adding monitored email:', email);
    console.log('Current monitored emails:', this.monitoredEmails);
    
    if (!this.monitoredEmails.includes(email)) {
      this.monitoredEmails.push(email);
      console.log('✅ Email added to monitored list');
      
      this.updateMonitoredEmailsList();
      this.saveMonitoredEmails(); // Save to storage
      
      // Clear the input field
      emailInput.value = '';
      
      console.log('Updated monitored emails:', this.monitoredEmails);
    } else {
      console.log('⚠️ Email already monitored:', email);
    }
  }

  // Remove monitored email
  removeMonitoredEmail(email) {
    this.monitoredEmails = this.monitoredEmails.filter(e => e !== email);
    this.updateMonitoredEmailsList();
    this.saveMonitoredEmails(); // Save to storage
  }

  // Update monitored emails list display
  updateMonitoredEmailsList() {
    const emailListEl = document.getElementById('emailList');
    console.log('Updating email list. Element found:', !!emailListEl);
    console.log('Current monitored emails:', this.monitoredEmails);
    
    if (emailListEl) {
      if (this.monitoredEmails.length === 0) {
        emailListEl.innerHTML = `
          <div class="no-emails">
            <p>No email addresses monitored yet.</p>
            <p>Add an email address above to start monitoring.</p>
          </div>
        `;
      } else {
        emailListEl.innerHTML = this.monitoredEmails.map(email => `
          <div class="email-item">
            <span>${email}</span>
            <button class="btn btn-small btn-danger" data-email="${email}">
              Remove
            </button>
          </div>
        `).join('');
      }
      console.log('Email list updated with HTML:', emailListEl.innerHTML);
    } else {
      console.error('Email list element not found!');
    }
  }

  // Clear all processed email events
  async clearAllProcessedEmailEvents() {
    const eventsListEl = document.getElementById('emailEventsList');
    if (eventsListEl) {
      eventsListEl.innerHTML = `
        <div class="no-events">
          <p>No events found in recent emails.</p>
          <p>Make sure you have emails from monitored addresses.</p>
        </div>
      `;
    }
    const eventCountEl = document.getElementById('eventCount');
    if (eventCountEl) {
      eventCountEl.textContent = '0';
    }
    this.displayEmailEvents([]); // Re-render with empty list
  }

  // Storage methods
  async storeToken(token) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ accessToken: token }, resolve);
    });
  }

  async getStoredToken() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['accessToken'], (result) => {
        resolve(result.accessToken);
      });
    });
  }

  async clearStoredToken() {
    return new Promise((resolve) => {
      chrome.storage.local.remove(['accessToken'], resolve);
    });
  }

  async storeTasks(tasks) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ tasks: tasks }, resolve);
    });
  }

  async getStoredTasks() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['tasks'], (result) => {
        resolve(result.tasks || []);
      });
    });
  }

  async clearStoredTasks() {
    return new Promise((resolve) => {
      chrome.storage.local.remove(['tasks'], resolve);
    });
  }

  // Load monitored emails from storage
  async loadMonitoredEmails() {
    try {
      console.log('Loading monitored emails from storage...');
      const result = await chrome.storage.local.get(['monitoredEmails']);
      console.log('Storage result:', result);
      
      if (result.monitoredEmails && result.monitoredEmails.length > 0) {
        this.monitoredEmails = result.monitoredEmails;
        console.log('✅ Loaded monitored emails from storage:', this.monitoredEmails);
      } else {
        console.log('📭 No monitored emails found in storage, starting with empty array');
        this.monitoredEmails = [];
      }
    } catch (error) {
      console.error('❌ Failed to load monitored emails:', error);
      this.monitoredEmails = [];
    }
  }

  // Save monitored emails to storage
  async saveMonitoredEmails() {
    try {
      console.log('💾 Saving monitored emails to storage:', this.monitoredEmails);
      await chrome.storage.local.set({ monitoredEmails: this.monitoredEmails });
      console.log('✅ Successfully saved monitored emails to storage');
    } catch (error) {
      console.error('❌ Failed to save monitored emails:', error);
    }
  }

  // Test email extraction with a simple example
  testSimpleExtraction() {
    console.log('🧪 Testing time extraction...');
    
    const testEmails = [
      {
        subject: 'Test Meeting',
        text: 'We have a meeting at 3 PM tomorrow. Please come.',
        from: 'test@example.com',
        date: new Date().toISOString()
      },
      {
        subject: 'Another Test',
        text: 'Meeting at 12 PM EST on Monday.',
        from: 'test2@example.com',
        date: new Date().toISOString()
      },
      {
        subject: 'Time Test',
        text: 'Meeting at 6:40 PM in the conference room.',
        from: 'test3@example.com',
        date: new Date().toISOString()
      }
    ];

    for (const email of testEmails) {
      console.log('📧 Testing email:', email.subject);
      const result = this.extractEventWithPatterns(email);
      console.log('🎯 Extraction result:', result);
      
      if (result && result.time) {
        console.log('✅ Time extracted:', result.time);
      } else {
        console.log('❌ No time extracted');
      }
    }
  }
}

// Initialize the popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing popup...');
  try {
    window.popup = new AgendifyPopup();
    console.log('Popup initialized successfully');
  } catch (error) {
    console.error('Failed to initialize popup:', error);
  }
});

// Fallback initialization
if (document.readyState === 'loading') {
  console.log('Document still loading, waiting for DOMContentLoaded...');
} else {
  console.log('Document already loaded, initializing immediately...');
  try {
    window.popup = new AgendifyPopup();
    console.log('Popup initialized successfully (immediate)');
  } catch (error) {
    console.error('Failed to initialize popup (immediate):', error);
  }
} 