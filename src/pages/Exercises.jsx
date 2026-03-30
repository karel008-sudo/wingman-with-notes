import { useState } from 'react'
import { db } from '../db'
import { useLiveQuery } from 'dexie-react-hooks'

const CATEGORIES = ['Chest', 'Back', 'Shoulders', 'Legs', 'Biceps', 'Triceps', 'Abs', 'Cardio', 'Other']

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

export default function Exercises() {
  const exercises = useLiveQuery(() => db.exercises.orderBy('name').toArray())
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0])
  const [unilateral, setUnilateral] = useState(false)
  const [editId, setEditId] = useState(null)

  const reset = () => {
    setName('')
    setCategory(CATEGORIES[0])
    setUnilateral(false)
    setEditId(null)
    setShowForm(false)
  }

  const handleSave = async () => {
    if (!name.trim()) return
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
  }

  const handleDelete = async (id) => {
    await db.exercises.delete(id)
  }

  const grouped = exercises?.reduce((acc, e) => {
    const cat = e.category ?? 'Other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(e)
    return acc
  }, {})

  if (!exercises) {
    return (
      <div className="p-4 pt-6 flex flex-col items-center justify-center gap-2" style={{ minHeight: 200 }}>
        <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'rgba(139,92,246,0.3)', borderTopColor: '#8b5cf6' }} />
        <span className="text-xs" style={{ color: '#3f3f46' }}>Loading...</span>
      </div>
    )
  }

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
            onChange={e => setName(e.target.value)}
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-all"
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
          />

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
                    onClick={() => handleDelete(e.id)}
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
    </div>
  )
}
