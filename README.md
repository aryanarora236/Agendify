# Agendify — Smart Agenda Generator
 
> A Chrome extension and embeddable website widget that automatically generates a unified daily agenda from your Google Calendar and tasks — zero manual input required.
 
---
 
## What it does
 
Most people juggle Google Calendar, Gmail, and scattered to-do lists. Agendify pulls them into one chronological view and keeps you on top of your day through browser notifications and a daily email digest — all triggered by a single OAuth login.
 
---
 
## Features
 
| Feature | Description |
|---|---|
| 🔐 Google OAuth | One-click sign-in connecting Calendar and Gmail |
| 📅 Smart Agenda View | Today's events and tasks in chronological order |
| ✅ Task Management | Add, edit, and schedule tasks with due dates |
| 🔔 Notifications | Browser push alerts for upcoming events |
| 📧 Daily Digest | Morning email summary of the day ahead |
| 🧩 Chrome Extension | Popup interface with live calendar integration |
| 🌐 Website Widget | Drop-in embeddable component for any site |
 
---
 
## Tech Stack
 
**Frontend:** JavaScript, HTML, CSS  
**Backend:** Python  
**Auth:** Google OAuth 2.0  
**APIs:** Google Calendar API, Gmail API  
**Distribution:** Chrome Extension (Manifest V3), embeddable widget script
 
---
 
## Project Structure
 
```
Agendify/
├── backend/          # Python server, Google API integration, notification logic
├── frontend/         # Chrome extension popup, widget, and shared UI components
├── docs/             # Architecture notes and API documentation
└── README.md
```
 
---
 
## Getting Started
 
### Prerequisites
- Node.js (for frontend build)
- Python 3.10+
- A Google Cloud project with Calendar and Gmail APIs enabled
### Setup
 
```bash
# Clone the repo
git clone https://github.com/aryanarora236/Agendify.git
cd Agendify
 
# Backend
cd backend
pip install -r requirements.txt
cp .env.example .env   # Add your Google OAuth credentials
python app.py
 
# Frontend (Chrome Extension)
cd ../frontend
# Load the /frontend/extension folder as an unpacked extension in chrome://extensions
```
 
---
 
## Roadmap
 
- [ ] Deploy widget to a public CDN
- [ ] Add support for Microsoft Outlook / Teams
- [ ] Natural language task input ("remind me tomorrow at 3pm")
- [ ] AI-powered schedule suggestions based on workload
---
 
## License
 
MIT
 
