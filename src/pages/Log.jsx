import { useState, useRef } from 'react'
import { db } from '../db'
import { useLiveQuery } from 'dexie-react-hooks'
import { haptic } from '../haptic'
import { logger } from '../logger'
import { cloudBackup } from '../cloudSync'

const today = () => new Date().toISOString().slice(0, 10)
const DEFAULT_REPS = 10
const DEFAULT_SETS = 4

const emptySet = (n) => ({ setNumber: n, weight: '', reps: DEFAULT_REPS })
const initialSets = () => Array.from({ length: DEFAULT_SETS }, (_, i) => emptySet(i + 1))

function formatDatePill(str) {
  const d = new Date(str + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })
}

const CATEGORY_COLORS = {
  Chest:     { bg: 'rgba(239,68,68,0.15)',  text: '#fca5a5' },
  Back:      { bg: 'rgba(34,211,238,0.12)', text: '#22d3ee' },
  Shoulders: { bg: 'rgba(251,146,60,0.15)', text: '#fdba74' },
  Legs:      { bg: 'rgba(16,185,129,0.12)', text: '#6ee7b7' },
  Biceps:    { bg: 'rgba(139,92,246,0.15)', text: '#c4b5fd' },
  Triceps:   { bg: 'rgba(244,63,94,0.12)',  text: '#fda4af' },
  Abs:       { bg: 'rgba(250,204,21,0.12)', text: '#fde68a' },
  Cardio:    { bg: 'rgba(34,211,238,0.10)', text: '#67e8f9' },
  Other:     { bg: 'rgba(113,113,122,0.2)', text: '#a1a1aa' },
}

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

function SetRow({ set, onChange, onDelete, isNew, prThreshold }) {
  const [editingReps, setEditingReps] = useState(false)
  const isPR = parseFloat(set.weight) > prThreshold && prThreshold > 0

  return (
    <div className={`flex items-center gap-2 py-1${isNew ? ' set-enter' : ''}`}>
      <span className="text-xs w-5 text-right shrink-0 font-mono" style={{ color: '#3f3f46' }}>
        {set.setNumber}
      </span>

      <input
        type="number"
        inputMode="decimal"
        placeholder="—"
        value={set.weight}
        onChange={e => onChange({ ...set, weight: e.target.value })}
        className="flex-1 rounded-xl px-3 py-2.5 text-center text-xl font-bold outline-none transition-all"
        style={{
          background: 'rgba(255,255,255,0.06)',
          border: isPR ? '1px solid rgba(245,158,11,0.6)' : '1px solid rgba(255,255,255,0.10)',
          color: '#f8f8ff',
          boxShadow: isPR ? '0 0 0 2px rgba(245,158,11,0.5)' : 'none',
        }}
        onFocus={e => {
          e.target.style.boxShadow = '0 0 0 2px rgba(139,92,246,0.5)'
          e.target.style.borderColor = 'rgba(139,92,246,0.5)'
        }}
        onBlur={e => {
          e.target.style.boxShadow = isPR ? '0 0 0 2px rgba(245,158,11,0.5)' : 'none'
          e.target.style.borderColor = isPR ? 'rgba(245,158,11,0.6)' : 'rgba(255,255,255,0.10)'
        }}
      />
      <span className="text-xs shrink-0" style={{ color: '#52525b' }}>kg</span>
      {isPR && (
        <span className="text-xs font-bold shrink-0" style={{ color: '#f59e0b' }}>PR!</span>
      )}

      <span className="text-xs shrink-0" style={{ color: '#3f3f46' }}>×</span>

      {editingReps ? (
        <input
          autoFocus
          type="number"
          inputMode="numeric"
          value={set.reps}
          onChange={e => onChange({ ...set, reps: Number(e.target.value) || DEFAULT_REPS })}
          onBlur={() => setEditingReps(false)}
          className="w-16 rounded-xl px-2 py-2.5 text-center text-base outline-none"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(139,92,246,0.5)',
            boxShadow: '0 0 0 2px rgba(139,92,246,0.25)',
            color: '#f8f8ff',
          }}
        />
      ) : (
        <button
          onClick={() => setEditingReps(true)}
          className="w-16 py-2.5 rounded-xl text-base text-center transition-colors font-semibold"
          style={
            set.reps !== DEFAULT_REPS
              ? { background: 'rgba(139,92,246,0.2)', color: '#c4b5fd' }
              : { background: 'rgba(255,255,255,0.06)', color: '#d4d4d8' }
          }
        >
          {set.reps}
        </button>
      )}

      <button
        onClick={onDelete}
        className="shrink-0 text-xl leading-none text-center transition-colors flex items-center justify-center rounded-lg"
        style={{ color: '#52525b', width: 32, minHeight: 36 }}
        onMouseEnter={e => e.currentTarget.style.color = '#f43f5e'}
        onMouseLeave={e => e.currentTarget.style.color = '#52525b'}
      >
        ×
      </button>
    </div>
  )
}

