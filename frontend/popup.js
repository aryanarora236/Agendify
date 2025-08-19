// Chrome Extension Popup Logic
class AgendifyPopup {
  constructor() {
    this.isAuthenticated = false;
    this.accessToken = null;
    this.user = null;
    this.tasks = [];
    this.events = [];
    
    this.init();
  }

  async init() {
    await this.checkAuthStatus();
    this.setupEventListeners();
    this.updateDate();
    
    if (this.isAuthenticated) {
      await this.loadAgenda();
    }
  }

  async checkAuthStatus() {
    try {
      const token = await this.getStoredToken();
      if (token) {
        this.accessToken = token;
        this.isAuthenticated = true;
        await this.getUserInfo();
        this.showAgenda();
      } else {
        this.showLogin();
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      this.showLogin();
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
    try {
      const authResult = await chrome.identity.getAuthToken({ interactive: true });
      if (authResult.token) {
        this.accessToken = authResult.token;
        this.isAuthenticated = true;
        await this.storeToken(authResult.token);
        await this.getUserInfo();
        this.showAgenda();
        await this.loadAgenda();
      }
    } catch (error) {
      console.error('Authentication failed:', error);
      this.showError('Authentication failed. Please try again.');
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
    document.getElementById('loading').style.display = 'none';
    document.getElementById('login').style.display = 'block';
    document.getElementById('agenda').style.display = 'none';
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
    document.getElementById('loginBtn').addEventListener('click', () => {
      this.authenticate();
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
}

// Initialize the popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.popup = new AgendifyPopup();
}); 