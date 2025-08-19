import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { calendarApi, tasksApi } from '../services/api'
import { format, parseISO } from 'date-fns'
import { Calendar, Clock, CheckSquare, Plus, LogOut, Bell, Settings } from 'lucide-react'
import TaskForm from './TaskForm'
import AgendaItem from './AgendaItem'

function Dashboard() {
  const { user, logout } = useAuth()
  const [events, setEvents] = useState([])
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [activeTab, setActiveTab] = useState('agenda')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [eventsData, tasksData] = await Promise.all([
        calendarApi.getTodayEvents(),
        tasksApi.getTodayTasks()
      ])
      
      if (eventsData.success) setEvents(eventsData.events)
      if (tasksData.success) setTasks(tasksData.tasks)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <Calendar className="w-8 h-8 text-primary-600" />
              <h1 className="text-2xl font-bold text-gray-900">Agendify</h1>
            </div>
            
            <div className="flex items-center gap-4">
              <button className="btn-outline">
                <Bell className="w-4 h-4" />
              </button>
              <button className="btn-outline">
                <Settings className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2">
                <img 
                  src={user.picture || '/default-avatar.png'} 
                  alt={user.name}
                  className="w-8 h-8 rounded-full"
                />
                <span className="text-sm font-medium text-gray-700">{user.name}</span>
              </div>
              <button onClick={logout} className="btn-outline">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="flex space-x-1 bg-white p-1 rounded-lg shadow-sm mb-6">
          <button
            onClick={() => setActiveTab('agenda')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'agenda'
                ? 'bg-primary-100 text-primary-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Today's Agenda
          </button>
          <button
            onClick={() => setActiveTab('tasks')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'tasks'
                ? 'bg-primary-100 text-primary-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Tasks
          </button>
        </div>

        {/* Content */}
        {activeTab === 'agenda' ? (
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">Today's Agenda</h2>
              <button
                onClick={() => setShowTaskForm(true)}
                className="btn-primary flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Task
              </button>
            </div>

            {/* Agenda Items */}
            {agendaItems.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No items for today</h3>
                <p className="text-gray-500">Add a task or check your calendar for events</p>
              </div>
            ) : (
              <div className="space-y-3">
                {agendaItems.map((item) => (
                  <AgendaItem
                    key={`${item.type || 'task'}-${item.id}`}
                    item={item}
                    onToggleTask={handleToggleTask}
                    onDeleteTask={handleDeleteTask}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">Task Management</h2>
              <button
                onClick={() => setShowTaskForm(true)}
                className="btn-primary flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Task
              </button>
            </div>

            {/* Tasks List */}
            {tasks.length === 0 ? (
              <div className="text-center py-12">
                <CheckSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No tasks yet</h3>
                <p className="text-gray-500">Create your first task to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tasks.map((task) => (
                  <AgendaItem
                    key={`task-${task.id}`}
                    item={task}
                    onToggleTask={handleToggleTask}
                    onDeleteTask={handleDeleteTask}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Task Form Modal */}
      {showTaskForm && (
        <TaskForm
          onSubmit={handleCreateTask}
          onCancel={() => setShowTaskForm(false)}
        />
      )}
    </div>
  )
}

export default Dashboard 