function ExerciseBlock({ entry, exercises, onRemove, onSetsChange }) {
  const exercise = exercises?.find(e => e.id === entry.exerciseId)
  const [sets, setSets] = useState(entry.sets)
  const [animatingIdx, setAnimatingIdx] = useState(null)

  const allTimeMax = useLiveQuery(async () => {
    const s = await db.sets.where('exerciseId').equals(entry.exerciseId).toArray()
    return s.length ? Math.max(...s.map(x => x.weight)) : 0
  }, [entry.exerciseId])

  const prevSessions = useLiveQuery(async () => {
    const allSets = await db.sets.where('exerciseId').equals(entry.exerciseId).toArray()
    if (!allSets.length) return []
    const workoutIds = [...new Set(allSets.map(s => s.workoutId))]
    const workouts = await db.workouts.where('id').anyOf(workoutIds).toArray()
    const sorted = workouts.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3)
    return sorted.map(w => ({
      date: w.date,
      sets: allSets.filter(s => s.workoutId === w.id).sort((a, b) => a.setNumber - b.setNumber),
    }))
  }, [entry.exerciseId])

  const update = (updated) => {
    setSets(updated)
    onSetsChange(updated)
  }

  const autofillFromLastSession = () => {
    const last = prevSessions?.[0]
    if (!last?.sets?.length) return
    const filled = last.sets.map((s, i) => ({
      setNumber: i + 1,
      weight: s.weight,
      reps: s.reps,
    }))
    update(filled)
  }

  const updateSet = (idx, s) => update(sets.map((x, i) => (i === idx ? s : x)))
  const removeSet = (idx) => update(
    sets.filter((_, i) => i !== idx).map((s, i) => ({ ...s, setNumber: i + 1 }))
  )
  const addSet = () => {
    const last = sets[sets.length - 1]
    const newIdx = sets.length
    update([...sets, { setNumber: sets.length + 1, weight: last?.weight ?? '', reps: last?.reps ?? DEFAULT_REPS }])
    setAnimatingIdx(newIdx)
    setTimeout(() => setAnimatingIdx(null), 200)
  }

  return (
    <div
      className="rounded-2xl p-4 space-y-1"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-base" style={{ color: '#f8f8ff' }}>
              {exercise?.name ?? '—'}
            </span>
            {exercise?.category && <CategoryBadge category={exercise.category} />}
          </div>

          {/* Last 3 sessions with dates */}
          {prevSessions && prevSessions.length > 0 && (
            <div className="mt-2 space-y-1">
              {prevSessions.map(session => (
                <div key={session.date} className="flex items-baseline gap-2">
                  <span className="text-xs shrink-0 whitespace-nowrap" style={{ color: '#3f3f46' }}>
                    {formatDatePill(session.date)}
                  </span>
                  <span className="text-xs" style={{ color: '#52525b' }}>
                    {session.sets.map(s => s.weight).filter(w => w > 0).join(' · ')} kg
                  </span>
                </div>
              ))}
              <button
                onClick={autofillFromLastSession}
                className="flex items-center gap-1 text-xs mt-1 transition-colors"
                style={{ color: '#8b5cf6' }}
                onMouseEnter={e => e.currentTarget.style.color = '#c084fc'}
                onMouseLeave={e => e.currentTarget.style.color = '#8b5cf6'}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                  <path d="M21 12a9 9 0 11-6.219-8.56" />
                  <polyline points="21 3 21 9 15 9" />
                </svg>
                Auto-fill sets from last session
              </button>
            </div>
          )}
        </div>
        <button
          onClick={onRemove}
          className="text-xs ml-3 shrink-0 transition-colors"
          style={{ color: '#52525b' }}
          onMouseEnter={e => e.currentTarget.style.color = '#f43f5e'}
          onMouseLeave={e => e.currentTarget.style.color = '#52525b'}
        >
          Remove
        </button>
      </div>

      <div
        className="flex items-center gap-2 pb-1.5 mb-1"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <span className="w-5" />
        <span className="flex-1 text-xs text-center" style={{ color: '#3f3f46' }}>WEIGHT</span>
        <span className="w-4" />
        <span className="w-4" />
        <span className="w-16 text-xs text-center" style={{ color: '#3f3f46' }}>REPS</span>
        <span className="w-8" />
      </div>

      {sets.map((set, idx) => (
        <SetRow
          key={idx}
          set={set}
          onChange={s => updateSet(idx, s)}
          onDelete={() => removeSet(idx)}
          isNew={idx === animatingIdx}
          prThreshold={allTimeMax ?? 0}
        />
      ))}

      <button
        onClick={addSet}
        className="w-full text-sm py-2.5 rounded-xl transition-colors mt-1.5 font-medium"
        style={{
          border: '1px dashed rgba(255,255,255,0.12)',
          color: '#52525b',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)'
          e.currentTarget.style.color = '#8b5cf6'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'
          e.currentTarget.style.color = '#52525b'
        }}
      >
        + Add set
      </button>
    </div>
  )
}

