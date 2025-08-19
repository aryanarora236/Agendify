# 🚀 Agendify Quick Start Guide

Get Agendify up and running in under 10 minutes!

## 📋 Prerequisites

- **Python 3.8+** installed
- **Node.js 16+** installed
- **Git** installed
- **Google Cloud Project** with OAuth credentials

## ⚡ Quick Setup

### 1. Clone and Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/agendify.git
cd agendify

# Setup backend
cd backend
python3 setup.py

# Setup frontend (in new terminal)
cd ../frontend
./setup.sh
```

### 2. Configure Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project or select existing
3. Enable APIs:
   - Google Calendar API
   - Gmail API
4. Create OAuth 2.0 credentials
5. Add redirect URI: `http://localhost:5000/auth/google/callback`
6. Copy Client ID and Secret

### 3. Update Environment Variables

```bash
# Backend (.env)
cd backend
cp .env.example .env
# Edit .env with your Google credentials

# Frontend (.env)
cd ../frontend
# .env should already be created by setup script
```

### 4. Start the Application

```bash
# Terminal 1: Start backend
cd backend
source venv/bin/activate  # On Windows: venv\Scripts\activate
python app.py

# Terminal 2: Start frontend
cd frontend
npm run dev
```

### 5. Access the Application

- **Backend API**: http://localhost:5000
- **Frontend App**: http://localhost:3000
- **Health Check**: http://localhost:5000/health

## 🔧 Manual Setup (Alternative)

### Backend Setup

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env
# Edit .env with your credentials

# Initialize database
python init_db.py

# Start server
python app.py
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create .env file
echo "VITE_API_URL=http://localhost:5000" > .env

# Start development server
npm run dev
```

## 🧪 Test the Setup

### 1. Health Check

```bash
curl http://localhost:5000/health
# Should return: {"status": "healthy", "service": "Agendify Backend"}
```

### 2. Test Authentication

1. Open http://localhost:3000
2. Click "Continue with Google"
3. Complete OAuth flow
4. You should see the dashboard

### 3. Test API Endpoints

```bash
# Get today's events (requires auth)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/calendar/events/today

# Get today's tasks (requires auth)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/tasks/today
```

## 🎯 Next Steps

### 1. Create Your First Task

1. Sign in to the dashboard
2. Click "Add Task"
3. Fill in task details
4. Submit and see it appear in your agenda

### 2. Test Calendar Integration

1. Ensure you have events in your Google Calendar
2. Refresh the dashboard
3. Events should appear alongside tasks

### 3. Build the Widget

```bash
cd frontend
npm run build:widget
# Widget bundle will be in dist-widget/
```

### 4. Embed Widget

```html
<!-- Include in any website -->
<script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
<script src="http://localhost:3000/widget.js"></script>

<div id="agendify-widget"></div>
<script>
  initAgendifyWidget({
    elementId: 'agendify-widget',
    apiBaseUrl: 'http://localhost:5000'
  });
</script>
```

## 🚨 Common Issues

### Backend Won't Start

- Check Python version: `python3 --version`
- Verify virtual environment is activated
- Check `.env` file exists and has correct values
- Ensure all dependencies are installed

### Frontend Won't Start

- Check Node.js version: `node --version`
- Clear `node_modules` and run `npm install` again
- Verify `.env` file exists

### OAuth Errors

- Check redirect URI matches exactly
- Verify Google API credentials are correct
- Ensure required APIs are enabled
- Check browser console for errors

### Database Errors

- Run `python init_db.py` to create tables
- Check database file permissions
- Verify SQLite is working

## 📚 Learn More

- [Deployment Guide](DEPLOYMENT.md) - Deploy to production
- [API Documentation](API.md) - Backend API reference
- [Widget Guide](WIDGET.md) - Embed widget in websites

## 🆘 Need Help?

1. Check the logs for error messages
2. Verify all environment variables are set
3. Test individual components separately
4. Check browser console and network tab
5. Open an issue on GitHub with details

## 🎉 You're Ready!

Congratulations! You now have a working Agendify instance. 

- **Backend**: Flask API with Google OAuth and Calendar integration
- **Frontend**: React dashboard with task management
- **Widget**: Embeddable component for any website

Start building your agenda automation workflows! 