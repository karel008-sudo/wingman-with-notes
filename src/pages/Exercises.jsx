import { useState } from 'react'
import { db } from '../db'
import { useLiveQuery } from 'dexie-react-hooks'

const CATEGORIES = ['Chest', 'Back', 'Shoulders', 'Legs', 'Biceps', 'Triceps', 'Abs', 'Cardio', 'Other']

const CATEGORY_ICONS = {
  Chest:     '🫷',
  Back:      '🏹',
  Shoulders: '🏋️',
  Legs:      '🦵',
  Biceps:    '💪',
  Triceps:   '🦾',
  Abs:       '🔥',
  Cardio:    '❤️',
  Other:     '⚡',
}

const CATEGORY_COLORS = {
  Chest:     { bg: 'rgba(239,68,68,0.12)',  text: '#fca5a5' },
  Back:      { bg: 'rgba(34,211,238,0.10)', text: '#22d3ee' },
  Shoulders: { bg: 'rgba(251,146,60,0.12)', text: '#fdba74' },
  Legs:      { bg: 'rgba(16,185,129,0.10)', text: '#6ee7b7' },
  Biceps:    { bg: 'rgba(139,92,246,0.12)', text: '#c4b5fd' },
  Triceps:   { bg: 'rgba(244,63,94,0.10)',  text: '#fda4af' },
  Abs:       { bg: 'rgba(250,204,21,0.10)', text: '#fde68a' },
  Cardio:    { bg: 'rgba(34,211,238,0.08)', text: '#67e8f9' },
  Other:     { bg: 'rgba(113,113,122,0.15)', text: '#a1a1aa' },
}

