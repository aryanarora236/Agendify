// Chrome Extension Background Service Worker
chrome.runtime.onInstalled.addListener(() => {
  console.log('Agendify extension installed');
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  // This will open the popup automatically due to manifest configuration
  console.log('Extension icon clicked');
});

// Handle messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_AUTH_TOKEN') {
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
      sendResponse({ token: token });
    });
    return true; // Keep message channel open for async response
  }
  
  if (request.type === 'REMOVE_AUTH_TOKEN') {
    chrome.identity.removeCachedAuthToken({ token: request.token }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});

// Set up periodic notifications (optional)
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkAgenda') {
    // Check for upcoming events/tasks and show notifications
    checkUpcomingItems();
  }
});

// Create alarm for periodic checks (every 15 minutes)
chrome.alarms.create('checkAgenda', { periodInMinutes: 15 });

async function checkUpcomingItems() {
  try {
    // Get stored tasks and check for upcoming ones
    const result = await chrome.storage.local.get(['tasks']);
    const tasks = result.tasks || [];
    
    const now = new Date();
    const upcomingTasks = tasks.filter(task => {
      if (!task.dueDate || task.completed) return false;
      
      const dueDate = new Date(task.dueDate);
      const timeDiff = dueDate.getTime() - now.getTime();
      const minutesDiff = Math.floor(timeDiff / (1000 * 60));
      
      // Show notification for tasks due in the next 30 minutes
      return minutesDiff >= 0 && minutesDiff <= 30;
    });
    
    // Show notifications for upcoming tasks
    upcomingTasks.forEach(task => {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Task Due Soon',
        message: `${task.title} is due in ${Math.floor((new Date(task.dueDate).getTime() - now.getTime()) / (1000 * 60))} minutes`
      });
    });
    
  } catch (error) {
    console.error('Failed to check upcoming items:', error);
  }
}

// Handle installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // First time installation
    console.log('Welcome to Agendify!');
    
    // Set up default storage
    chrome.storage.local.set({
      tasks: [],
      settings: {
        notifications: true,
        autoRefresh: true
      }
    });
  }
});

// Handle extension updates
chrome.runtime.onUpdateAvailable.addListener(() => {
  chrome.runtime.reload();
}); 