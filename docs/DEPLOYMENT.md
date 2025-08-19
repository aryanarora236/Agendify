# Agendify Deployment Guide

This guide covers deploying both the backend and frontend components of Agendify.

## 🚀 Backend Deployment (Flask)

### Option 1: Render (Recommended for MVP)

1. **Create Render Account**
   - Sign up at [render.com](https://render.com)
   - Create a new account

2. **Create New Web Service**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select the `Agendify` repository

3. **Configure Service**
   ```
   Name: agendify-backend
   Root Directory: backend
   Runtime: Python 3
   Build Command: pip install -r requirements.txt
   Start Command: gunicorn app:app
   ```

4. **Environment Variables**
   Add these in the Render dashboard:
   ```
   FLASK_ENV=production
   SECRET_KEY=your-secure-secret-key
   DATABASE_URL=postgresql://... (Render will provide this)
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   GOOGLE_REDIRECT_URI=https://your-app.onrender.com/auth/google/callback
   FRONTEND_URL=https://your-frontend-domain.com
   ```

5. **Deploy**
   - Click "Create Web Service"
   - Render will automatically deploy your app

### Option 2: Railway

1. **Create Railway Account**
   - Sign up at [railway.app](https://railway.app)
   - Connect your GitHub account

2. **Deploy from GitHub**
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repository
   - Set root directory to `backend`

3. **Configure Environment**
   - Add environment variables in Railway dashboard
   - Railway will provide a PostgreSQL database URL

4. **Deploy**
   - Railway will automatically detect Python and deploy

### Option 3: Heroku (Legacy)

1. **Install Heroku CLI**
   ```bash
   # macOS
   brew install heroku/brew/heroku
   
   # Windows
   # Download from https://devcenter.heroku.com/articles/heroku-cli
   ```

2. **Create Heroku App**
   ```bash
   heroku create your-agendify-app
   ```

3. **Add PostgreSQL**
   ```bash
   heroku addons:create heroku-postgresql:mini
   ```

4. **Configure Environment**
   ```bash
   heroku config:set FLASK_ENV=production
   heroku config:set SECRET_KEY=your-secret-key
   heroku config:set GOOGLE_CLIENT_ID=your-client-id
   heroku config:set GOOGLE_CLIENT_SECRET=your-client-secret
   heroku config:set GOOGLE_REDIRECT_URI=https://your-app.herokuapp.com/auth/google/callback
   ```

5. **Deploy**
   ```bash
   git push heroku main
   ```

## 🌐 Frontend Deployment

### Option 1: Vercel (Recommended)

1. **Create Vercel Account**
   - Sign up at [vercel.com](https://vercel.com)
   - Connect your GitHub account

2. **Import Project**
   - Click "New Project"
   - Import your GitHub repository
   - Set root directory to `frontend`

3. **Configure Build Settings**
   ```
   Framework Preset: Vite
   Build Command: npm run build
   Output Directory: dist
   Install Command: npm install
   ```

4. **Environment Variables**
   ```
   VITE_API_URL=https://your-backend-domain.com
   ```

5. **Deploy**
   - Click "Deploy"
   - Vercel will build and deploy automatically

### Option 2: Netlify

1. **Create Netlify Account**
   - Sign up at [netlify.com](https://netlify.com)
   - Connect your GitHub account

2. **Deploy from Git**
   - Click "New site from Git"
   - Select your repository
   - Set build settings:
     - Build command: `npm run build`
     - Publish directory: `dist`

3. **Environment Variables**
   - Go to Site settings → Environment variables
   - Add `VITE_API_URL`

4. **Deploy**
   - Netlify will build and deploy automatically

### Option 3: GitHub Pages

1. **Build Locally**
   ```bash
   cd frontend
   npm run build
   ```

2. **Push to GitHub**
   ```bash
   git add dist
   git commit -m "Add built frontend"
   git push
   ```

3. **Enable GitHub Pages**
   - Go to repository Settings → Pages
   - Select source branch (e.g., `gh-pages`)
   - Set folder to `/ (root)`

## 🔧 Widget Deployment

### Build Widget Bundle

1. **Build Widget**
   ```bash
   cd frontend
   npm run build:widget
   ```

2. **Upload to CDN**
   - Upload `dist-widget/widget.js` to your CDN
   - Or serve from your domain

### Embed in Websites

```html
<!-- Include React and ReactDOM -->
<script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>

<!-- Include Agendify Widget -->
<script src="https://your-domain.com/widget.js"></script>

<!-- Widget Container -->
<div id="agendify-widget"></div>

<!-- Initialize Widget -->
<script>
  initAgendifyWidget({
    elementId: 'agendify-widget',
    apiBaseUrl: 'https://your-backend-domain.com'
  });
</script>
```

## 🔑 Google API Setup

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project or select existing
3. Enable billing (required for APIs)

### 2. Enable APIs

1. Go to "APIs & Services" → "Library"
2. Enable these APIs:
   - Google Calendar API
   - Gmail API
   - Google+ API (for user info)

### 3. Create OAuth Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth 2.0 Client IDs"
3. Configure OAuth consent screen
4. Set application type to "Web application"
5. Add authorized redirect URIs:
   - `http://localhost:5000/auth/google/callback` (development)
   - `https://your-domain.com/auth/google/callback` (production)

### 4. Get Credentials

1. Copy Client ID and Client Secret
2. Add to your environment variables

## 📊 Database Setup

### SQLite (Development)

- Default for development
- No additional setup required
- Database file: `agendify.db`

### PostgreSQL (Production)

1. **Render/Railway**
   - Automatically provided
   - Use provided DATABASE_URL

2. **Heroku**
   ```bash
   heroku addons:create heroku-postgresql:mini
   ```

3. **Manual Setup**
   ```bash
   # Install PostgreSQL
   # Create database
   createdb agendify
   
   # Set DATABASE_URL
   export DATABASE_URL="postgresql://username:password@localhost/agendify"
   ```

## 🔒 Security Considerations

### Environment Variables

- Never commit `.env` files
- Use strong, unique SECRET_KEY
- Rotate Google API credentials regularly

### CORS Configuration

- Restrict CORS origins to your frontend domains
- Don't use `*` in production

### HTTPS

- Always use HTTPS in production
- Update Google OAuth redirect URIs to use HTTPS

## 📈 Monitoring & Maintenance

### Health Checks

- Backend provides `/health` endpoint
- Monitor response times and errors
- Set up uptime monitoring

### Logs

- Monitor application logs
- Set up error tracking (e.g., Sentry)
- Monitor API usage and rate limits

### Updates

- Keep dependencies updated
- Monitor security advisories
- Regular backups of database

## 🚨 Troubleshooting

### Common Issues

1. **CORS Errors**
   - Check FRONTEND_URL in backend config
   - Verify CORS origins

2. **Google OAuth Errors**
   - Check redirect URIs match exactly
   - Verify API keys are correct
   - Ensure APIs are enabled

3. **Database Connection**
   - Verify DATABASE_URL format
   - Check database permissions
   - Ensure database exists

4. **Build Failures**
   - Check Node.js version (16+)
   - Clear node_modules and reinstall
   - Verify all dependencies in package.json

### Getting Help

- Check application logs
- Verify environment variables
- Test endpoints with Postman/curl
- Check browser console for frontend errors 