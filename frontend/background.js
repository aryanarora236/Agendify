// Chrome Extension Background Service Worker
console.log('Agendify background script loaded');

// Test basic Chrome APIs are available
console.log('Chrome runtime available:', !!chrome.runtime);
console.log('Chrome storage available:', !!chrome.storage);
console.log('Chrome identity available:', !!chrome.identity);

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Agendify extension installed:', details.reason);
  
  if (details.reason === 'install') {
    // First time installation - set up default storage
    try {
      chrome.storage.local.set({
        tasks: [],
        settings: {
          notifications: true,
          autoRefresh: true
        }
      }, () => {
        if (chrome.runtime.lastError) {
          console.error('Storage error:', chrome.runtime.lastError);
        } else {
          console.log('Default storage initialized successfully');
        }
      });
    } catch (error) {
      console.error('Failed to initialize storage:', error);
    }
  }
});

// Handle extension icon click - open panel instead of popup
chrome.action.onClicked.addListener((tab) => {
  console.log('Extension icon clicked on tab:', tab.id);
  
  // Open the panel
  chrome.windows.create({
    url: chrome.runtime.getURL('popup.html'),
    type: 'panel',
    width: 450, // Updated to match CSS
    height: 600,
    focused: true
  });
});

// Handle messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received:', request.type);
  
  if (request.type === 'GET_AUTH_TOKEN') {
    try {
      chrome.identity.getAuthToken({ interactive: false }, (token) => {
        if (chrome.runtime.lastError) {
          console.error('Auth token error:', chrome.runtime.lastError);
          sendResponse({ error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ token: token });
        }
      });
    } catch (error) {
      console.error('Failed to get auth token:', error);
      sendResponse({ error: error.message });
    }
    return true; // Keep message channel open for async response
  }
  
  if (request.type === 'REMOVE_AUTH_TOKEN') {
    try {
      chrome.identity.removeCachedAuthToken({ token: request.token }, () => {
        if (chrome.runtime.lastError) {
          console.error('Remove token error:', chrome.runtime.lastError);
          sendResponse({ error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ success: true });
        }
      });
    } catch (error) {
      console.error('Failed to remove auth token:', error);
      sendResponse({ error: error.message });
    }
    return true;
  }
  
  // Handle test messages
  if (request.type === 'TEST') {
    console.log('Test message received');
    sendResponse({ status: 'ok', message: 'Background script is working' });
  }
  
  // Handle self-test messages (for testing from background script console)
  if (request.type === 'SELF_TEST') {
    console.log('Self-test message received');
    sendResponse({ status: 'ok', message: 'Self-test successful' });
  }
});

// Simple periodic check for upcoming tasks (every 15 minutes)
setInterval(() => {
  checkUpcomingItems();
}, 15 * 60 * 1000);

async function checkUpcomingItems() {
  try {
    const result = await chrome.storage.local.get(['tasks']);
    const tasks = result.tasks || [];
    
    const now = new Date();
    const upcomingTasks = tasks.filter(task => {
      if (!task.dueDate || task.completed) return false;
      
      const dueDate = new Date(task.dueDate);
      const timeDiff = dueDate.getTime() - now.getTime();
      const minutesDiff = Math.floor(timeDiff / (1000 * 60));
      
      return minutesDiff >= 0 && minutesDiff <= 30;
    });
    
    if (upcomingTasks.length > 0) {
      console.log('Upcoming tasks found:', upcomingTasks.length);
    }
    
  } catch (error) {
    console.error('Error checking upcoming items:', error);
  }
}

// Handle extension updates
chrome.runtime.onUpdateAvailable.addListener(() => {
  console.log('Update available, reloading extension');
  chrome.runtime.reload();
});

// Test function to verify everything is working
function testExtension() {
  console.log('=== Testing Extension ===');
  console.log('Runtime ID:', chrome.runtime.id);
  console.log('Manifest version:', chrome.runtime.getManifest().manifest_version);
  console.log('Extension name:', chrome.runtime.getManifest().name);
  
  // Test storage
  chrome.storage.local.get(['tasks'], (result) => {
    console.log('Storage test result:', result);
  });
  
  // Test self-messaging (this will work)
  chrome.runtime.sendMessage({type: 'SELF_TEST'}, (response) => {
    if (chrome.runtime.lastError) {
      console.log('Self-test error (expected):', chrome.runtime.lastError.message);
    } else {
      console.log('Self-test response:', response);
    }
  });
  
  console.log('=== Test Complete ===');
}

// Run test after a short delay
setTimeout(testExtension, 1000); 