import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Auth API
export const authApi = {
  getCurrentUser: () => api.get('/auth/me').then(res => res.data),
  logout: () => api.post('/auth/logout').then(res => res.data),
  refreshToken: () => api.post('/auth/refresh-token').then(res => res.data),
}

// Calendar API
export const calendarApi = {
  getEvents: (params) => api.get('/api/calendar/events', { params }).then(res => res.data),
  getTodayEvents: () => api.get('/api/calendar/events/today').then(res => res.data),
  getCalendars: () => api.get('/api/calendar/calendars').then(res => res.data),
}

// Tasks API
export const tasksApi = {
  getTasks: (params) => api.get('/api/tasks', { params }).then(res => res.data),
  getTodayTasks: () => api.get('/api/tasks/today').then(res => res.data),
  createTask: (data) => api.post('/api/tasks', data).then(res => res.data),
  updateTask: (id, data) => api.put(`/api/tasks/${id}`, data).then(res => res.data),
  deleteTask: (id) => api.delete(`/api/tasks/${id}`).then(res => res.data),
  toggleTask: (id) => api.post(`/api/tasks/${id}/toggle`).then(res => res.data),
}

// Notifications API
export const notificationsApi = {
  getUpcoming: () => api.get('/api/notifications/upcoming').then(res => res.data),
  sendDailyDigest: () => api.post('/api/notifications/daily-digest').then(res => res.data),
  testEmail: () => api.post('/api/notifications/test-email').then(res => res.data),
}

export default api 