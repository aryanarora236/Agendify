import React, { useState, useEffect } from 'react'
import { Calendar, Clock, CheckSquare, Plus, X, LogIn } from 'lucide-react'
import { calendarApi, tasksApi } from '../services/api'
import { format, parseISO } from 'date-fns'
import TaskForm from './TaskForm'

function AgendaWidget({ elementId, apiBaseUrl }) {
  const [events, setEvents] = useState([])
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState(null)

  useEffect(() => {
    checkAuthStatus()
  }, [])

  const checkAuthStatus = async () => {
    try {
      const token = localStorage.getItem('authToken')
      if (token) {
        // Set API base URL
        if (apiBaseUrl) {
          window.AGENDIFY_API_URL = apiBaseUrl
        }
        
        const response = await tasksApi.getTodayTasks()
        if (response.success) {
          setIsAuthenticated(true)
          setTasks(response.tasks)
          loadEvents()
        } else {
          localStorage.removeItem('authToken')
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadEvents = async () => {
    try {
      const response = await calendarApi.getTodayEvents()
      if (response.success) {
        setEvents(response.events)
      }
    } catch (error) {
      console.error('Failed to load events:', error)
    }
  }

  const handleLogin = () => {
    const apiUrl = apiBaseUrl || window.AGENDIFY_API_URL || 'http://localhost:5000'
    window.location.href = `${apiUrl}/auth/login`
  }

  const handleCreateTask = async (taskData) => {
    try {
      const response = await tasksApi.createTask(taskData)
      if (response.success) {
        setTasks([...tasks, response.task])
        setShowTaskForm(false)
      }
    } catch (error) {
      console.error('Failed to create task:', error)
    }
  }

  const handleToggleTask = async (taskId) => {
    try {
      const response = await tasksApi.toggleTask(taskId)
      if (response.success) {
        setTasks(tasks.map(task => 
          task.id === taskId ? response.task : task
        ))
      }
    } catch (error) {
      console.error('Failed to toggle task:', error)
    }
  }

  const handleDeleteTask = async (taskId) => {
    try {
      await tasksApi.deleteTask(taskId)
      setTasks(tasks.filter(task => task.id !== taskId))
    } catch (error) {
      console.error('Failed to delete task:', error)
    }
  }

  // Combine and sort events and tasks
  const agendaItems = [...events, ...tasks].sort((a, b) => {
    const aTime = a.start_dt || a.due_at
    const bTime = b.start_dt || b.due_at
    if (!aTime && !bTime) return 0
    if (!aTime) return 1
    if (!bTime) return -1
    return new Date(aTime) - new Date(bTime)
  })

  if (loading) {
    return (
      <div className="agendify-widget bg-white rounded-lg shadow-lg border border-gray-200 p-4 w-80">
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="agendify-widget bg-white rounded-lg shadow-lg border border-gray-200 p-4 w-80">
        <div className="text-center py-8">
          <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Agendify Widget</h3>
          <p className="text-sm text-gray-500 mb-4">Sign in to view your agenda</p>
          <button
            onClick={handleLogin}
            className="btn-primary flex items-center gap-2 mx-auto"
          >
            <LogIn className="w-4 h-4" />
            Sign In
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="agendify-widget bg-white rounded-lg shadow-lg border border-gray-200 w-80">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            <h2 className="font-semibold">Today's Agenda</h2>
          </div>
          <button
            onClick={() => setShowTaskForm(true)}
            className="p-1 hover:bg-blue-500 rounded transition-colors"
            title="Add Task"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 max-h-96 overflow-y-auto">
        {agendaItems.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No items for today</p>
          </div>
        ) : (
          <div className="space-y-3">
            {agendaItems.map((item) => (
              <AgendaItem
                key={`${item.type || 'task'}-${item.id}`}
                item={item}
                onToggleTask={handleToggleTask}
                onDeleteTask={handleDeleteTask}
                compact={true}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 p-3 bg-gray-50 rounded-b-lg">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Powered by Agendify</span>
          <span>{user?.email}</span>
        </div>
      </div>

      {/* Task Form Modal */}
      {showTaskForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Add Task</h3>
              <button
                onClick={() => setShowTaskForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <TaskForm
              onSubmit={handleCreateTask}
              onCancel={() => setShowTaskForm(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// Compact AgendaItem for widget
function AgendaItem({ item, onToggleTask, onDeleteTask, compact = false }) {
  const isTask = !item.type || item.type === 'task'
  const isEvent = item.type === 'calendar_event'
  
  const getTimeDisplay = () => {
    if (isTask && item.due_at) {
      return format(parseISO(item.due_at), 'h:mm a')
    }
    if (isEvent && item.start_dt) {
      return format(parseISO(item.start_dt), 'h:mm a')
    }
    return null
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800'
      case 'low':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className={`bg-gray-50 rounded-lg p-3 ${
      isTask && item.completed ? 'opacity-75' : ''
    }`}>
      <div className="flex items-start gap-3">
        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
          isTask ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
        }`}>
          {isTask ? <CheckSquare className="w-3 h-3" /> : <Calendar className="w-3 h-3" />}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className={`text-sm font-medium text-gray-900 ${
                  isTask && item.completed ? 'line-through' : ''
                }`}>
                  {item.title}
                </h4>
                
                {isTask && item.priority && (
                  <span className={`badge ${getPriorityColor(item.priority)} text-xs px-1.5 py-0.5`}>
                    {item.priority}
                  </span>
                )}
              </div>
              
              {getTimeDisplay() && (
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Clock className="w-3 h-3" />
                  <span>{getTimeDisplay()}</span>
                </div>
              )}
            </div>

            {isTask && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onToggleTask(item.id)}
                  className={`p-1 rounded transition-colors ${
                    item.completed
                      ? 'text-green-600 hover:bg-green-50'
                      : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                  }`}
                >
                  <CheckSquare className={`w-4 h-4 ${item.completed ? 'fill-current' : ''}`} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AgendaWidget 