import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'

const LEVEL_STYLES = {
  error: { color: '#f43f5e', bg: 'rgba(244,63,94,0.12)', border: 'rgba(244,63,94,0.25)' },
  warn:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)' },
  info:  { color: '#22d3ee', bg: 'rgba(34,211,238,0.10)', border: 'rgba(34,211,238,0.20)' },
  debug: { color: '#52525b', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)' },
}

function formatTime(ts) {
  const d = new Date(ts)
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    + ' ' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function LogEntry({ log }) {
  const [expanded, setExpanded] = useState(false)
  const s = LEVEL_STYLES[log.level] ?? LEVEL_STYLES.debug
  const parsedData = log.data ? (() => { try { return JSON.parse(log.data) } catch { return log.data } })() : null

  return (
    <div
      className="rounded-xl p-3 space-y-1"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="flex items-center gap-2">
        <span
          className="text-xs font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wide shrink-0"
          style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
        >
          {log.level}
        </span>
        <span className="text-xs font-semibold shrink-0" style={{ color: '#52525b' }}>
          [{log.category}]
        </span>
        <span className="text-xs flex-1 truncate" style={{ color: '#d4d4d8' }}>{log.message}</span>
        {parsedData && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-xs shrink-0 px-1.5 py-0.5 rounded-md transition-colors"
            style={{ color: '#52525b', background: 'rgba(255,255,255,0.05)' }}
          >
            {expanded ? '▲' : '▼'}
          </button>
        )}
      </div>
      <div className="text-xs" style={{ color: '#3f3f46' }}>{formatTime(log.timestamp)}</div>
      {expanded && parsedData && (
        <pre
          className="text-xs rounded-lg p-2 overflow-x-auto mt-1"
          style={{ background: 'rgba(0,0,0,0.3)', color: '#a78bfa', fontSize: 10 }}
        >
          {JSON.stringify(parsedData, null, 2)}
        </pre>
      )}
    </div>
  )
}

export default function LogViewer({ onBack }) {
  const [levelFilter, setLevelFilter] = useState('all')

  const logs = useLiveQuery(
    () => db.logs.orderBy('timestamp').reverse().limit(200).toArray(),
    []
  )

  const filtered = logs?.filter(l => levelFilter === 'all' || l.level === levelFilter) ?? []

  const counts = logs?.reduce((acc, l) => {
    acc[l.level] = (acc[l.level] ?? 0) + 1
    return acc
  }, {}) ?? {}

  const handleClear = async () => {
    await db.logs.clear()
  }

  const FILTERS = ['all', 'error', 'warn', 'info', 'debug']

  return (
    <div className="p-4 pb-8 space-y-4">
      <div style={{ height: 'env(safe-area-inset-top, 44px)', minHeight: 44 }} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center justify-center w-9 h-9 rounded-xl transition-opacity active:opacity-60"
            style={{ background: 'rgba(255,255,255,0.06)', color: '#a78bfa' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div>
            <div className="font-bold text-lg leading-tight" style={{ color: '#f8f8ff' }}>Dev Logs</div>
            <div className="text-xs" style={{ color: '#52525b' }}>{logs?.length ?? 0} entries stored</div>
          </div>
        </div>
        {logs && logs.length > 0 && (
          <button
            onClick={handleClear}
            className="text-xs px-3 py-1.5 rounded-xl transition-colors"
            style={{ background: 'rgba(244,63,94,0.10)', color: '#f43f5e', border: '1px solid rgba(244,63,94,0.2)' }}
          >
            Clear all
          </button>
        )}
      </div>

      {/* Level summary chips */}
      {logs && logs.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {(['error', 'warn', 'info', 'debug']).filter(l => counts[l]).map(l => {
            const s = LEVEL_STYLES[l]
            return (
              <div key={l} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                style={{ background: s.bg, color: s.color }}>
                <span className="font-bold uppercase">{l}</span>
                <span>{counts[l]}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Level filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setLevelFilter(f)}
            className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all"
            style={levelFilter === f
              ? { background: 'linear-gradient(135deg,#7c3aed,#9333ea)', color: '#fff' }
              : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#71717a' }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Log list */}
      {!logs ? (
        <div className="flex justify-center py-8">
          <div className="w-5 h-5 rounded-full border-2 animate-spin"
            style={{ borderColor: 'rgba(139,92,246,0.3)', borderTopColor: '#8b5cf6' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl p-8 text-center"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.07)' }}>
          <div className="text-3xl mb-3">📋</div>
          <div className="font-semibold text-sm" style={{ color: '#d4d4d8' }}>No logs yet</div>
          <div className="text-xs mt-1" style={{ color: '#52525b' }}>
            Errors, warnings, and events will appear here
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(log => <LogEntry key={log.id} log={log} />)}
        </div>
      )}
    </div>
  )
}
