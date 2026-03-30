import { useState } from 'react'
import { db } from '../db'
import { useLiveQuery } from 'dexie-react-hooks'
import { haptic } from '../haptic'

const today = () => new Date().toISOString().slice(0, 10)

const CATEGORIES = ['Legs', 'Back', 'Chest', 'Shoulders', 'Biceps', 'Triceps', 'Abs', 'Cardio', 'Other']

const CATEGORY_COLORS = {
  Legs:      { bg: 'rgba(16,185,129,0.12)',  text: '#6ee7b7' },
  Back:      { bg: 'rgba(34,211,238,0.12)',  text: '#22d3ee' },
  Chest:     { bg: 'rgba(239,68,68,0.15)',   text: '#fca5a5' },
  Shoulders: { bg: 'rgba(251,146,60,0.15)',  text: '#fdba74' },
  Biceps:    { bg: 'rgba(139,92,246,0.15)',  text: '#c4b5fd' },
  Triceps:   { bg: 'rgba(244,63,94,0.12)',   text: '#fda4af' },
  Abs:       { bg: 'rgba(250,204,21,0.12)',  text: '#fde68a' },
  Cardio:    { bg: 'rgba(34,211,238,0.10)',  text: '#67e8f9' },
  Other:     { bg: 'rgba(113,113,122,0.2)',  text: '#a1a1aa' },
}

function formatDate(str) {
  if (!str) return '—'
  const d = new Date(str + 'T12:00:00')
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDateShort(str) {
  if (!str) return '—'
  const d = new Date(str + 'T12:00:00')
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
}

function CategoryBadge({ category }) {
  const colors = CATEGORY_COLORS[category] ?? CATEGORY_COLORS['Other']
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ background: colors.bg, color: colors.text }}
    >
      {category}
    </span>
  )
}

const inputStyle = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.10)',
  color: '#f8f8ff',
  fontSize: 16,
}

function inputFocus(e) {
  e.target.style.boxShadow = '0 0 0 2px rgba(139,92,246,0.4)'
  e.target.style.borderColor = 'rgba(139,92,246,0.5)'
}
function inputBlur(e) {
  e.target.style.boxShadow = 'none'
  e.target.style.borderColor = 'rgba(255,255,255,0.10)'
}

const emptyForm = () => ({
  exerciseName: '',
  category: 'Legs',
  weight: '',
  achievedAt: today(),
  note: '',
})