export default function Exercises({ onOpenLogs }) {
  const exercises = useLiveQuery(() => db.exercises.orderBy('name').toArray(), [], [])
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0])
  const [unilateral, setUnilateral] = useState(false)
  const [editId, setEditId] = useState(null)
  const [nameError, setNameError] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const reset = () => {
    setName('')
    setCategory(CATEGORIES[0])
    setUnilateral(false)
    setEditId(null)
    setShowForm(false)
    setNameError(false)
  }

  const handleSave = async () => {
    if (!name.trim()) {
      setNameError(true)
      return
    }
    setNameError(false)
    if (editId) {
      await db.exercises.update(editId, { name: name.trim(), category, unilateral })
    } else {
      await db.exercises.add({ name: name.trim(), category, unilateral })
    }
    reset()
  }

  const startEdit = (e) => {
    setEditId(e.id)
    setName(e.name)
    setCategory(e.category ?? CATEGORIES[0])
    setUnilateral(e.unilateral ?? false)
    setShowForm(true)
    setNameError(false)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await db.exercises.delete(deleteTarget.id)
    setDeleteTarget(null)
  }

  const filtered = search.trim()
    ? exercises?.filter(e => e.name.toLowerCase().includes(search.toLowerCase()))
    : exercises

  const grouped = filtered?.reduce((acc, e) => {
    const cat = e.category ?? 'Other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(e)
    return acc
  }, {})

  return (
    <div className="p-4 space-y-4 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <h1 className="text-xl font-bold tracking-tight" style={{ color: '#f8f8ff' }}>Exercises</h1>
        <button
          onClick={() => { reset(); setShowForm(true) }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-all"
          style={{
            background: 'rgba(139,92,246,0.12)',
            border: '1px solid rgba(139,92,246,0.25)',
            color: '#a78bfa',
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="w-3.5 h-3.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add
        </button>
      </div>

      {/* Search */}
      {!showForm && exercises.length > 0 && (
        <div className="relative">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: '#3f3f46' }}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search exercises..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-xl pl-9 pr-8 py-2.5 text-sm outline-none transition-all"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#f8f8ff' }}
            onFocus={e => { e.target.style.borderColor = 'rgba(139,92,246,0.5)'; e.target.style.boxShadow = '0 0 0 2px rgba(139,92,246,0.2)' }}
            onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.07)'; e.target.style.boxShadow = 'none' }}
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-lg leading-none"
              style={{ color: '#52525b' }}>×</button>
          )}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div
          className="rounded-2xl p-4 space-y-3"
          style={{
            background: '#1a1a26',
            border: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <div className="text-base font-bold" style={{ color: '#f8f8ff' }}>
            {editId ? 'Edit exercise' : 'New exercise'}
          </div>

          <input
            autoFocus
            type="text"
            placeholder="Exercise name"
            value={name}
            onChange={e => { setName(e.target.value); if (nameError) setNameError(false) }}
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-all"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: nameError ? '1px solid rgba(244,63,94,0.7)' : '1px solid rgba(255,255,255,0.10)',
              color: '#f8f8ff',
              boxShadow: nameError ? '0 0 0 2px rgba(244,63,94,0.25)' : 'none',
            }}
            onFocus={e => {
              e.target.style.boxShadow = nameError ? '0 0 0 2px rgba(244,63,94,0.25)' : '0 0 0 2px rgba(139,92,246,0.4)'
              e.target.style.borderColor = nameError ? 'rgba(244,63,94,0.7)' : 'rgba(139,92,246,0.5)'
            }}
            onBlur={e => {
              e.target.style.boxShadow = nameError ? '0 0 0 2px rgba(244,63,94,0.25)' : 'none'
              e.target.style.borderColor = nameError ? 'rgba(244,63,94,0.7)' : 'rgba(255,255,255,0.10)'
            }}
          />
          {nameError && (
            <div className="text-xs mt-1" style={{ color: '#f43f5e' }}>Exercise name is required</div>
          )}

          <div className="relative">
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none appearance-none cursor-pointer transition-all"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.10)',
                color: '#f8f8ff',
              }}
              onFocus={e => {
                e.target.style.boxShadow = '0 0 0 2px rgba(139,92,246,0.4)'
                e.target.style.borderColor = 'rgba(139,92,246,0.5)'
              }}
              onBlur={e => {
                e.target.style.boxShadow = 'none'
                e.target.style.borderColor = 'rgba(255,255,255,0.10)'
              }}
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#52525b' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>

          {/* iOS-style toggle for unilateral */}
          <button
            type="button"
            onClick={() => setUnilateral(u => !u)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all"
            style={{
              background: unilateral ? 'rgba(139,92,246,0.12)' : 'rgba(255,255,255,0.04)',
              border: unilateral ? '1px solid rgba(139,92,246,0.3)' : '1px solid rgba(255,255,255,0.07)',
            }}
          >
            <div className="text-left">
              <div className="text-sm font-medium" style={{ color: unilateral ? '#c4b5fd' : '#d4d4d8' }}>
                Unilateral exercise
              </div>
              <div className="text-xs mt-0.5" style={{ color: '#52525b' }}>
                {unilateral
                  ? 'Reps × 2 for volume calculation (left + right)'
                  : 'Both sides simultaneously (default)'}
              </div>
            </div>
            {/* Toggle pill */}
            <div
              className="relative shrink-0 ml-3 transition-colors duration-200"
              style={{
                width: 44,
                height: 26,
                borderRadius: 13,
                background: unilateral ? '#8b5cf6' : 'rgba(255,255,255,0.12)',
              }}
            >
              <div
                className="absolute top-0.5 transition-transform duration-200"
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: '#fff',
                  left: 2,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                  transform: unilateral ? 'translateX(18px)' : 'translateX(0px)',
                }}
              />
            </div>
          </button>

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              className="flex-1 py-3 rounded-xl text-sm font-bold transition-all active:scale-95 btn-primary"
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #9333ea)',
                color: '#fff',
              }}
            >
              {editId ? 'Save changes' : 'Add exercise'}
            </button>
            <button
              onClick={reset}
              className="flex-1 py-3 rounded-xl text-sm font-semibold transition-colors"
              style={{ background: 'rgba(255,255,255,0.06)', color: '#71717a', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* No results */}
      {search.trim() && filtered?.length === 0 && (
        <div className="rounded-2xl p-8 text-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.07)' }}>
          <div className="font-semibold text-sm" style={{ color: '#d4d4d8' }}>No exercises found</div>
          <div className="text-xs mt-1" style={{ color: '#52525b' }}>Try a different search term</div>
        </div>
      )}

      {/* Empty state */}
      {exercises.length === 0 && !showForm && (
        <div className="rounded-2xl p-10 text-center fade-in"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}>
          <div className="text-4xl mb-3">🏋️</div>
          <div className="font-semibold" style={{ color: '#d4d4d8' }}>No exercises yet</div>
          <div className="text-sm mt-1" style={{ color: '#52525b' }}>Add your first exercise to get started</div>
        </div>
      )}

      {/* Exercise list grouped by category */}
      {grouped && Object.entries(grouped).map(([cat, list]) => {
        const colors = CATEGORY_COLORS[cat] ?? CATEGORY_COLORS['Other']
        return (
          <div key={cat}>
            <div className="flex items-center gap-2 mb-2">
              <span
                className="text-xs px-2 py-0.5 rounded-full font-semibold"
                style={{ background: colors.bg, color: colors.text }}
              >
                {cat}
              </span>
              <span className="text-xs" style={{ color: '#3f3f46' }}>{list.length}</span>
            </div>
            <div className="space-y-1">
              {list.map(e => (
                <div
                  key={e.id}
                  className="flex items-center rounded-xl px-4 py-3 gap-2"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <span style={{ fontSize: 16 }}>{CATEGORY_ICONS[e.category] ?? '⚡'}</span>
                  <span className="flex-1 text-sm" style={{ color: '#d4d4d8' }}>{e.name}</span>
                  {e.unilateral && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa' }}
                    >
                      1 side
                    </span>
                  )}
                  <button
                    onClick={() => startEdit(e)}
                    className="text-xs px-2 py-1.5 rounded-lg transition-colors font-medium"
                    style={{ color: '#52525b', minHeight: 36 }}
                    onMouseEnter={el => el.currentTarget.style.color = '#f8f8ff'}
                    onMouseLeave={el => el.currentTarget.style.color = '#52525b'}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteTarget(e)}
                    className="flex items-center justify-center transition-colors"
                    style={{ color: '#3f3f46', minWidth: 36, minHeight: 36 }}
                    onMouseEnter={el => el.currentTarget.style.color = '#f43f5e'}
                    onMouseLeave={el => el.currentTarget.style.color = '#3f3f46'}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                      <path d="M10 11v6M14 11v6" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* Dev tools */}
      <div className="pt-2 pb-2 flex items-center justify-center gap-4">
        <button
          onClick={onOpenLogs}
          className="text-xs transition-colors"
          style={{ color: '#3f3f46' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#52525b' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#3f3f46' }}
        >
          Dev Logs
        </button>
        <span style={{ color: '#27272a' }}>·</span>
        <button
          onClick={async () => {
            if (!('serviceWorker' in navigator)) return
            const reg = await navigator.serviceWorker.getRegistration()
            if (reg) {
              await reg.update()
              if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' })
            }
            window.location.reload()
          }}
          className="text-xs transition-colors"
          style={{ color: '#3f3f46' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#52525b' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#3f3f46' }}
        >
          Force Update
        </button>
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="w-full max-w-lg rounded-t-3xl p-6 space-y-4"
            style={{ background: '#1a1a26', border: '1px solid rgba(255,255,255,0.10)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="text-center">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
                style={{ background: 'rgba(244,63,94,0.15)', border: '1px solid rgba(244,63,94,0.3)' }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                </svg>
              </div>
              <div className="font-bold text-lg" style={{ color: '#f8f8ff' }}>Delete exercise?</div>
              <div className="text-sm mt-1" style={{ color: '#71717a' }}>{deleteTarget.name}</div>
              <div className="text-sm mt-1" style={{ color: '#52525b' }}>This action cannot be undone.</div>
            </div>
            <button
              onClick={handleDelete}
              className="w-full py-3.5 rounded-2xl font-bold text-base transition-all"
              style={{ background: 'linear-gradient(135deg, #dc2626, #f43f5e)', color: '#fff', minHeight: 44 }}
            >
              Delete exercise
            </button>
            <button
              onClick={() => setDeleteTarget(null)}
              className="w-full py-3.5 rounded-2xl font-semibold text-base transition-all"
              style={{ background: 'rgba(255,255,255,0.06)', color: '#a1a1aa', minHeight: 44 }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
