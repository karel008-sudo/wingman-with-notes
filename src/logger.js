let _db = null

export function initLogger(db) {
  _db = db
}

const MAX_LOGS = 500

async function persist(level, category, message, data) {
  if (!_db) return
  try {
    await _db.logs.add({
      timestamp: Date.now(),
      level,
      category,
      message,
      data: data !== undefined ? JSON.stringify(data) : null,
    })
    const count = await _db.logs.count()
    if (count > MAX_LOGS) {
      const oldest = await _db.logs.orderBy('id').limit(count - MAX_LOGS).primaryKeys()
      await _db.logs.bulkDelete(oldest)
    }
  } catch {
    // Never let logging crash the app
  }
}

function log(level, category, message, data) {
  const tag = `[${level.toUpperCase()}][${category}]`
  if (level === 'error') console.error(tag, message, data ?? '')
  else if (level === 'warn') console.warn(tag, message, data ?? '')
  else console.log(tag, message, data ?? '')
  persist(level, category, message, data)
}

export const logger = {
  error: (category, message, data) => log('error', category, message, data),
  warn:  (category, message, data) => log('warn',  category, message, data),
  info:  (category, message, data) => log('info',  category, message, data),
  debug: (category, message, data) => log('debug', category, message, data),
}