export default function Log() {
  const exercises = useLiveQuery(() =>
    db.exercises.orderBy('name').toArray(),
    [],
    []
  )

  const [date, setDate] = useState(today())
  const [note, setNote] = useState('')
  const [entries, setEntries] = useState([])
  const [showPicker, setShowPicker] = useState(false)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [prs, setPrs] = useState(null)
  const dateInputRef = useRef(null)

  const handleCancel = () => {
    setEntries([])
    entrySetsRef.current = {}
    setNote('')
    setSaved(false)
  }

  const entrySetsRef = useRef({})

  const todayDone = useLiveQuery(async () => {
    const workouts = await db.workouts.where('date').equals(date).toArray()
    if (!workouts.length) return null
    const workoutIds = workouts.map(w => w.id)
    const allSets = await db.sets.where('workoutId').anyOf(workoutIds).toArray()
    if (!allSets.length) return null
    const exerciseIds = [...new Set(allSets.map(s => s.exerciseId))]
    const exList = await db.exercises.where('id').anyOf(exerciseIds).toArray()
    const exMap = Object.fromEntries(exList.map(e => [e.id, e]))

    const totalVolume = allSets.reduce((sum, s) => sum + s.weight * s.reps, 0)
    const totalSets   = allSets.length

    // Per-exercise stats
    const exStats = {}
    for (const s of allSets) {
      if (!exStats[s.exerciseId]) exStats[s.exerciseId] = { setCount: 0, maxWeight: 0 }
      exStats[s.exerciseId].setCount++
      if (s.weight > exStats[s.exerciseId].maxWeight) exStats[s.exerciseId].maxWeight = s.weight
    }
    const exercises = exerciseIds
      .map(eid => ({
        name:      exMap[eid]?.name,
        category:  exMap[eid]?.category,
        setCount:  exStats[eid]?.setCount || 0,
        maxWeight: exStats[eid]?.maxWeight || 0,
      }))
      .filter(e => e.name)

    // Category breakdown by set count
    const catSets = {}
    for (const s of allSets) {
      const cat = exMap[s.exerciseId]?.category || 'Other'
      catSets[cat] = (catSets[cat] || 0) + 1
    }

    return { totalVolume, totalSets, exercises, catSets, exerciseNames: exercises.map(e => e.name) }
  }, [date])

  const grouped = exercises?.reduce((acc, e) => {
    const cat = e.category ?? 'Other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(e)
    return acc
  }, {})

  const filtered = !search.trim()
    ? grouped
    : {
        Results: exercises?.filter(e =>
          e.name.toLowerCase().includes(search.toLowerCase())
        ) ?? [],
      }

  const addExercise = (exercise) => {
    const key = `${exercise.id}-${Date.now()}`
    const newEntry = { key, exerciseId: exercise.id, sets: initialSets() }
    entrySetsRef.current[key] = newEntry.sets
    setEntries(prev => [...prev, newEntry])
    setShowPicker(false)
    setSearch('')
  }

  const removeEntry = (key) => {
    delete entrySetsRef.current[key]
    setEntries(prev => prev.filter(e => e.key !== key))
  }

  const handleSave = async () => {
    if (entries.length === 0) return
    setSaving(true)

    // Snapshot historical max weight per exercise BEFORE saving
    const historicalMax = {}
    for (const entry of entries) {
      const prev = await db.sets.where('exerciseId').equals(entry.exerciseId).toArray()
      historicalMax[entry.exerciseId] = prev.length ? Math.max(...prev.map(s => s.weight)) : 0
    }

    await db.transaction('rw', db.workouts, db.sets, async () => {
      const workoutId = await db.workouts.add({ date, note })
      const allSets = entries.flatMap(entry => {
        const sets = entrySetsRef.current[entry.key] ?? entry.sets
        return sets
          .filter(s => s.weight !== '' && s.weight !== null && parseFloat(s.weight) > 0)
          .map(s => ({
            workoutId,
            exerciseId: entry.exerciseId,
            setNumber: s.setNumber,
            weight: parseFloat(s.weight),
            reps: parseInt(s.reps) || DEFAULT_REPS,
          }))
      })
      if (allSets.length > 0) await db.sets.bulkAdd(allSets)
    })

    // Detect new PRs
    const newPRs = []
    for (const entry of entries) {
      const sets = entrySetsRef.current[entry.key] ?? entry.sets
      const newMax = Math.max(...sets.map(s => parseFloat(s.weight) || 0), 0)
      if (newMax > 0 && newMax > historicalMax[entry.exerciseId]) {
        const exercise = exercises?.find(e => e.id === entry.exerciseId)
        newPRs.push({ name: exercise?.name ?? '—', weight: newMax })
      }
    }

    if (newPRs.length > 0) {
      haptic.pr()
      newPRs.forEach(pr => logger.info('pr', 'New PR detected', { exercise: pr.name, weight: pr.weight }))
    } else {
      haptic.success()
    }

    logger.info('workout', 'Workout saved', { date, exerciseCount: entries.length, newPRs: newPRs.length })
    cloudBackup(db)

    setSaving(false)
    setSaved(true)
    setEntries([])
    entrySetsRef.current = {}
    setNote('')
    if (newPRs.length > 0) setPrs(newPRs)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <>
    {/* PR Celebration modal */}
    {prs && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center px-6"
        style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
        onClick={() => setPrs(null)}
      >
        <div
          className="w-full max-w-sm rounded-3xl p-6 text-center space-y-4"
          style={{ background: '#1a1a26', border: '1px solid rgba(139,92,246,0.3)', boxShadow: '0 0 60px rgba(139,92,246,0.25)' }}
          onClick={e => e.stopPropagation()}
        >
          <div className="text-5xl">🏆</div>
          <div>
            <div className="text-2xl font-bold" style={{ color: '#f8f8ff' }}>
              {prs.length === 1 ? 'New Personal Record!' : `${prs.length} New Records!`}
            </div>
            <div className="text-sm mt-1" style={{ color: '#71717a' }}>You crushed your previous best 💪</div>
          </div>
          <div className="space-y-2">
            {prs.map(pr => (
              <div
                key={pr.name}
                className="flex items-center justify-between px-4 py-2.5 rounded-xl"
                style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.2)' }}
              >
                <span className="text-sm font-medium" style={{ color: '#d4d4d8' }}>{pr.name}</span>
                <span className="font-bold" style={{ color: '#c084fc' }}>{pr.weight} kg</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => setPrs(null)}
            className="w-full py-3.5 rounded-2xl font-bold transition-all active:scale-95 btn-primary"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #9333ea)', color: '#fff' }}
          >
            Let's go!
          </button>
        </div>
      </div>
    )}

    <div className="p-4 space-y-4 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight" style={{ color: '#f8f8ff' }}>Workout</h1>
          {entries.length > 0 && (
            <button
              onClick={handleCancel}
              className="text-sm px-2.5 py-1 rounded-lg transition-colors"
              style={{ color: '#71717a', background: 'rgba(255,255,255,0.05)' }}
            >
              Cancel
            </button>
          )}
        </div>

        {/* Date chip — hidden native input layered under a styled pill */}
        <div className="relative">
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium cursor-pointer select-none"
            style={{
              background: 'rgba(139,92,246,0.12)',
              border: '1px solid rgba(139,92,246,0.3)',
              color: '#c4b5fd',
            }}
            onClick={() => dateInputRef.current?.showPicker?.() ?? dateInputRef.current?.click()}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            {formatDatePill(date)}
          </div>
          <input
            ref={dateInputRef}
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
            tabIndex={-1}
          />
        </div>
      </div>

      {/* Today's logged exercises */}
      {todayDone && (() => {
        const catEntries = Object.entries(todayDone.catSets).sort((a, b) => b[1] - a[1])
        const CAT_COLORS = {
          Legs: '#6ee7b7', Back: '#22d3ee', Chest: '#fca5a5', Shoulders: '#fdba74',
          Biceps: '#c4b5fd', Triceps: '#fda4af', Abs: '#fde68a', Cardio: '#67e8f9', Other: '#a1a1aa',
        }
        return (
          <div className="rounded-2xl p-4 space-y-3"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>

            {/* Header row */}
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#3f3f46' }}>
                Done today
              </div>
              <div className="flex items-center gap-2 text-xs" style={{ color: '#52525b' }}>
                <span className="font-bold" style={{ color: '#c084fc' }}>
                  {Math.round(todayDone.totalVolume).toLocaleString('en-US')} kg
                </span>
                <span style={{ color: '#3f3f46' }}>·</span>
                <span>{todayDone.totalSets} sets</span>
              </div>
            </div>

            {/* Exercise list — all visible */}
            <div className="space-y-1.5">
              {todayDone.exercises.map(ex => {
                const c = CAT_COLORS[ex.category] || '#a1a1aa'
                return (
                  <div key={ex.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c }} />
                      <span className="text-sm truncate" style={{ color: '#d4d4d8' }}>{ex.name}</span>
                    </div>
                    <span className="text-xs shrink-0 ml-2" style={{ color: '#71717a' }}>
                      {ex.maxWeight} kg × {ex.setCount}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Category breakdown */}
            {catEntries.length > 0 && (
              <div className="space-y-1.5 pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="flex rounded-full overflow-hidden" style={{ height: 5 }}>
                  {catEntries.map(([cat, count]) => (
                    <div key={cat} style={{
                      width: `${(count / todayDone.totalSets) * 100}%`,
                      background: CAT_COLORS[cat] || '#a1a1aa',
                    }} />
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                  {catEntries.map(([cat, count]) => (
                    <div key={cat} className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: CAT_COLORS[cat] || '#a1a1aa' }} />
                      <span className="text-xs" style={{ color: '#71717a' }}>
                        {cat} <span style={{ color: '#52525b' }}>{Math.round((count / todayDone.totalSets) * 100)}%</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* Exercise blocks — collapse to summary while picker is open */}
      {showPicker && entries.length > 0 ? (
        <div
          className="rounded-2xl px-4 py-3"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            transition: 'opacity 200ms',
          }}
        >
          <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#3f3f46' }}>
            In progress · {entries.length} {entries.length === 1 ? 'exercise' : 'exercises'}
          </div>
          <div className="space-y-1">
            {entries.map(entry => {
              const ex = exercises?.find(e => e.id === entry.exerciseId)
              const sets = entrySetsRef.current[entry.key] ?? entry.sets
              const filledSets = sets.filter(s => s.weight !== '' && parseFloat(s.weight) > 0).length
              return (
                <div key={entry.key} className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: '#d4d4d8' }}>{ex?.name ?? '—'}</span>
                  <span className="text-xs" style={{ color: '#52525b' }}>
                    {filledSets > 0 ? `${filledSets} / ${sets.length} sets` : `${sets.length} sets`}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        entries.map(entry => (
          <ExerciseBlock
            key={entry.key}
            entry={entry}
            exercises={exercises}
            onRemove={() => removeEntry(entry.key)}
            onSetsChange={sets => { entrySetsRef.current[entry.key] = sets }}
          />
        ))
      )}

      {/* Empty state guidance card */}
      {entries.length === 0 && !showPicker && (
        <div className="rounded-2xl p-8 text-center space-y-2 fade-in"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}>
          <div className="text-4xl mb-1">🏋️</div>
          <div className="font-semibold" style={{ color: '#d4d4d8' }}>Build today's workout</div>
          <div className="text-sm" style={{ color: '#52525b' }}>Tap "Add exercise" to get started</div>
        </div>
      )}

      {/* Exercise picker */}
      {showPicker ? (
        <div
          className="rounded-2xl p-4 space-y-3"
          style={{
            background: '#1a1a26',
            border: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <input
            autoFocus
            type="text"
            placeholder="Search exercise..."
            value={search}
            onChange={e => setSearch(e.target.value)}
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
          <div className="max-h-64 overflow-y-auto space-y-3 pr-1">
            {filtered && Object.entries(filtered).map(([cat, list]) =>
              list.length === 0 ? null : (
                <div key={cat}>
                  <div
                    className="text-xs uppercase tracking-widest mb-1.5 px-1 font-semibold"
                    style={{ color: '#3f3f46' }}
                  >
                    {cat}
                  </div>
                  {list.map(e => (
                    <button
                      key={e.id}
                      onClick={() => addExercise(e)}
                      className="w-full text-left px-3 py-2.5 rounded-xl text-sm transition-colors flex items-center justify-between"
                      style={{ color: '#d4d4d8' }}
                      onMouseEnter={el => {
                        el.currentTarget.style.background = 'rgba(139,92,246,0.12)'
                        el.currentTarget.style.color = '#f8f8ff'
                      }}
                      onMouseLeave={el => {
                        el.currentTarget.style.background = 'transparent'
                        el.currentTarget.style.color = '#d4d4d8'
                      }}
                    >
                      <span style={{ fontSize: 14 }}>{CATEGORY_ICONS[e.category] ?? '⚡'}</span>
                      <span>{e.name}</span>
                      {e.unilateral && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(139,92,246,0.2)', color: '#a78bfa' }}>
                          1 side
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )
            )}
          </div>
          <button
            onClick={() => { setShowPicker(false); setSearch('') }}
            className="text-sm transition-colors"
            style={{ color: '#52525b' }}
          >
            Cancel
          </button>
        </div>
      ) : (
        /* Gradient border "add exercise" button */
        <div
          className="rounded-2xl p-px"
          style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.35), rgba(34,211,238,0.18))' }}
        >
          <button
            onClick={() => setShowPicker(true)}
            className="w-full py-3.5 rounded-2xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 active:scale-95"
            style={{
              background: '#0b0b11',
              color: '#8b5cf6',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(139,92,246,0.08)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = '#0b0b11'
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="w-4 h-4">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add exercise
          </button>
        </div>
      )}

      {/* Sticky note + save footer */}
      {entries.length > 0 && (
        <div style={{
          position: 'sticky',
          bottom: 0,
          paddingTop: 16,
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
          background: 'linear-gradient(to top, #0b0b11 80%, transparent)',
          marginTop: 8,
        }}>
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-4 rounded-2xl font-bold text-lg transition-all disabled:opacity-50 active:scale-95 btn-primary"
            style={{
              background: saved
                ? 'linear-gradient(135deg, #10b981, #059669)'
                : 'linear-gradient(135deg, #7c3aed, #9333ea)',
              color: '#fff',
              boxShadow: saved
                ? '0 0 24px rgba(16,185,129,0.3)'
                : '0 0 24px rgba(139,92,246,0.25)',
              letterSpacing: '-0.01em',
            }}
          >
            {saved ? 'Saved!' : saving ? 'Saving...' : 'Save workout'}
          </button>
        </div>
      )}
    </div>
    </>
  )
}
