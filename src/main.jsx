import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'
import { initLogger, logger } from './logger.js'
import { db } from './db.js'

initLogger(db)

window.addEventListener('unhandledrejection', (event) => {
  logger.error('global', 'Unhandled promise rejection', {
    message: event.reason?.message ?? String(event.reason),
    stack: event.reason?.stack?.slice(0, 500),
  })
})

window.onerror = (message, source, lineno, colno, error) => {
  logger.error('global', 'Uncaught JS error', {
    message,
    source,
    lineno,
    colno,
    stack: error?.stack?.slice(0, 500),
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
