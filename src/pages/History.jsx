import { useState, useEffect, useMemo } from 'react'
import { db } from '../db'
import { useLiveQuery } from 'dexie-react-hooks'
import { importHistory } from '../importHistory'
import { haptic } from '../haptic'
import { logger } from '../logger'

// ── Constants ─────────────────────────────────────────────────────────────────

const CAT_COLORS = {
  Legs:      '#6ee7b7', Back:      '#22d3ee', Chest:     '#fca5a5',
  Shoulders: '#fdba74', Biceps:    '#c4b5fd', Triceps:   '#fda4af',
  Abs:       '#fde68a', Cardio:    '#67e8f9', Other:     '#a1a1aa',
}

const DAY_TYPE_STYLES = {
  'Leg day':          { color: '#6ee7b7', bg: 'rgba(110,231,183,0.12)', border: 'rgba(110,231,183,0.25)' },
  'Leg-focused':      { color: '#6ee7b7', bg: 'rgba(110,231,183,0.10)', border: 'rgba(110,231,183,0.20)' },
  'Push session':     { color: '#fca5a5', bg: 'rgba(239,68,68,0.10)',   border: 'rgba(239,68,68,0.20)' },
  'Pull session':     { color: '#22d3ee', bg: 'rgba(34,211,238,0.10)',  border: 'rgba(34,211,238,0.20)' },
  'Upper body':       { color: '#fdba74', bg: 'rgba(251,146,60,0.10)',  border: 'rgba(251,146,60,0.20)' },
  'Full body':        { color: '#c4b5fd', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.25)' },
  'Balanced session': { color: '#a1a1aa', bg: 'rgba(161,161,170,0.08)', border: 'rgba(161,161,170,0.18)' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isoDate(d) { return d.toISOString().slice(0, 10) }

function weekStart(d = new Date()) {
  const c = new Date(d)
  const day = c.getDay()
  c.setDate(c.getDate() - (day === 0 ? 6 : day - 1))
  c.setHours(0, 0, 0, 0)
  return c
}

function formatWeekLabel(ws) {
  return new Date(ws + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDate(str) {
  const d = new Date(str + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'long' })
}

function formatDayHeader(str) {
  const d = new Date(str + 'T12:00:00')
  return {
    weekday: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
    date:    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    year:    d.getFullYear(),
  }
}

// Muscle group dominance interpretation (based on set counts — most useful for planning)
function getDayType(catSets, totalSets) {
  if (!totalSets) return null
  const pct = cat => ((catSets[cat] || 0) / totalSets) * 100
  const legs  = pct('Legs')
  const push  = pct('Chest') + pct('Shoulders') + pct('Triceps')
  const pull  = pct('Back') + pct('Biceps')
  if (legs >= 50) return 'Leg day'
  if (legs >= 35) return 'Leg-focused'
  if (push >= 50) return 'Push session'
  if (pull >= 50) return 'Pull session'
  if (push >= 30 && pull >= 25) return 'Upper body'
  if (legs >= 20 && (push + pull) >= 35) return 'Full body'
  const top = Object.entries(catSets).sort((a, b) => b[1] - a[1])[0]
  if (top && (top[1] / totalSets) >= 0.55) return `${top[0]}-focused`
  return 'Balanced session'
}

function getDayTypeStyle(t) {
  return DAY_TYPE_STYLES[t] || { color: '#c4b5fd', bg: 'rgba(139,92,246,0.10)', border: 'rgba(139,92,246,0.22)' }
}

// ── ExerciseSparkline ─────────────────────────────────────────────────────────

function ExerciseSparkline({ exerciseId, currentDate }) {
  const data = useLiveQuery(async () => {
    if (!exerciseId) return []
    const allSets = await db.sets.where('exerciseId').equals(exerciseId).toArray()
    if (!allSets.length) return []
    const workoutIds = [...new Set(allSets.map(s => s.workoutId))]
    const workouts = await db.workouts.where('id').anyOf(workoutIds).toArray()
    const dateMap = Object.fromEntries(workouts.map(w => [w.id, w.date]))
    const byDate = {}
    for (const s of allSets) {
      const date = dateMap[s.workoutId]
      if (!date) continue
      if (!byDate[date] || s.weight > byDate[date]) byDate[date] = s.weight
    }
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, weight]) => ({ date, weight }))
  }, [exerciseId])

  if (!data || data.length < 2) return null

  const W = 300, H = 52, pad = 6
  const weights = data.map(d => d.weight)
  const minW = Math.min(...weights), maxW = Math.max(...weights), range = maxW - minW || 1
  const pts = data.map((d, i) => ({
    x: pad + (i / (data.length - 1)) * (W - pad * 2),
    y: H - pad - ((d.weight - minW) / range) * (H - pad * 2),
    isCurrent: d.date === currentDate, weight: d.weight,
  }))
  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const last = pts[pts.length - 1], first = pts[0]
  const isUp = last.weight >= first.weight

  return (
    <div className="mt-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs" style={{ color: '#3f3f46' }}>Max weight trend</span>
        <span className="text-xs font-semibold" style={{ color: isUp ? '#10b981' : '#f43f5e' }}>
          {isUp ? '▲' : '▼'} {last.weight} kg
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 44, overflow: 'visible' }}>
        <path d={`${linePath} L${last.x},${H} L${pts[0].x},${H} Z`} fill="rgba(139,92,246,0.06)" />
        <path d={linePath} fill="none" stroke="rgba(139,92,246,0.45)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={p.isCurrent ? 4 : 2.5} fill={p.isCurrent ? '#c084fc' : '#7c3aed'} opacity={p.isCurrent ? 1 : 0.55} />)}
        {(() => {
          const cur = pts.find(p => p.isCurrent)
          if (!cur) return null
          const lx = cur.x > W * 0.7 ? cur.x - 4 : cur.x + 4
          return <text x={lx} y={cur.y - 7} fontSize="9" fill="#c084fc" textAnchor={cur.x > W * 0.7 ? 'end' : 'start'} fontWeight="600">{cur.weight} kg</text>
        })()}
      </svg>
    </div>
  )
}

