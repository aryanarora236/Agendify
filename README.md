# Agendify - Smart Agenda Generator

A website plugin that automatically generates agendas from Google Calendar + tasks with minimal setup.

## 🚀 MVP Features

- **Google OAuth Integration** - Connect your Google Calendar and Gmail
- **Smart Agenda View** - Display today's events and tasks in chronological order
- **Task Management** - Add and manage tasks with due dates
- **Notifications** - Browser notifications for upcoming events and daily email digests
- **Plugin Widget** - Embeddable component for any website

## 🏗️ Project Structure

```
Agendify/
├── backend/          # Flask API server
├── frontend/         # React widget application
├── docs/            # Documentation and API specs
└── scripts/         # Build and deployment scripts
```

## 🛠️ Tech Stack

- **Backend**: Flask, SQLAlchemy, Google APIs (OAuth, Calendar, Gmail)
- **Frontend**: React, Tailwind CSS, Vite
- **Database**: SQLite (MVP), PostgreSQL (production)
- **Deployment**: Render/Railway (backend), Vercel/Netlify (frontend)

## 🚦 Quick Start

### Prerequisites
- Python 3.8+
- Node.js 16+
- Google Cloud Project with OAuth credentials

### Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your Google API credentials
flask run
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### Embed Widget
Add this to any website:
```html
<script src="https://your-frontend-url.com/widget.js"></script>
<div id="agendify-widget"></div>
<script>
  initAgendifyWidget({
    elementId: 'agendify-widget',
    apiBaseUrl: 'https://your-backend-url.com'
  });
</script>
```

## 🔑 Environment Variables

See `.env.example` files in both `backend/` and `frontend/` directories.

## 📝 Development Roadmap

- [x] Project scaffolding
- [ ] Backend authentication & Google OAuth
- [ ] Calendar integration
- [ ] Task management API
- [ ] Frontend widget UI
- [ ] Notifications system
- [ ] Plugin packaging
- [ ] Deployment

## 🤝 Contributing

This is an MVP project. Contributions welcome after core functionality is complete.

## 📄 License

MIT License 