export default function AbsolutePRs() {
  const allPRs = useLiveQuery(() =>
    db.absolutePRs.toArray().then(rows =>
      rows.sort((a, b) => {
        if (b.weight !== a.weight) return b.weight - a.weight
        return a.exerciseName.localeCompare(b.exerciseName)
      })
    )
  )

  const [categoryFilter, setCategoryFilter] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingPR, setEditingPR] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [conflictState, setConflictState] = useState(null)
  const [recentlyAddedId, setRecentlyAddedId] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  const [formData, setFormData] = useState(emptyForm())

  // Derived data
  const prs = allPRs ?? []
  const presentCategories = [...new Set(prs.map(p => p.category))].filter(Boolean)
  const filtered = categoryFilter ? prs.filter(p => p.category === categoryFilter) : prs
  const maxWeight = prs.length ? Math.max(...prs.map(p => p.weight)) : null
  const latestDate = prs.length
    ? prs.reduce((best, p) => (!best || p.achievedAt > best ? p.achievedAt : best), null)
    : null
  const heaviestId = prs.find(p => p.weight === maxWeight)?.id

  function openAddForm() {
    setEditingPR(null)
    setFormData(emptyForm())
    setFormOpen(true)
  }

  function startEdit(pr) {
    setEditingPR(pr)
    setFormData({
      exerciseName: pr.exerciseName,
      category: pr.category,
      weight: String(pr.weight),
      achievedAt: pr.achievedAt,
      note: pr.note ?? '',
    })
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setEditingPR(null)
    setFormData(emptyForm())
  }

  function confirmDelete(pr) {
    setDeleteTarget(pr)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    await db.absolutePRs.delete(deleteTarget.id)
    haptic.warning()
    setDeleteTarget(null)
  }

  function showSuccess(msg, id) {
    setSuccessMsg(msg)
    setRecentlyAddedId(id)
    setTimeout(() => setSuccessMsg(null), 3000)
    setTimeout(() => setRecentlyAddedId(null), 3000)
  }

  async function handleSave() {
    const name = formData.exerciseName.trim()
    const weight = parseFloat(formData.weight)
    if (!name || isNaN(weight) || weight <= 0) return

    const now = new Date().toISOString()

    if (editingPR) {
      // Edit mode — just update
      await db.absolutePRs.update(editingPR.id, {
        exerciseName: name,
        category: formData.category,
        weight,
        unit: 'kg',
        achievedAt: formData.achievedAt,
        note: formData.note.trim(),
        updatedAt: now,
      })
      closeForm()
      haptic.success()
      showSuccess('PR updated!', editingPR.id)
      return
    }

    // New PR — check for duplicates by exerciseName
    const existing = await db.absolutePRs
      .where('exerciseName')
      .equalsIgnoreCase(name)
      .first()

    if (existing) {
      if (weight > existing.weight) {
        // Auto-update: new weight is better
        await db.absolutePRs.update(existing.id, {
          weight,
          category: formData.category,
          achievedAt: formData.achievedAt,
          note: formData.note.trim(),
          updatedAt: now,
        })
        closeForm()
        haptic.pr()
        showSuccess('PR updated — new best!', existing.id)
      } else {
        // Conflict: new weight <= existing — show warning
        setConflictState({
          existing,
          incoming: {
            exerciseName: name,
            category: formData.category,
            weight,
            unit: 'kg',
            achievedAt: formData.achievedAt,
            note: formData.note.trim(),
            createdAt: now,
            updatedAt: now,
          },
        })
      }
      return
    }

    // No conflict — insert fresh
    const id = await db.absolutePRs.add({
      exerciseName: name,
      category: formData.category,
      weight,
      unit: 'kg',
      achievedAt: formData.achievedAt,
      note: formData.note.trim(),
      createdAt: now,
      updatedAt: now,
    })
    closeForm()
    haptic.success()
    showSuccess('PR added!', id)
  }

  async function handleConflictOverride() {
    if (!conflictState) return
    const now = new Date().toISOString()
    const id = await db.absolutePRs.add({
      ...conflictState.incoming,
      createdAt: now,
      updatedAt: now,
    })
    setConflictState(null)
    closeForm()
    haptic.success()
    showSuccess('PR saved!', id)
  }

  function dismissConflict() {
    setConflictState(null)
  }

  const setField = (field) => (e) =>
    setFormData(prev => ({ ...prev, [field]: e.target.value }))

  return (
    <div className="p-4 pb-8 space-y-4">

      {/* Header */}
      <div className="pt-1 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: '#f8f8ff' }}>
            Personal Records
          </h1>
          <div className="text-sm mt-0.5" style={{ color: '#71717a' }}>
            Your all-time best lifts
          </div>
        </div>
        {prs.length > 0 && (
          <button
            onClick={openAddForm}
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
        )}
      </div>

      {/* Success toast */}
      {successMsg && (
        <div
          className="toast-enter rounded-2xl px-4 py-3 text-sm font-semibold flex items-center gap-2"
          style={{
            background: 'rgba(16,185,129,0.15)',
            border: '1px solid rgba(16,185,129,0.3)',
            color: '#6ee7b7',
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {successMsg}
        </div>
      )}

      {/* Stats summary */}
      {prs.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div
            className="rounded-xl px-3 py-2 text-center"
            style={{ background: 'rgba(139,92,246,0.10)', border: '1px solid rgba(139,92,246,0.18)' }}
          >
            <div className="text-xs" style={{ color: '#71717a' }}>Total</div>
            <div className="text-sm font-bold" style={{ color: '#c4b5fd' }}>{prs.length}</div>
          </div>
          <div
            className="rounded-xl px-3 py-2 text-center"
            style={{ background: 'rgba(250,204,21,0.08)', border: '1px solid rgba(250,204,21,0.18)' }}
          >
            <div className="text-xs" style={{ color: '#71717a' }}>Heaviest</div>
            <div className="text-sm font-bold" style={{ color: '#fde68a' }}>
              {maxWeight != null ? `${maxWeight} kg` : '—'}
            </div>
          </div>
          <div
            className="rounded-xl px-3 py-2 text-center"
            style={{ background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.15)' }}
          >
            <div className="text-xs" style={{ color: '#71717a' }}>Latest</div>
            <div className="text-sm font-bold" style={{ color: '#22d3ee' }}>
              {latestDate ? formatDateShort(latestDate) : '—'}
            </div>
          </div>
        </div>
      )}

      {/* Category filter chips */}
      {presentCategories.length > 0 && (
        <div
          className="flex gap-2 overflow-x-auto pb-1"
          style={{ scrollbarWidth: 'none' }}
        >
          <button
            onClick={() => setCategoryFilter(null)}
            className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
            style={{
              background: categoryFilter === null ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.06)',
              border: categoryFilter === null ? '1px solid rgba(139,92,246,0.5)' : '1px solid rgba(255,255,255,0.08)',
              color: categoryFilter === null ? '#c4b5fd' : '#71717a',
              minHeight: 36,
            }}
          >
            All
          </button>
          {presentCategories.map(cat => {
            const active = categoryFilter === cat
            const colors = CATEGORY_COLORS[cat] ?? CATEGORY_COLORS['Other']
            return (
              <button
                key={cat}
                onClick={() => setCategoryFilter(active ? null : cat)}
                className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                style={{
                  background: active ? colors.bg : 'rgba(255,255,255,0.04)',
                  border: active ? `1px solid ${colors.text}44` : '1px solid rgba(255,255,255,0.07)',
                  color: active ? colors.text : '#71717a',
                  minHeight: 36,
                }}
              >
                {cat}
              </button>
            )
          })}
        </div>
      )}

      {/* PR list or empty state */}
      {prs.length === 0 ? (
        <div className="rounded-2xl p-10 text-center fade-in"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}>
          <div className="text-5xl mb-4">🏆</div>
          <div className="font-semibold text-lg" style={{ color: '#d4d4d8' }}>
            No records yet
          </div>
          <div className="text-sm mt-1" style={{ color: '#52525b' }}>
            Track your all-time best lifts and watch them grow
          </div>
          <button
            onClick={openAddForm}
            className="mt-6 px-6 py-3.5 rounded-2xl font-bold transition-all active:scale-95 btn-primary"
            style={{
              background: 'linear-gradient(135deg,#7c3aed,#9333ea)',
              color: '#fff',
              minHeight: 48,
            }}
          >
            Add your first PR
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(pr => {
            const isHeaviest = pr.id === heaviestId
            const isRecent = pr.id === recentlyAddedId
            return (
              <div
                key={pr.id}
                className="rounded-2xl p-4"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: isRecent
                    ? '1px solid rgba(139,92,246,0.5)'
                    : '1px solid rgba(255,255,255,0.07)',
                  transition: 'border-color 0.3s',
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isHeaviest && <span>🏆</span>}
                      <span className="font-semibold" style={{ color: '#f8f8ff' }}>
                        {pr.exerciseName}
                      </span>
                      <CategoryBadge category={pr.category} />
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: '#52525b' }}>
                      {formatDate(pr.achievedAt)}
                    </div>
                    {pr.note ? (
                      <div className="text-xs mt-1 italic" style={{ color: '#71717a' }}>
                        {pr.note}
                      </div>
                    ) : null}
                  </div>
                  <div className="text-right ml-3 shrink-0">
                    <div className="text-3xl font-bold" style={{ color: '#c084fc' }}>
                      {pr.weight}
                    </div>
                    <div className="text-xs" style={{ color: '#52525b' }}>kg</div>
                  </div>
                </div>
                <div
                  className="flex gap-3 mt-3 pt-3"
                  style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <button
                    onClick={() => startEdit(pr)}
                    className="text-sm transition-colors"
                    style={{ color: '#71717a', minHeight: 44, paddingRight: 8 }}
                    onMouseEnter={e => e.currentTarget.style.color = '#f8f8ff'}
                    onMouseLeave={e => e.currentTarget.style.color = '#71717a'}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => confirmDelete(pr)}
                    className="text-sm transition-colors"
                    style={{ color: '#52525b', minHeight: 44 }}
                    onMouseEnter={e => e.currentTarget.style.color = '#f43f5e'}
                    onMouseLeave={e => e.currentTarget.style.color = '#52525b'}
                  >
                    Delete
                  </button>
                </div>
              </div>
            )
          })}

          {/* Add PR button at bottom of list */}
          <button
            onClick={openAddForm}
            className="w-full py-3.5 rounded-2xl font-bold text-sm transition-all active:scale-95 btn-primary"
            style={{
              background: 'linear-gradient(135deg,#7c3aed,#9333ea)',
              color: '#fff',
              minHeight: 48,
            }}
          >
            Add PR
          </button>
        </div>
      )}

      {/* ── Add / Edit Form (bottom sheet) ────────────────────────────────── */}
      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={closeForm}
        >
          <div
            className="w-full max-w-lg rounded-t-3xl p-6 space-y-4"
            style={{ background: '#1a1a26', border: '1px solid rgba(255,255,255,0.10)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="text-base font-bold" style={{ color: '#f8f8ff' }}>
              {editingPR ? 'Edit PR' : 'Add Absolute PR'}
            </div>

            {/* Exercise name */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#71717a' }}>
                Exercise name
              </label>
              <input
                type="text"
                placeholder="e.g. Squat, Deadlift…"
                value={formData.exerciseName}
                onChange={setField('exerciseName')}
                autoFocus
                className="w-full rounded-xl px-3 py-2.5 outline-none transition-all"
                style={inputStyle}
                onFocus={inputFocus}
                onBlur={inputBlur}
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#71717a' }}>
                Category
              </label>
              <div className="relative">
                <select
                  value={formData.category}
                  onChange={setField('category')}
                  className="w-full rounded-xl px-3 py-2.5 outline-none appearance-none cursor-pointer transition-all"
                  style={inputStyle}
                  onFocus={inputFocus}
                  onBlur={inputBlur}
                >
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <div
                  className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: '#52525b' }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Weight + Date (2 columns) */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#71717a' }}>
                  Weight (kg)
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="0"
                  min="0"
                  step="0.5"
                  value={formData.weight}
                  onChange={setField('weight')}
                  className="w-full rounded-xl px-3 py-2.5 outline-none transition-all"
                  style={inputStyle}
                  onFocus={inputFocus}
                  onBlur={inputBlur}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#71717a' }}>
                  Date achieved
                </label>
                <input
                  type="date"
                  value={formData.achievedAt}
                  onChange={setField('achievedAt')}
                  className="w-full rounded-xl px-3 py-2.5 outline-none transition-all"
                  style={{ ...inputStyle, colorScheme: 'dark' }}
                  onFocus={inputFocus}
                  onBlur={inputBlur}
                />
              </div>
            </div>

            {/* Note */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#71717a' }}>
                Note (optional)
              </label>
              <input
                type="text"
                placeholder="e.g. competition, belt, sleeves…"
                value={formData.note}
                onChange={setField('note')}
                className="w-full rounded-xl px-3 py-2.5 outline-none transition-all"
                style={inputStyle}
                onFocus={inputFocus}
                onBlur={inputBlur}
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSave}
                className="flex-1 py-3 rounded-2xl font-bold text-sm transition-all active:scale-95 btn-primary"
                style={{
                  background: 'linear-gradient(135deg, #7c3aed, #9333ea)',
                  color: '#fff',
                  minHeight: 48,
                }}
              >
                {editingPR ? 'Save changes' : 'Add PR'}
              </button>
              <button
                onClick={closeForm}
                className="flex-1 py-3 rounded-2xl text-sm font-semibold transition-all"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  color: '#71717a',
                  minHeight: 48,
                  border: '1px solid rgba(255,255,255,0.07)',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Conflict modal (lower weight warning) ────────────────────────── */}
      {conflictState && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
          onClick={dismissConflict}
        >
          <div
            className="w-full max-w-sm rounded-3xl p-6 space-y-4"
            style={{ background: '#1a1a26', border: '1px solid rgba(255,255,255,0.12)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="text-center">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
                style={{
                  background: 'rgba(245,158,11,0.15)',
                  border: '1px solid rgba(245,158,11,0.3)',
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div className="font-bold text-base" style={{ color: '#f8f8ff' }}>
                Not a new best
              </div>
              <div className="text-sm mt-1" style={{ color: '#71717a' }}>
                {conflictState.existing.exerciseName}
              </div>
              <div
                className="mt-3 rounded-xl px-4 py-2.5 text-sm"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <div className="flex items-center justify-between">
                  <span style={{ color: '#71717a' }}>Current best</span>
                  <span className="font-bold text-base" style={{ color: '#c084fc' }}>
                    {conflictState.existing.weight} kg
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span style={{ color: '#71717a' }}>Your entry</span>
                  <span className="font-bold text-base" style={{ color: '#52525b' }}>
                    {conflictState.incoming.weight} kg
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={dismissConflict}
              className="w-full py-3 rounded-2xl font-bold text-sm transition-all"
              style={{
                background: 'rgba(139,92,246,0.15)',
                border: '1px solid rgba(139,92,246,0.3)',
                color: '#c4b5fd',
                minHeight: 44,
              }}
            >
              Keep current best ({conflictState.existing.weight} kg)
            </button>
            <button
              onClick={handleConflictOverride}
              className="w-full py-3 rounded-2xl text-sm font-semibold transition-all"
              style={{
                background: 'rgba(255,255,255,0.05)',
                color: '#71717a',
                minHeight: 44,
              }}
            >
              Override anyway
            </button>
          </div>
        </div>
      )}

      {/* ── Delete confirmation modal ─────────────────────────────────────── */}
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
                style={{
                  background: 'rgba(244,63,94,0.15)',
                  border: '1px solid rgba(244,63,94,0.3)',
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                </svg>
              </div>
              <div className="font-bold text-lg" style={{ color: '#f8f8ff' }}>Delete PR?</div>
              <div className="text-sm mt-1" style={{ color: '#71717a' }}>
                {deleteTarget.exerciseName} · {deleteTarget.weight} kg
              </div>
              <div className="text-sm mt-1" style={{ color: '#52525b' }}>
                This action cannot be undone.
              </div>
            </div>
            <button
              onClick={handleDelete}
              className="w-full py-3.5 rounded-2xl font-bold text-base transition-all"
              style={{
                background: 'linear-gradient(135deg, #dc2626, #f43f5e)',
                color: '#fff',
                minHeight: 44,
              }}
            >
              Delete
            </button>
            <button
              onClick={() => setDeleteTarget(null)}
              className="w-full py-3.5 rounded-2xl font-semibold text-base transition-all"
              style={{
                background: 'rgba(255,255,255,0.06)',
                color: '#a1a1aa',
                minHeight: 44,
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
