import React from 'react'
import ReactDOM from 'react-dom/client'
import AgendaWidget from './components/AgendaWidget'
import './index.css'

// Global function to initialize the widget
window.initAgendifyWidget = function(config) {
  const { elementId, apiBaseUrl } = config
  
  if (!elementId) {
    console.error('Agendify: elementId is required')
    return
  }
  
  const element = document.getElementById(elementId)
  if (!element) {
    console.error(`Agendify: Element with id "${elementId}" not found`)
    return
  }
  
  // Render the widget
  const root = ReactDOM.createRoot(element)
  root.render(
    <AgendaWidget 
      elementId={elementId}
      apiBaseUrl={apiBaseUrl}
    />
  )
  
  console.log('Agendify widget initialized successfully')
}

// Auto-initialize if element exists
document.addEventListener('DOMContentLoaded', function() {
  const autoElement = document.querySelector('[data-agendify-widget]')
  if (autoElement) {
    const elementId = autoElement.id || 'agendify-widget'
    const apiBaseUrl = autoElement.dataset.apiUrl
    
    window.initAgendifyWidget({
      elementId,
      apiBaseUrl
    })
  }
}) 