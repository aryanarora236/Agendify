// Chrome Extension Background Service Worker

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.local.set({
      tasks: [],
      settings: { notifications: true, autoRefresh: true }
    });
  }
});

// Handle messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_AUTH_TOKEN') {
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ token });
      }
    });
    return true;
  }

  if (request.type === 'REMOVE_AUTH_TOKEN') {
    chrome.identity.removeCachedAuthToken({ token: request.token }, () => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true });
      }
    });
    return true;
  }

  // Proxy Anthropic API calls through the service worker to avoid popup CSP restrictions
  if (request.type === 'AI_EXTRACT') {
    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': request.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify(request.payload)
    })
      .then(r => r.json())
      .then(data => sendResponse({ success: true, data }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

// Check for upcoming tasks every 15 minutes and surface a notification
setInterval(checkUpcomingItems, 15 * 60 * 1000);

async function checkUpcomingItems() {
  try {
    const { tasks = [] } = await chrome.storage.local.get(['tasks']);
    const now = new Date();

    const upcoming = tasks.filter(task => {
      if (!task.dueDate || task.completed) return false;
      const mins = (new Date(task.dueDate) - now) / 60000;
      return mins >= 0 && mins <= 30;
    });

    if (upcoming.length > 0) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Upcoming Tasks',
        message: `You have ${upcoming.length} task${upcoming.length > 1 ? 's' : ''} due within 30 minutes.`
      });
    }
  } catch (error) {
    console.error('Error checking upcoming items:', error);
  }
}

chrome.runtime.onUpdateAvailable.addListener(() => {
  chrome.runtime.reload();
});
