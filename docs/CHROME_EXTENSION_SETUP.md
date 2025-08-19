# 🚀 Agendify Chrome Extension Setup Guide

This guide will walk you through setting up the Agendify Chrome extension with Google OAuth integration.

## 📋 Prerequisites

- **Chrome Browser** (or Chromium-based browser)
- **Google Cloud Project** with OAuth credentials
- **Node.js 16+** (for building the extension)

## 🔧 Step 1: Google API Setup

### 1.1 Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable billing (required for APIs)

### 1.2 Enable Required APIs

1. Go to **APIs & Services** → **Library**
2. Enable these APIs:
   - **Google Calendar API**
   - **Gmail API**
   - **Google+ API** (for user info)

### 1.3 Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **"Create Credentials"** → **"OAuth 2.0 Client IDs"**
3. **Important**: Select **"Chrome App"** as the application type
4. Fill in the details:
   ```
   Application type: Chrome App
   Name: Agendify Chrome Extension
   ```
5. **No redirect URIs needed** for Chrome extensions
6. Click **"Create"**
7. **Copy the Client ID** (you'll need this)

## 🔧 Step 2: Build the Extension

### 2.1 Install Dependencies

```bash
cd frontend
npm install
```

### 2.2 Update Manifest with Your Client ID

1. Open `frontend/manifest.json`
2. Replace `YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com` with your actual Client ID
3. Save the file

### 2.3 Build the Extension

```bash
npm run build:extension
```

This will:
- Build the React app
- Copy the built files to the frontend directory
- Clean up the dist folder

## 🔧 Step 3: Load Extension in Chrome

### 3.1 Open Chrome Extensions

1. Open Chrome
2. Go to `chrome://extensions/`
3. Enable **"Developer mode"** (toggle in top right)

### 3.2 Load Unpacked Extension

1. Click **"Load unpacked"**
2. Select the `frontend` folder
3. The extension should now appear in your extensions list

### 3.3 Pin the Extension

1. Click the **puzzle piece icon** in Chrome toolbar
2. Find "Agendify" and click the **pin icon**
3. The extension icon should now appear in your toolbar

## 🧪 Step 4: Test the Extension

### 4.1 First Launch

1. Click the **Agendify extension icon** in your toolbar
2. You should see the login screen
3. Click **"Sign in with Google"**

### 4.2 OAuth Flow

1. Chrome will open a popup for Google OAuth
2. Sign in with your Google account
3. Grant permissions for Calendar and Gmail
4. You should be redirected back to the extension

### 4.3 View Your Agenda

1. After authentication, you should see your agenda
2. Calendar events from Google Calendar will appear
3. You can add tasks using the **"+" button**
4. Tasks are stored locally in Chrome storage

## 🚨 Troubleshooting

### Common Issues

#### "OAuth client not found" Error
- Verify your Client ID is correct in `manifest.json`
- Make sure you selected **"Chrome App"** (not "Web application")
- Check that the Google Cloud project has billing enabled

#### "APIs not enabled" Error
- Go back to Google Cloud Console
- Ensure all required APIs are enabled
- Wait a few minutes after enabling APIs

#### Extension Won't Load
- Check the console for JavaScript errors
- Verify all files are present in the frontend folder
- Try reloading the extension

#### Authentication Fails
- Check that you're signed into the correct Google account
- Verify OAuth consent screen is configured
- Check Chrome's developer console for errors

### Debug Mode

1. Right-click the extension icon
2. Select **"Inspect popup"**
3. Check the Console tab for error messages

## 🔧 Step 5: Customize the Extension

### 5.1 Modify the UI

- Edit `popup.html` for structure changes
- Edit `popup.css` for styling changes
- Edit `popup.js` for functionality changes

### 5.2 Add Features

- Modify the background service worker in `background.js`
- Add content script functionality in `content.js`
- Update the manifest for new permissions

### 5.3 Rebuild After Changes

```bash
npm run build:extension
```

Then reload the extension in Chrome.

## 🚀 Step 6: Package for Distribution

### 6.1 Create Extension Package

1. Go to `chrome://extensions/`
2. Click **"Pack extension"**
3. Select the `frontend` folder
4. Chrome will create a `.crx` file and `.pem` key file

### 6.2 Publish to Chrome Web Store (Optional)

1. Create a developer account at [Chrome Web Store](https://chrome.google.com/webstore/devconsole/)
2. Upload your extension
3. Fill in store listing details
4. Submit for review

## 📱 Extension Features

### Core Functionality
- **Google OAuth Authentication** - Secure login with Google accounts
- **Calendar Integration** - View today's Google Calendar events
- **Task Management** - Create, edit, and manage personal tasks
- **Local Storage** - Tasks stored in Chrome's local storage
- **Notifications** - Browser notifications for upcoming tasks

### User Experience
- **Popup Interface** - Clean, modern popup design
- **Responsive Layout** - Works on different screen sizes
- **Real-time Updates** - Agenda refreshes automatically
- **Easy Navigation** - Simple, intuitive interface

## 🔒 Security Features

- **OAuth 2.0** - Secure authentication with Google
- **Local Storage** - Tasks stored locally, not sent to external servers
- **Permission Scoping** - Minimal required permissions
- **Token Management** - Automatic token refresh and cleanup

## 📚 Next Steps

### Enhancements You Can Add
1. **Multiple Calendar Support** - Show events from multiple calendars
2. **Task Categories** - Organize tasks by project or category
3. **Reminders** - Push notifications for important tasks
4. **Data Export** - Export tasks to various formats
5. **Theme Support** - Light/dark mode toggle
6. **Keyboard Shortcuts** - Quick access to common actions

### Integration Possibilities
1. **Google Tasks API** - Sync with Google Tasks
2. **Todoist Integration** - Connect with Todoist
3. **Slack Notifications** - Send updates to Slack
4. **Email Integration** - Send agenda summaries via email

## 🆘 Getting Help

### Debug Information
- Check Chrome's extension console
- Review the browser's developer tools
- Check the extension's background page console

### Common Solutions
- **Reload the extension** after making changes
- **Clear browser data** if authentication gets stuck
- **Check permissions** in Chrome's extension settings
- **Verify API quotas** in Google Cloud Console

## 🎉 You're Ready!

Congratulations! You now have a working Agendify Chrome extension that:
- ✅ Integrates with Google Calendar
- ✅ Manages personal tasks
- ✅ Provides a clean, modern interface
- ✅ Works offline for task management
- ✅ Syncs calendar events in real-time

Start using it to organize your daily agenda and boost your productivity! 