// ── WorkoutDetail ─────────────────────────────────────────────────────────────

function WorkoutDetail({ workout, onDelete, onDeleted }) {
  const sets = useLiveQuery(() => db.sets.where('workoutId').equals(workout.id).toArray(), [workout.id])
  const exerciseIds = [...new Set(sets?.map(s => s.exerciseId) ?? [])]
  const exercises = useLiveQuery(
    () => exerciseIds.length ? db.exercises.where('id').anyOf(exerciseIds).toArray() : Promise.resolve([]),
    [exerciseIds.join(',')]
  )
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const exMap = Object.fromEntries(exercises?.map(e => [e.id, e]) ?? [])
  const grouped = exerciseIds
    .map(eid => ({ exercise: exMap[eid], sets: sets?.filter(s => s.exerciseId === eid).sort((a, b) => a.setNumber - b.setNumber) ?? [] }))
    .filter(g => g.exercise)
  const totalVolume = sets?.reduce((sum, s) => sum + s.weight * s.reps, 0) ?? 0
  const totalSets = sets?.length ?? 0

  const handleDelete = async () => {
    const capturedSets = sets ? [...sets] : []
    await db.sets.where('workoutId').equals(workout.id).delete()
    await db.workouts.delete(workout.id)
    logger.info('workout', 'Workout deleted', { workoutId: workout.id, date: workout.date, setCount: capturedSets.length })
    haptic.warning()
    onDelete()
    onDeleted?.({ workout, sets: capturedSets })
  }

  return (
    <div className="space-y-3 pt-1">
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowDeleteModal(false)}>
          <div className="w-full max-w-lg rounded-t-3xl p-6 space-y-4"
            style={{ background: '#1a1a26', border: '1px solid rgba(255,255,255,0.10)' }}
            onClick={e => e.stopPropagation()}>
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
                style={{ background: 'rgba(244,63,94,0.15)', border: '1px solid rgba(244,63,94,0.3)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                  <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                </svg>
              </div>
              <div className="font-bold text-lg" style={{ color: '#f8f8ff' }}>Delete workout?</div>
              <div className="text-sm mt-1" style={{ color: '#71717a' }}>{formatDate(workout.date)} · {grouped.length} exercises</div>
              <div className="text-sm mt-1" style={{ color: '#52525b' }}>This action cannot be undone.</div>
            </div>
            <button onClick={handleDelete} className="w-full py-3.5 rounded-2xl font-bold text-base transition-all"
              style={{ background: 'linear-gradient(135deg, #dc2626, #f43f5e)', color: '#fff' }}>Delete workout</button>
            <button onClick={() => setShowDeleteModal(false)} className="w-full py-3.5 rounded-2xl font-semibold text-base transition-all"
              style={{ background: 'rgba(255,255,255,0.06)', color: '#a1a1aa' }}>Cancel</button>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        {[
          { label: 'Volume', value: `${Math.round(totalVolume).toLocaleString('en-US')} kg`, color: '#c4b5fd', bg: 'rgba(139,92,246,0.10)', border: 'rgba(139,92,246,0.18)' },
          { label: 'Sets', value: totalSets, color: '#22d3ee', bg: 'rgba(34,211,238,0.08)', border: 'rgba(34,211,238,0.15)' },
          { label: 'Exercises', value: grouped.length, color: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.15)' },
        ].map(c => (
          <div key={c.label} className="flex-1 rounded-xl px-3 py-2 text-center" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
            <div className="text-xs" style={{ color: '#71717a' }}>{c.label}</div>
            <div className="text-sm font-bold" style={{ color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {grouped.map(({ exercise, sets }) => (
        <div key={exercise?.id} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="font-medium mb-2 text-sm" style={{ color: '#f8f8ff' }}>{exercise?.name ?? '—'}</div>
          <div className="grid grid-cols-3 gap-1 text-xs mb-1 px-1 pb-1" style={{ color: '#3f3f46', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <span>Set</span><span className="text-center">Weight</span><span className="text-center">Reps</span>
          </div>
          {sets.map(s => (
            <div key={s.id} className="grid grid-cols-3 gap-1 text-sm px-1 py-0.5">
              <span style={{ color: '#52525b' }}>{s.setNumber}.</span>
              <span className="text-center" style={{ color: '#d4d4d8' }}>{s.weight} kg</span>
              <span className="text-center" style={{ color: '#d4d4d8' }}>{s.reps}</span>
            </div>
          ))}
          <ExerciseSparkline exerciseId={exercise?.id} currentDate={workout.date} />
        </div>
      ))}

      {workout.note && <div className="text-sm italic px-1" style={{ color: '#71717a' }}>{workout.note}</div>}

      <button onClick={() => setShowDeleteModal(true)} className="text-sm transition-colors"
        style={{ color: '#52525b' }}
        onMouseEnter={e => e.currentTarget.style.color = '#f43f5e'}
        onMouseLeave={e => e.currentTarget.style.color = '#52525b'}>
        Delete workout
      </button>
    </div>
  )
}

// ── WorkoutDayCard — rich at-a-glance workout card ────────────────────────────

function WorkoutDayCard({ date, workouts, allSets, allExercises, onDeleted }) {
  const [showDetail, setShowDetail] = useState(false)
  const [deletedIds, setDeletedIds] = useState(new Set())

  const active = workouts.filter(w => !deletedIds.has(w.id))
  if (!active.length) return null

  const exMap = Object.fromEntries(allExercises.map(e => [e.id, e]))

  // All sets for this day
  const activeIds = new Set(active.map(w => w.id))
  const daySets = allSets.filter(s => activeIds.has(s.workoutId))

  // Total volume (unilateral × 2)
  const totalVolume = daySets.reduce((sum, s) => {
    const mul = exMap[s.exerciseId]?.unilateral ? 2 : 1
    return sum + s.weight * s.reps * mul
  }, 0)

  const totalSets = daySets.length
  const exerciseIds = [...new Set(daySets.map(s => s.exerciseId))]

  // Category breakdown by set count (best for planning: tells you how hard each muscle worked)
  const catSets = {}
  for (const s of daySets) {
    const cat = exMap[s.exerciseId]?.category || 'Other'
    catSets[cat] = (catSets[cat] || 0) + 1
  }
  const catEntries = Object.entries(catSets).sort((a, b) => b[1] - a[1])

  // Group sets per exercise, sorted by setNumber
  const exSetsMap = {}
  for (const s of daySets) {
    if (!exSetsMap[s.exerciseId]) exSetsMap[s.exerciseId] = []
    exSetsMap[s.exerciseId].push(s)
  }
  for (const eid in exSetsMap) exSetsMap[eid].sort((a, b) => a.setNumber - b.setNumber)

  // All exercises sorted by set count (most worked first)
  const exerciseList = exerciseIds
    .map(eid => ({
      eid: Number(eid),
      name: exMap[eid]?.name,
      category: exMap[eid]?.category,
      sets: exSetsMap[eid] || [],
    }))
    .filter(e => e.name)
    .sort((a, b) => b.sets.length - a.sets.length)

  const maxCatSets = Math.max(...catEntries.map(([, c]) => c), 1)

  const dayType = getDayType(catSets, totalSets)
  const dayTypeStyle = getDayTypeStyle(dayType)
  const { weekday, date: dateLabel, year } = formatDayHeader(date)
  const currentYear = new Date().getFullYear()

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>

      {/* ── Main card body ──────────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-3 space-y-3">

        {/* Row 1: date + day type */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold tracking-widest" style={{ color: '#52525b' }}>{weekday}</span>
            <span className="font-semibold text-base" style={{ color: '#f8f8ff' }}>{dateLabel}</span>
            {year !== currentYear && <span className="text-xs" style={{ color: '#3f3f46' }}>{year}</span>}
          </div>
          {dayType && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ color: dayTypeStyle.color, background: dayTypeStyle.bg, border: `1px solid ${dayTypeStyle.border}` }}>
              {dayType}
            </span>
          )}
        </div>

        {/* Row 2: summary stats */}
        <div className="flex items-center gap-3">
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold" style={{ color: '#c084fc' }}>
              {Math.round(totalVolume).toLocaleString('en-US')}
            </span>
            <span className="text-xs" style={{ color: '#52525b' }}>kg</span>
          </div>
          <span className="text-xs" style={{ color: '#3f3f46' }}>·</span>
          <span className="text-xs" style={{ color: '#71717a' }}>
            {exerciseIds.length} {exerciseIds.length === 1 ? 'exercise' : 'exercises'}
          </span>
          <span className="text-xs" style={{ color: '#3f3f46' }}>·</span>
          <span className="text-xs" style={{ color: '#71717a' }}>{totalSets} sets</span>
          {active.length > 1 && (
            <>
              <span className="text-xs" style={{ color: '#3f3f46' }}>·</span>
              <span className="text-xs" style={{ color: '#71717a' }}>{active.length} sessions</span>
            </>
          )}
        </div>

        {/* Exercise list — all exercises with sets */}
        {exerciseList.length > 0 && (
          <div className="space-y-2 pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            {exerciseList.map(ex => {
              const c = CAT_COLORS[ex.category] || '#a1a1aa'
              return (
                <div key={ex.eid}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c }} />
                    <span className="text-xs font-semibold" style={{ color: '#d4d4d8' }}>{ex.name}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-2 gap-y-0.5 pl-3">
                    {ex.sets.map((s, i) => (
                      <span key={i} className="text-xs" style={{ color: '#52525b' }}>
                        {s.weight}<span style={{ color: '#3f3f46' }}>×</span>{s.reps}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Category breakdown — horizontal bars, no % */}
        {catEntries.length > 0 && (
          <div className="space-y-1 pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            {catEntries.map(([cat, count]) => (
              <div key={cat} className="flex items-center gap-2">
                <span className="text-xs w-16 shrink-0" style={{ color: '#52525b' }}>{cat}</span>
                <div className="flex-1 rounded-full overflow-hidden" style={{ height: 4, background: 'rgba(255,255,255,0.06)' }}>
                  <div className="h-full rounded-full" style={{
                    width: `${(count / maxCatSets) * 100}%`,
                    background: CAT_COLORS[cat] || '#a1a1aa',
                  }} />
                </div>
                <span className="text-xs w-8 text-right shrink-0" style={{ color: CAT_COLORS[cat] || '#a1a1aa' }}>{Math.round((count / totalSets) * 100)}%</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Expand toggle ────────────────────────────────────────────── */}
      <button
        onClick={() => setShowDetail(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 transition-colors"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)', color: '#3f3f46' }}
      >
        <span className="text-xs">Session details</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"
          style={{ transform: showDetail ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 200ms' }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* ── Expanded session details ─────────────────────────────────── */}
      {showDetail && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {active.map((w, i) => (
            <div key={w.id} className="px-4 pb-4"
              style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none', paddingTop: 12 }}>
              {active.length > 1 && (
                <div className="text-xs font-semibold mb-2 uppercase tracking-widest" style={{ color: '#3f3f46' }}>
                  Session {i + 1}
                </div>
              )}
              <WorkoutDetail
                workout={w}
                onDelete={() => setDeletedIds(prev => new Set([...prev, w.id]))}
                onDeleted={onDeleted}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── StatsView ─────────────────────────────────────────────────────────────────

function StatsView({ allWorkouts, allSets, allExercises }) {
  const [range, setRange] = useState('month')
  const exMap = Object.fromEntries(allExercises.map(e => [e.id, e]))
  const rangeStart = {
    week:      isoDate(weekStart()),
    month:     isoDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
    '3months': isoDate(new Date(Date.now() - 90 * 86400000)),
    all:       '0000-00-00',
  }[range]

  const periodWorkouts = allWorkouts.filter(w => w.date >= rangeStart)
  const periodWorkoutIds = new Set(periodWorkouts.map(w => w.id))
  const periodSets = allSets.filter(s => periodWorkoutIds.has(s.workoutId))
  const totalVolume = periodSets.reduce((sum, s) => {
    const mul = exMap[s.exerciseId]?.unilateral ? 2 : 1
    return sum + s.weight * s.reps * mul
  }, 0)

  const setsPerCat = {}
  for (const s of periodSets) {
    const cat = exMap[s.exerciseId]?.category ?? 'Other'
    setsPerCat[cat] = (setsPerCat[cat] ?? 0) + 1
  }
  const catEntries = Object.entries(setsPerCat).sort((a, b) => b[1] - a[1])
  const maxCatSets = Math.max(...catEntries.map(e => e[1]), 1)

  const exSessions = {}
  for (const w of periodWorkouts) {
    const eids = new Set(allSets.filter(s => s.workoutId === w.id).map(s => s.exerciseId))
    for (const eid of eids) exSessions[eid] = (exSessions[eid] ?? 0) + 1
  }
  const topExercises = Object.entries(exSessions).sort((a, b) => b[1] - a[1]).slice(0, 7)
    .map(([eid, count]) => ({ name: exMap[Number(eid)]?.name ?? '—', count }))

  const weeks = Array.from({ length: 8 }, (_, i) => {
    const ws = new Date(weekStart()); ws.setDate(ws.getDate() - (7 * (7 - i)))
    const we = new Date(ws); we.setDate(we.getDate() + 6)
    const wws = isoDate(ws), wwe = isoDate(we)
    const wWorkouts = allWorkouts.filter(w => w.date >= wws && w.date <= wwe)
    const wIds = new Set(wWorkouts.map(w => w.id))
    const wSets = allSets.filter(s => wIds.has(s.workoutId))
    const vol = wSets.reduce((sum, s) => {
      const mul = exMap[s.exerciseId]?.unilateral ? 2 : 1
      return sum + s.weight * s.reps * mul
    }, 0)
    return { label: formatWeekLabel(wws), workouts: wWorkouts.length, volume: Math.round(vol) }
  })
  const maxVol = Math.max(...weeks.map(w => w.volume), 1)
  const RANGES = [{ id: 'week', label: 'Week' }, { id: 'month', label: 'Month' }, { id: '3months', label: '3 Months' }, { id: 'all', label: 'All time' }]

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5">
        {RANGES.map(r => (
          <button key={r.id} onClick={() => setRange(r.id)}
            className="flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all"
            style={range === r.id
              ? { background: 'linear-gradient(135deg,#7c3aed,#9333ea)', color: '#fff' }
              : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#71717a' }}>
            {r.label}
          </button>
        ))}
      </div>

      {periodWorkouts.length === 0 && (
        <div className="rounded-2xl p-8 text-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.07)' }}>
          <div className="text-4xl mb-3">📊</div>
          <div className="font-semibold" style={{ color: '#d4d4d8' }}>No data for this period</div>
          <div className="text-sm mt-1" style={{ color: '#52525b' }}>Log a workout to see your stats here</div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Workouts', value: periodWorkouts.length, color: '#10b981', bg: 'rgba(16,185,129,0.08)' },
          { label: 'Sets', value: periodSets.length, color: '#22d3ee', bg: 'rgba(34,211,238,0.08)' },
          { label: 'Volume', value: Math.round(totalVolume / 1000) + 'k kg', color: '#c4b5fd', bg: 'rgba(139,92,246,0.10)' },
        ].map(c => (
          <div key={c.label} className="rounded-xl p-3 text-center" style={{ background: c.bg }}>
            <div className="text-xs" style={{ color: '#71717a' }}>{c.label}</div>
            <div className="text-base font-bold mt-0.5" style={{ color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {catEntries.length > 0 && (
        <div className="rounded-2xl p-4 space-y-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#3f3f46' }}>Sets per muscle group</div>
          {catEntries.map(([cat, count]) => (
            <div key={cat} className="flex items-center gap-3">
              <span className="text-xs w-20 shrink-0" style={{ color: '#71717a' }}>{cat}</span>
              <div className="flex-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)', height: 6 }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${(count / maxCatSets) * 100}%`, background: CAT_COLORS[cat] ?? '#a1a1aa' }} />
              </div>
              <span className="text-xs font-semibold w-6 text-right shrink-0" style={{ color: CAT_COLORS[cat] ?? '#a1a1aa' }}>{count}</span>
            </div>
          ))}
        </div>
      )}

      {topExercises.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#3f3f46' }}>Most trained exercises</div>
          <div className="space-y-2">
            {topExercises.map((e, i) => (
              <div key={e.name} className="flex items-center gap-3">
                <span className="text-xs w-4 shrink-0 font-bold" style={{ color: i === 0 ? '#f59e0b' : '#3f3f46' }}>{i + 1}</span>
                <span className="flex-1 text-sm" style={{ color: '#d4d4d8' }}>{e.name}</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(139,92,246,0.12)', color: '#a78bfa' }}>{e.count}×</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#3f3f46' }}>Weekly volume (last 8 weeks)</div>
        <div className="flex items-end gap-1.5" style={{ height: 64 }}>
          {weeks.map((w, i) => (
            <div key={i} className="flex-1 flex flex-col justify-end" style={{ height: '100%' }}>
              <div className="w-full rounded-sm transition-all" style={{
                height: `${Math.max((w.volume / maxVol) * 100, w.volume > 0 ? 4 : 0)}%`,
                background: i === 7 ? 'linear-gradient(180deg,#8b5cf6,#6d28d9)' : 'rgba(139,92,246,0.25)',
                minHeight: w.volume > 0 ? 4 : 0,
              }} />
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-xs" style={{ color: '#3f3f46' }}>{weeks[0]?.label}</span>
          <span className="text-xs font-semibold" style={{ color: '#8b5cf6' }}>this week</span>
        </div>
        <div className="flex gap-1.5 mt-1">
          {weeks.map((w, i) => (
            <div key={i} className="flex-1 text-center">
              <span className="text-xs" style={{ color: w.workouts > 0 ? '#52525b' : '#3f3f46' }}>
                {w.workouts > 0 ? w.workouts : ''}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main History ──────────────────────────────────────────────────────────────

const PAGE_SIZE = 5

export default function History() {
  const [view, setView] = useState('workouts')
  const [showDays, setShowDays] = useState(PAGE_SIZE)
  const [importing, setImporting] = useState(false)
  const [importDone, setImportDone] = useState(false)
  const [reimportConfirm, setReimportConfirm] = useState(false)
  const [undoState, setUndoState] = useState(null)

  useEffect(() => {
    return () => { if (undoState?.timer) clearTimeout(undoState.timer) }
  }, [undoState])

  // Reset pagination when switching to workouts view
  useEffect(() => { if (view === 'workouts') setShowDays(PAGE_SIZE) }, [view])

  const handleDeleted = ({ workout, sets }) => {
    if (undoState?.timer) clearTimeout(undoState.timer)
    const timer = setTimeout(() => setUndoState(null), 5000)
    setUndoState({
      restore: async () => {
        clearTimeout(timer); setUndoState(null)
        await db.workouts.put(workout)
        await db.sets.bulkPut(sets)
        haptic.success()
      },
      timer,
    })
  }

  const allWorkouts  = useLiveQuery(() => db.workouts.orderBy('date').reverse().toArray(), [], [])
  const allSets      = useLiveQuery(() => db.sets.toArray(), [], [])
  const allExercises = useLiveQuery(() => db.exercises.toArray(), [], [])

  const handleImport = async () => {
    setImporting(true); await importHistory(); setImporting(false); setImportDone(true)
  }
  const handleReimport = async () => {
    setImporting(true); setReimportConfirm(false)
    await db.sets.clear(); await db.workouts.clear()
    await importHistory(); setImporting(false); setImportDone(true)
  }

  // Group workouts by date — newest first
  const dayGroups = useMemo(() => {
    const groups = [], idx = {}
    for (const w of allWorkouts) {
      if (idx[w.date] === undefined) {
        idx[w.date] = groups.length
        groups.push({ date: w.date, workouts: [w] })
      } else {
        groups[idx[w.date]].workouts.push(w)
      }
    }
    return groups
  }, [allWorkouts])

  if (allWorkouts.length === 0 && !importDone) {
    return (
      <div className="p-4 flex flex-col items-center mt-12 space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.2)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div className="font-semibold" style={{ color: '#d4d4d8' }}>No workouts yet</div>
          <div className="text-sm mt-1" style={{ color: '#52525b' }}>Your training history will appear here after your first workout — exercises, muscle breakdown, and volume at a glance.</div>
        </div>
        <div className="w-full rounded-2xl p-4 space-y-3"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="text-sm font-semibold" style={{ color: '#f8f8ff' }}>Import 21 historical workouts</div>
          <div className="text-xs" style={{ color: '#71717a' }}>21 workouts from Feb 17 to Mar 29, 2026</div>
          <button onClick={handleImport} disabled={importing}
            className="w-full py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#9333ea)', color: '#fff' }}>
            {importing ? 'Loading...' : 'Import'}
          </button>
        </div>
      </div>
    )
  }

  const visibleDays    = dayGroups.slice(0, showDays)
  const hasMore        = dayGroups.length > showDays
  const remaining      = dayGroups.length - showDays
  const nextBatch      = Math.min(PAGE_SIZE, remaining)

  return (
    <>
    {/* Undo toast */}
    {undoState && (
      <div className="toast-enter fixed left-4 right-4 z-40 flex items-center justify-between px-4 py-3 rounded-2xl max-w-lg mx-auto"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)', background: '#27272a', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
        <span className="text-sm" style={{ color: '#d4d4d8' }}>Workout deleted</span>
        <button onClick={undoState.restore} className="text-sm font-bold px-3 py-1 rounded-lg transition-colors"
          style={{ color: '#8b5cf6', background: 'rgba(139,92,246,0.12)' }}>Undo</button>
      </div>
    )}

    <div className="p-4 space-y-4 pb-6">
      {/* Header + view switcher */}
      <div className="flex items-center justify-between pt-1">
        <h1 className="text-xl font-bold tracking-tight" style={{ color: '#f8f8ff' }}>History</h1>
        <div className="flex rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          {[{ id: 'workouts', label: 'Workouts' }, { id: 'stats', label: 'Stats' }].map(v => (
            <button key={v.id} onClick={() => setView(v.id)}
              className="px-3 py-1.5 text-xs font-semibold transition-all"
              style={view === v.id ? { background: 'linear-gradient(135deg,#7c3aed,#9333ea)', color: '#fff' } : { color: '#71717a' }}>
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {view === 'stats' ? (
        <StatsView allWorkouts={allWorkouts} allSets={allSets} allExercises={allExercises} />
      ) : (
        <>
          {/* Rich workout day cards */}
          {dayGroups.length === 0 ? (
            <div className="rounded-2xl p-8 text-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.07)' }}>
              <div className="text-4xl mb-3">🏋️</div>
              <div className="font-semibold" style={{ color: '#d4d4d8' }}>No workouts found</div>
              <div className="text-sm mt-1" style={{ color: '#52525b' }}>Start logging workouts to build your history</div>
            </div>
          ) : (
            visibleDays.map(({ date, workouts }) => (
              <WorkoutDayCard
                key={date}
                date={date}
                workouts={workouts}
                allSets={allSets}
                allExercises={allExercises}
                onDeleted={handleDeleted}
              />
            ))
          )}

          {/* Load more */}
          {hasMore && (
            <button
              onClick={() => setShowDays(d => d + PAGE_SIZE)}
              className="w-full py-3.5 rounded-2xl text-sm font-semibold transition-all active:scale-98"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#71717a' }}
            >
              Load {nextBatch} more
              <span className="ml-1.5" style={{ color: '#3f3f46' }}>· {remaining} remaining</span>
            </button>
          )}

          {/* Reimport */}
          <div className="mt-4 pt-4 border-t text-center" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
            {importing ? (
              <span className="text-xs" style={{ color: '#52525b' }}>Loading...</span>
            ) : reimportConfirm ? (
              <div className="space-y-2">
                <div className="text-xs" style={{ color: '#71717a' }}>This will delete all workout data and reimport history. Are you sure?</div>
                <div className="flex gap-2 justify-center">
                  <button onClick={handleReimport} className="px-4 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ background: 'rgba(244,63,94,0.15)', color: '#f43f5e', border: '1px solid rgba(244,63,94,0.3)' }}>Confirm reset</button>
                  <button onClick={() => setReimportConfirm(false)} className="px-4 py-1.5 rounded-lg text-xs"
                    style={{ background: 'rgba(255,255,255,0.06)', color: '#71717a' }}>Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setReimportConfirm(true)} className="text-xs transition-colors"
                style={{ color: '#3f3f46' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#71717a' }}
                onMouseLeave={e => { e.currentTarget.style.color = '#3f3f46' }}>
                Reimport historical data
              </button>
            )}
          </div>
        </>
      )}
    </div>
    </>
  )
}
