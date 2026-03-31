import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'
import { initLogger, logger } from './logger.js'
import { db } from './db.js'
import { cloudRestore } from './cloudSync.js'

initLogger(db)

// Auto-restore from cloud if local DB is empty — runs AFTER ready, never blocks it
db.on('ready', () => {
  setTimeout(async () => {
    const count = await db.workouts.count()
    if (count === 0) {
      const restored = await cloudRestore(db)
      if (restored) logger.info('sync', 'Auto-restored data from cloud backup')
    }
  }, 500)
})

// Register SW manually with updateViaCache: 'none' so iOS always fetches
// the latest sw.js without relying on HTTP cache headers
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js', { updateViaCache: 'none' })
    .then(reg => {
      reg.update() // force check on every app load
      logger.info('sw', 'Service worker registered', { scope: reg.scope })
    })
    .catch(err => logger.error('sw', 'Service worker registration failed', { message: err.message }))
}

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
