import React from 'react'
import { format, parseISO } from 'date-fns'
import { Calendar, Clock, CheckSquare, Trash2, MapPin, AlertCircle } from 'lucide-react'

function AgendaItem({ item, onToggleTask, onDeleteTask }) {
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

  const getDateDisplay = () => {
    if (isTask && item.due_at) {
      return format(parseISO(item.due_at), 'MMM d')
    }
    if (isEvent && item.start_dt) {
      return format(parseISO(item.start_dt), 'MMM d')
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

  const handleToggle = () => {
    if (isTask && onToggleTask) {
      onToggleTask(item.id)
    }
  }

  const handleDelete = () => {
    if (isTask && onDeleteTask) {
      onDeleteTask(item.id)
    }
  }

  return (
    <div className={`card p-4 transition-all duration-200 hover:shadow-md ${
      isTask && item.completed ? 'opacity-75 bg-gray-50' : ''
    }`}>
      <div className="flex items-start gap-4">
        {/* Icon and Time */}
        <div className="flex flex-col items-center gap-2 min-w-[60px]">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            isTask ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
          }`}>
            {isTask ? <CheckSquare className="w-5 h-5" /> : <Calendar className="w-5 h-5" />}
          </div>
          
          {getTimeDisplay() && (
            <div className="text-center">
              <div className="text-sm font-semibold text-gray-900">{getTimeDisplay()}</div>
              <div className="text-xs text-gray-500">{getDateDisplay()}</div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className={`font-medium text-gray-900 mb-1 ${
                isTask && item.completed ? 'line-through' : ''
              }`}>
                {item.title}
              </h3>
              
              {item.description && (
                <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                  {item.description}
                </p>
              )}

              {/* Task-specific info */}
              {isTask && (
                <div className="flex items-center gap-2 mb-2">
                  {item.priority && (
                    <span className={`badge ${getPriorityColor(item.priority)}`}>
                      {item.priority}
                    </span>
                  )}
                  {item.completed && (
                    <span className="badge badge-success">Completed</span>
                  )}
                </div>
              )}

              {/* Event-specific info */}
              {isEvent && (
                <div className="flex items-center gap-2 mb-2">
                  {item.location && (
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                      <MapPin className="w-4 h-4" />
                      <span>{item.location}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {isTask && (
                <>
                  <button
                    onClick={handleToggle}
                    className={`p-2 rounded-lg transition-colors ${
                      item.completed
                        ? 'text-green-600 hover:bg-green-50'
                        : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
                    }`}
                    title={item.completed ? 'Mark as incomplete' : 'Mark as complete'}
                  >
                    <CheckSquare className={`w-5 h-5 ${item.completed ? 'fill-current' : ''}`} />
                  </button>
                  
                  <button
                    onClick={handleDelete}
                    className="p-2 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                    title="Delete task"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AgendaItem 