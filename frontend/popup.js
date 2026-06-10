class AgendifyPopup {
  constructor() {
    this.isAuthenticated = false;
    this.accessToken = null;
    this.user = null;
    this.tasks = [];
    this.events = [];
    this.monitoredEmails = [];
    this.openaiKey = null;

    this.init();
  }

  async init() {
    await this.loadMonitoredEmails();
    this.openaiKey = await this.loadApiKey();
    await this.checkAuthStatus();
    this.setupEventListeners();
    this.updateDate();
    if (this.isAuthenticated) await this.loadAgenda();
  }

  // ── Auth ──────────────────────────────────────────────────────────────────

  async checkAuthStatus() {
    try {
      const token = await this.getStoredToken();
      if (token) {
        this.accessToken = token;
        this.isAuthenticated = true;
        await this.validateToken(token);
        await this.getUserInfo();
        this.showAgenda();
      } else {
        this.showLogin();
      }
    } catch {
      this.showLogin();
    }
  }

  async validateToken(token) {
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401) {
        await this.clearStoredToken();
        this.accessToken = null;
        this.isAuthenticated = false;
        this.showLogin();
        return false;
      }
      return res.ok;
    } catch { return false; }
  }

  async getUserInfo() {
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { 'Authorization': `Bearer ${this.accessToken}` }
      });
      if (res.ok) this.user = await res.json();
    } catch { /* non-fatal */ }
  }

  async authenticate() {
    try {
      const token = await new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: true }, result => {
          if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
          else resolve(result);
        });
      });
      if (token) {
        this.accessToken = token;
        this.isAuthenticated = true;
        await this.storeToken(token);
        await this.getUserInfo();
        this.showAgenda();
        await this.loadAgenda();
      }
    } catch (error) {
      this.showToast(`Auth failed: ${error.message}`, 'error');
    }
  }

  async logout() {
    try {
      if (this.accessToken) {
        await new Promise(resolve => chrome.identity.removeCachedAuthToken({ token: this.accessToken }, resolve));
      }
      this.accessToken = null;
      this.isAuthenticated = false;
      this.user = null;
      this.tasks = [];
      this.events = [];
      await this.clearStoredToken();
      await this.clearStoredTasks();
      this.showLogin();
    } catch { /* proceed anyway */ }
  }

  // ── Agenda ────────────────────────────────────────────────────────────────

  async loadAgenda() {
    try {
      this.showLoading();
      const [eventsData, tasksData] = await Promise.all([
        this.loadCalendarEvents(),
        this.loadTasks()
      ]);
      this.events = eventsData;
      this.tasks = tasksData;
      this.renderAgenda();
      this.hideLoading();
    } catch {
      this.hideLoading();
    }
  }

  async loadCalendarEvents() {
    try {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const end = new Date(start);
      end.setDate(end.getDate() + 1);

      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
        `timeMin=${start.toISOString()}&timeMax=${end.toISOString()}&singleEvents=true&orderBy=startTime`,
        { headers: { 'Authorization': `Bearer ${this.accessToken}` } }
      );
      if (!res.ok) return [];
      const data = await res.json();
      return (data.items || []).map(e => ({
        id: e.id,
        title: e.summary || 'Untitled Event',
        description: e.description || '',
        start: e.start.dateTime || e.start.date,
        end: e.end.dateTime || e.end.date,
        location: e.location || '',
        type: 'calendar_event',
        isAllDay: !e.start.dateTime
      }));
    } catch { return []; }
  }

  async loadTasks() {
    return (await this.getStoredTasks()) || [];
  }

  async createTask(taskData) {
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
  }

  async toggleTask(taskId) {
    const task = this.tasks.find(t => t.id === taskId);
    if (task) {
      task.completed = !task.completed;
      await this.storeTasks(this.tasks);
      this.renderAgenda();
    }
  }

  async deleteTask(taskId) {
    this.tasks = this.tasks.filter(t => t.id !== taskId);
    await this.storeTasks(this.tasks);
    this.renderAgenda();
  }

  renderAgenda() {
    const agendaItems = document.getElementById('agendaItems');
    const emptyState = document.getElementById('emptyState');

    const allItems = [...this.events, ...this.tasks].sort((a, b) => {
      const at = a.start || a.dueDate, bt = b.start || b.dueDate;
      if (!at && !bt) return 0;
      if (!at) return 1;
      if (!bt) return -1;
      return new Date(at) - new Date(bt);
    });

    if (allItems.length === 0) {
      agendaItems.style.display = 'none';
      emptyState.style.display = 'flex';
      return;
    }
    agendaItems.style.display = 'flex';
    emptyState.style.display = 'none';
    agendaItems.innerHTML = allItems.map(item => this.renderAgendaItem(item)).join('');
  }

  renderAgendaItem(item) {
    const isTask = item.type === 'task';
    const timeDisplay = isTask
      ? (item.dueDate ? this.formatTime(item.dueDate) : '')
      : (item.start ? this.formatTime(item.start) : '');

    const iconSvg = isTask
      ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>'
      : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';

    const actions = isTask ? `
      <button class="btn btn-icon btn-small" onclick="popup.toggleTask('${item.id}')" title="${item.completed ? 'Mark incomplete' : 'Done'}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
      </button>
      <button class="btn btn-icon btn-small" onclick="popup.deleteTask('${item.id}')" title="Delete">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
      </button>` : '';

    return `
      <div class="agenda-item">
        <div class="item-icon ${isTask ? 'task' : 'calendar'}">${iconSvg}</div>
        <div class="item-content">
          <div class="item-title" style="${isTask && item.completed ? 'text-decoration:line-through;opacity:.5' : ''}">${item.title}</div>
          ${timeDisplay ? `<div class="item-time">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            ${timeDisplay}</div>` : ''}
          ${item.description ? `<div class="item-description">${item.description}</div>` : ''}
          ${isTask && item.priority ? `<div class="item-meta"><span class="priority-badge ${item.priority}">${item.priority}</span></div>` : ''}
        </div>
        ${actions ? `<div class="item-actions">${actions}</div>` : ''}
      </div>`;
  }

  formatTime(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const today = new Date(); today.setHours(0,0,0,0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    if (date >= today && date < tomorrow)
      return `Today ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    if (date >= tomorrow && date < new Date(tomorrow.getTime() + 86400000))
      return `Tomorrow ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  // ── UI helpers ────────────────────────────────────────────────────────────

  updateDate() {
    const el = document.getElementById('date');
    if (el) el.textContent = new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  }

  showLogin() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('login').style.display = 'flex';
    document.getElementById('agenda').style.display = 'none';
  }

  showAgenda() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('login').style.display = 'none';
    document.getElementById('agenda').style.display = 'flex';
  }

  showLoading() { document.getElementById('loading').style.display = 'flex'; }
  hideLoading() { document.getElementById('loading').style.display = 'none'; }
  showTaskModal() { document.getElementById('taskModal').style.display = 'flex'; }
  closeTaskModal() {
    document.getElementById('taskModal').style.display = 'none';
    document.getElementById('taskForm').reset();
  }

  showError(msg) { console.error(msg); }

  showToast(message, type = 'success') {
    const old = document.querySelector('.toast');
    if (old) old.remove();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  }

  setupEventListeners() {
    document.getElementById('loginBtn')?.addEventListener('click', () => this.authenticate());

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
    });

    document.getElementById('addTaskBtn')?.addEventListener('click', () => this.showTaskModal());
    document.getElementById('refreshBtn')?.addEventListener('click', () => this.loadAgenda());
    document.getElementById('logoutBtn')?.addEventListener('click', () => this.logout());

    document.getElementById('taskForm')?.addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      await this.createTask({
        title: fd.get('title'),
        description: fd.get('description'),
        dueDate: fd.get('dueDate'),
        priority: fd.get('priority')
      });
    });

    document.getElementById('closeModal')?.addEventListener('click', () => this.closeTaskModal());
    document.getElementById('cancelTask')?.addEventListener('click', () => this.closeTaskModal());
  }

  switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    if (tabName === 'agenda') {
      document.getElementById('agendaTab').classList.add('active');
    } else if (tabName === 'email-events') {
      document.getElementById('emailEventsTab').classList.add('active');
      this.loadEmailEventsTab();
    }
  }

  // ── Email Events ──────────────────────────────────────────────────────────

  async loadEmailEventsTab() {
    const container = document.getElementById('emailEventsContent');
    if (!this.isAuthenticated) {
      container.innerHTML = '<div class="no-events" style="margin:20px">Sign in to extract email events.</div>';
      return;
    }
    await this.initializeEmailEvents();
  }

  async initializeEmailEvents() {
    const container = document.getElementById('emailEventsContent');

    container.innerHTML = `
      <div class="email-events-inner">

        <!-- API key -->
        <div class="api-key-section">
          <label>Anthropic API Key</label>
          <div class="api-key-row">
            <input type="password" id="openaiKeyInput" placeholder="sk-ant-…" value="${this.openaiKey || ''}">
            <button id="saveKeyBtn" class="btn btn-primary btn-small">Save</button>
          </div>
          <span class="api-key-hint">Stored locally only. Get yours at console.anthropic.com</span>
        </div>

        <!-- Monitored addresses -->
        <div class="monitored-section">
          <div class="section-title">Monitored senders</div>
          <div class="email-list" id="emailList"></div>
          <div class="add-email">
            <input type="email" id="newEmailInput" class="email-input" placeholder="sender@example.com">
            <button id="addEmailBtn" class="btn btn-primary btn-small">Add</button>
          </div>
        </div>

        <!-- Events -->
        <div class="extracted-section">
          <div class="extracted-header">
            <span class="section-title">Extracted events (<span id="eventCount">0</span>)</span>
            <div class="header-actions">
              <button id="refreshEmailEvents" class="btn btn-primary btn-small">Scan emails</button>
            </div>
          </div>
          <div id="emailEventsError" class="inline-error" style="display:none;"></div>
          <div id="emailEventsLoading" class="tab-loading" style="display:none;">
            <div class="spinner"></div><span>Scanning emails…</span>
          </div>
          <div id="emailEventsList"></div>
        </div>

      </div>`;

    this.updateMonitoredEmailsList();
    this.setupEmailEventListeners();

    // Restore last scan results immediately
    const cached = await this.loadEmailEvents();
    if (cached && cached.length > 0) {
      document.getElementById('eventCount').textContent = cached.length;
      this.displayEmailEvents(cached);
    }
  }

  setupEmailEventListeners() {
    document.getElementById('saveKeyBtn')?.addEventListener('click', async () => {
      const val = document.getElementById('openaiKeyInput')?.value.trim();
      if (!val) return;
      this.openaiKey = val;
      await this.saveApiKey(val);
      this.showToast('API key saved');
    });

    document.getElementById('addEmailBtn')?.addEventListener('click', () => this.addMonitoredEmail());
    document.getElementById('newEmailInput')?.addEventListener('keypress', e => {
      if (e.key === 'Enter') this.addMonitoredEmail();
    });

    document.getElementById('refreshEmailEvents')?.addEventListener('click', () => this.processEmailEvents());

    // Event delegation for remove-email buttons
    document.getElementById('emailList')?.addEventListener('click', e => {
      const email = e.target.closest('[data-remove-email]')?.dataset.removeEmail;
      if (email) this.removeMonitoredEmail(email);
    });
  }

  async processEmailEvents() {
    const loadingEl = document.getElementById('emailEventsLoading');
    const listEl = document.getElementById('emailEventsList');
    const errorEl = document.getElementById('emailEventsError');
    const countEl = document.getElementById('eventCount');

    if (loadingEl) loadingEl.style.display = 'flex';
    if (errorEl)   errorEl.style.display = 'none';
    if (listEl)    listEl.innerHTML = '';

    try {
      if (!this.monitoredEmails.length) {
        listEl.innerHTML = '<div class="no-events">Add sender addresses above to start scanning.</div>';
        countEl.textContent = '0';
        return;
      }

      if (!this.openaiKey) {
        listEl.innerHTML = '<div class="no-events">Enter your OpenAI API key above to enable AI extraction.</div>';
        countEl.textContent = '0';
        return;
      }

      const { default: EmailService } = await import('./src/services/emailService.js');
      const emailService = new EmailService(this.accessToken);

      const messageRefs = await emailService.getEmailsFromDateRange(
        this.monitoredEmails, new Date(Date.now() - 30 * 864e5), new Date()
      );

      if (!messageRefs.length) {
        listEl.innerHTML = '<div class="no-events">No emails found from those senders in the last 30 days.<br>Make sure the address in the monitored list exactly matches the sender.</div>';
        countEl.textContent = '0';
        return;
      }

      const toProcess = messageRefs.slice(0, 20);
      const loadingSpan = loadingEl?.querySelector('span');
      const allEvents = [];
      const emailErrors = [];

      for (let i = 0; i < toProcess.length; i++) {
        const ref = toProcess[i];
        if (loadingSpan) loadingSpan.textContent = `Scanning email ${i + 1} of ${toProcess.length}…`;
        try {
          const email = await emailService.getEmailContent(ref.id);
          if (!email) continue;

          // Fall back to snippet when full text extraction returns empty
          if (!email.text && email.snippet) email.text = email.snippet;
          if (!email.text) continue;

          const extracted = await this.extractWithAI(email, this.openaiKey);
          for (const ev of extracted) {
            allEvents.push({ ...ev, emailId: ref.id, emailSubject: email.subject, emailFrom: email.from, processed: false });
          }
        } catch (err) {
          emailErrors.push(`${ref.id}: ${err.message}`);
          console.warn('Failed to process email', ref.id, err.message);
        }
      }

      countEl.textContent = allEvents.length;
      await this.saveEmailEvents(allEvents);

      if (!allEvents.length) {
        const errDetail = emailErrors.length ? `<br><small style="color:#9ca3af">${emailErrors.length} error(s): ${emailErrors[0]}</small>` : '';
        listEl.innerHTML = `<div class="no-events">Scanned ${toProcess.length} email(s) — no confirmed scheduled events found.${errDetail}</div>`;
      } else {
        this.displayEmailEvents(allEvents);
      }

    } catch (err) {
      console.error('processEmailEvents error:', err);
      if (errorEl) {
        errorEl.textContent = err.message;
        errorEl.style.display = 'block';
      }
    } finally {
      if (loadingEl) loadingEl.style.display = 'none';
    }
  }

  // Call claude-haiku-4-5 via background service worker (avoids popup CSP restrictions)
  async extractWithAI(emailContent, apiKey) {
    const today = new Date().toISOString().split('T')[0];

    const system = `You extract confirmed, scheduled events from emails. Return ONLY a JSON array — no explanation, no markdown.

An event qualifies only when ALL are true:
1. Has a specific date or relative day (today/tomorrow/weekday)
2. Has a specific start time
3. Requires attendance (meeting, session, workshop, class, call, event)

Exclude: resume/form deadlines, sponsor listings, newsletter sections, past events, anything without a time.

Schema per event (return [] if none qualify):
{"event_name":"string","date":"YYYY-MM-DD","start_time":"HH:MM","end_time":"HH:MM or null","location":"string or null","notes":"string or null"}`;

    const user = `Today is ${today}.
Subject: ${emailContent.subject}
From: ${emailContent.from}
Body:
${emailContent.text.slice(0, 3000)}`;

    const result = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        type: 'AI_EXTRACT',
        apiKey,
        payload: {
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 800,
          system,
          messages: [{ role: 'user', content: user }]
        }
      }, response => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        if (!response?.success) return reject(new Error(response?.error || 'Anthropic request failed'));
        resolve(response.data);
      });
    });

    if (result.error) throw new Error(result.error.message || 'Anthropic API error');
    if (!result.content?.[0]) throw new Error('Empty response from Anthropic');

    const raw = result.content[0].text.trim()
      .replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');

    let parsed;
    try { parsed = JSON.parse(raw); } catch { return []; }
    return Array.isArray(parsed) ? parsed : [];
  }

  displayEmailEvents(events) {
    const listEl = document.getElementById('emailEventsList');
    if (!listEl) return;

    listEl.innerHTML = events.map((ev, i) => `
      <div class="event-card" data-idx="${i}">
        <div class="event-card-title">${ev.event_name || 'Event'}</div>
        <div class="event-meta">
          ${ev.date ? `<span class="event-chip">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            ${this.fmtDate(ev.date)}</span>` : ''}
          ${ev.start_time ? `<span class="event-chip">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            ${ev.start_time}${ev.end_time ? ' – ' + ev.end_time : ''}</span>` : ''}
          ${ev.location ? `<span class="event-chip">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            ${ev.location}</span>` : ''}
        </div>
        ${ev.notes ? `<div class="event-source">${ev.notes}</div>` : ''}
        <div class="event-source">From: ${ev.emailFrom || ''} · ${ev.emailSubject || ''}</div>
        ${!ev.processed ? `
          <div class="event-actions">
            <button class="btn btn-success btn-small" onclick="popup.approveEmailEvent(${i})">Add to Calendar</button>
            <button class="btn btn-secondary btn-small" onclick="popup.denyEmailEvent(${i})">Dismiss</button>
          </div>` : `
          <div>
            <span class="event-status ${ev.calendarEventId ? 'status-success' : 'status-denied'}">
              ${ev.calendarEventId ? 'Added to Calendar' : 'Dismissed'}
            </span>
          </div>`}
      </div>`).join('');

    this._emailEvents = events;
  }

  async approveEmailEvent(idx) {
    const ev = this._emailEvents?.[idx];
    if (!ev) return;

    try {
      const { default: CalendarService } = await import('./src/services/calendarService.js');
      const cal = new CalendarService(this.accessToken);

      const startDt = this.buildISO(ev.date, ev.start_time);
      const endDt = ev.end_time ? this.buildISO(ev.date, ev.end_time) : new Date(new Date(startDt).getTime() + 3600000).toISOString();

      const created = await cal.createEvent({
        summary: ev.event_name,
        description: ev.notes || `Extracted by Agendify from: ${ev.emailSubject}`,
        start: { dateTime: startDt, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        end:   { dateTime: endDt,   timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        ...(ev.location ? { location: ev.location } : {})
      });

      this._emailEvents[idx] = { ...ev, processed: true, calendarEventId: created.id };
      this.displayEmailEvents(this._emailEvents);
      await this.saveEmailEvents(this._emailEvents);
      this.showToast(`"${ev.event_name}" added to Calendar`);
    } catch (err) {
      this.showToast(`Failed: ${err.message}`, 'error');
    }
  }

  async denyEmailEvent(idx) {
    if (!this._emailEvents?.[idx]) return;
    this._emailEvents[idx] = { ...this._emailEvents[idx], processed: true, calendarEventId: null };
    this.displayEmailEvents(this._emailEvents);
    await this.saveEmailEvents(this._emailEvents);
  }

  // Build an ISO datetime string from a YYYY-MM-DD date and HH:MM time
  buildISO(date, time) {
    if (!date || !time) return new Date().toISOString();
    return new Date(`${date}T${time}:00`).toISOString();
  }

  fmtDate(dateStr) {
    if (!dateStr) return '';
    try {
      return new Date(dateStr + 'T12:00:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    } catch { return dateStr; }
  }

  // ── Monitored emails ──────────────────────────────────────────────────────

  addMonitoredEmail() {
    const input = document.getElementById('newEmailInput');
    const email = input?.value.trim();
    if (!email || this.monitoredEmails.includes(email)) return;
    this.monitoredEmails.push(email);
    input.value = '';
    this.updateMonitoredEmailsList();
    this.saveMonitoredEmails();
  }

  removeMonitoredEmail(email) {
    this.monitoredEmails = this.monitoredEmails.filter(e => e !== email);
    this.updateMonitoredEmailsList();
    this.saveMonitoredEmails();
  }

  updateMonitoredEmailsList() {
    const el = document.getElementById('emailList');
    if (!el) return;
    if (!this.monitoredEmails.length) {
      el.innerHTML = '<div class="no-emails">No senders added yet.</div>';
      return;
    }
    el.innerHTML = this.monitoredEmails.map(email => `
      <div class="email-item">
        <span>${email}</span>
        <button class="btn btn-danger btn-small" data-remove-email="${email}">Remove</button>
      </div>`).join('');
  }

  // ── Storage ───────────────────────────────────────────────────────────────

  storeToken(t)     { return new Promise(r => chrome.storage.local.set({ accessToken: t }, r)); }
  getStoredToken()  { return new Promise(r => chrome.storage.local.get(['accessToken'], d => r(d.accessToken))); }
  clearStoredToken(){ return new Promise(r => chrome.storage.local.remove(['accessToken'], r)); }

  storeTasks(t)     { return new Promise(r => chrome.storage.local.set({ tasks: t }, r)); }
  getStoredTasks()  { return new Promise(r => chrome.storage.local.get(['tasks'], d => r(d.tasks || []))); }
  clearStoredTasks(){ return new Promise(r => chrome.storage.local.remove(['tasks'], r)); }

  async loadMonitoredEmails() {
    const { monitoredEmails = [] } = await new Promise(r => chrome.storage.local.get(['monitoredEmails'], r));
    this.monitoredEmails = monitoredEmails;
  }

  saveMonitoredEmails() {
    return new Promise(r => chrome.storage.local.set({ monitoredEmails: this.monitoredEmails }, r));
  }

  async loadApiKey() {
    const { openaiKey } = await new Promise(r => chrome.storage.local.get(['openaiKey'], r));
    return openaiKey || null;
  }

  saveApiKey(key) {
    return new Promise(r => chrome.storage.local.set({ openaiKey: key }, r));
  }

  saveEmailEvents(events) {
    return new Promise(r => chrome.storage.local.set({ emailEvents: events }, r));
  }

  loadEmailEvents() {
    return new Promise(r => chrome.storage.local.get(['emailEvents'], d => r(d.emailEvents || null)));
  }
}

window.popup = new AgendifyPopup();
