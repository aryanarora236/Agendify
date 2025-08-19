// Chrome Extension Content Script
// This script runs on every webpage and can inject the agenda widget

console.log('Agendify content script loaded');

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'INJECT_WIDGET') {
    injectWidget(request.config);
    sendResponse({ success: true });
  }
  
  if (request.type === 'REMOVE_WIDGET') {
    removeWidget();
    sendResponse({ success: true });
  }
});

// Inject the agenda widget into the current page
function injectWidget(config) {
  // Remove existing widget if any
  removeWidget();
  
  // Create widget container
  const widgetContainer = document.createElement('div');
  widgetContainer.id = 'agendify-widget-container';
  widgetContainer.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    width: 350px;
    max-height: 600px;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    overflow: hidden;
  `;
  
  // Create widget header
  const header = document.createElement('div');
  header.style.cssText = `
    background: linear-gradient(135deg, #3b82f6, #1d4ed8);
    color: white;
    padding: 16px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  `;
  
  header.innerHTML = `
    <div>
      <h3 style="margin: 0; font-size: 16px; font-weight: 600;">Today's Agenda</h3>
      <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.9;">${new Date().toLocaleDateString()}</p>
    </div>
    <button id="agendify-close" style="background: none; border: none; color: white; cursor: pointer; padding: 4px;">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  `;
  
  // Create widget content
  const content = document.createElement('div');
  content.id = 'agendify-content';
  content.style.cssText = `
    padding: 20px;
    max-height: 500px;
    overflow-y: auto;
  `;
  
  // Add loading state
  content.innerHTML = `
    <div style="text-align: center; padding: 40px 20px;">
      <div style="width: 32px; height: 32px; border: 3px solid #e2e8f0; border-top: 3px solid #3b82f6; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 16px;"></div>
      <p style="color: #64748b; margin: 0;">Loading your agenda...</p>
    </div>
    <style>
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    </style>
  `;
  
  // Assemble widget
  widgetContainer.appendChild(header);
  widgetContainer.appendChild(content);
  document.body.appendChild(widgetContainer);
  
  // Add close functionality
  document.getElementById('agendify-close').addEventListener('click', removeWidget);
  
  // Load agenda data
  loadAgendaData(content);
}

// Remove the widget from the page
function removeWidget() {
  const existingWidget = document.getElementById('agendify-widget-container');
  if (existingWidget) {
    existingWidget.remove();
  }
}

// Load agenda data and populate the widget
async function loadAgendaData(contentElement) {
  try {
    // Get stored tasks
    const result = await chrome.storage.local.get(['tasks', 'accessToken']);
    const tasks = result.tasks || [];
    const accessToken = result.accessToken;
    
    let events = [];
    
    // Try to load calendar events if we have an access token
    if (accessToken) {
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
              'Authorization': `Bearer ${accessToken}`
            }
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          events = data.items.map(event => ({
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
      } catch (error) {
        console.error('Failed to load calendar events:', error);
      }
    }
    
    // Combine and sort all items
    const allItems = [...events, ...tasks].sort((a, b) => {
      const aTime = a.start || a.dueDate;
      const bTime = b.start || b.dueDate;
      
      if (!aTime && !bTime) return 0;
      if (!aTime) return 1;
      if (!bTime) return -1;
      
      return new Date(aTime) - new Date(bTime);
    });
    
    // Render agenda items
    if (allItems.length === 0) {
      contentElement.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: #64748b;">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="margin-bottom: 16px;">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          <h4 style="margin: 0 0 8px 0; color: #475569;">No items for today</h4>
          <p style="margin: 0; font-size: 14px;">Add a task or check your calendar</p>
        </div>
      `;
    } else {
      contentElement.innerHTML = allItems.map(item => renderAgendaItem(item)).join('');
    }
    
  } catch (error) {
    console.error('Failed to load agenda data:', error);
    contentElement.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; color: #dc2626;">
        <p style="margin: 0;">Failed to load agenda. Please try again.</p>
      </div>
    `;
  }
}

// Render individual agenda item
function renderAgendaItem(item) {
  const isTask = item.type === 'task';
  const isEvent = item.type === 'calendar_event';
  
  let timeDisplay = '';
  if (isTask && item.dueDate) {
    timeDisplay = formatTime(item.dueDate);
  } else if (isEvent && item.start) {
    timeDisplay = formatTime(item.start);
  }
  
  let iconClass = isTask ? 'task' : 'calendar';
  let iconColor = isTask ? '#3b82f6' : '#16a34a';
  let bgColor = isTask ? '#dbeafe' : '#dcfce7';
  
  let priorityBadge = '';
  if (isTask && item.priority) {
    const priorityColors = {
      high: { bg: '#fef2f2', text: '#dc2626' },
      medium: { bg: '#fffbeb', text: '#d97706' },
      low: { bg: '#f0fdf4', text: '#16a34a' }
    };
    const colors = priorityColors[item.priority] || priorityColors.medium;
    
    priorityBadge = `
      <span style="
        background: ${colors.bg}; 
        color: ${colors.text}; 
        padding: 2px 8px; 
        border-radius: 12px; 
        font-size: 11px; 
        font-weight: 500;
        text-transform: capitalize;
      ">${item.priority}</span>
    `;
  }
  
  return `
    <div style="
      background: white; 
      border: 1px solid #e2e8f0; 
      border-radius: 8px; 
      padding: 16px; 
      margin-bottom: 12px;
      transition: all 0.2s;
    " onmouseover="this.style.borderColor='#cbd5e1'; this.style.boxShadow='0 2px 4px rgba(0,0,0,0.1)'" 
       onmouseout="this.style.borderColor='#e2e8f0'; this.style.boxShadow='none'">
      <div style="display: flex; align-items: flex-start; gap: 12px;">
        <div style="
          width: 32px; 
          height: 32px; 
          border-radius: 50%; 
          background: ${bgColor}; 
          color: ${iconColor}; 
          display: flex; 
          align-items: center; 
          justify-content: center;
          flex-shrink: 0;
        ">
          ${isTask ? 
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>' :
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>'
          }
        </div>
        <div style="flex: 1; min-width: 0;">
          <div style="
            font-weight: 500; 
            color: #1e293b; 
            margin-bottom: 4px;
            word-wrap: break-word;
            ${isTask && item.completed ? 'text-decoration: line-through; opacity: 0.6;' : ''}
          ">${item.title}</div>
          ${timeDisplay ? `
            <div style="
              font-size: 12px; 
              color: #64748b; 
              display: flex; 
              align-items: center; 
              gap: 4px;
              margin-bottom: 8px;
            ">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12,6 12,12 16,14"></polyline>
              </svg>
              ${timeDisplay}
            </div>
          ` : ''}
          ${item.description ? `
            <div style="
              font-size: 13px; 
              color: #64748b; 
              margin-bottom: 8px; 
              line-height: 1.4;
            ">${item.description}</div>
          ` : ''}
          ${priorityBadge ? `
            <div style="display: flex; align-items: center; gap: 8px; margin-top: 8px;">
              ${priorityBadge}
            </div>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}

// Format time for display
function formatTime(dateString) {
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