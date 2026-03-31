import { useState } from 'react'
import { db } from '../db'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

const METRICS = [
  { id: 'max_weight', label: 'Max weight', unit: 'kg' },
  { id: 'total_volume', label: 'Volume', unit: 'kg' },
  { id: 'max_reps', label: 'Max reps', unit: '' },
]

function formatDate(str) {
  const d = new Date(str + 'T12:00:00')
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'numeric' })
}

function ChartCard({ title, subtitle, latestValue, latestUnit, data, dataKey }) {
  if (!data || data.length === 0) return null

  // Single data point — show as stat card, can't draw a line
  if (data.length === 1) {
    const value = data[0][dataKey]
    return (
      <div
        className="rounded-2xl p-4"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#52525b' }}>{title} — {subtitle}</div>
        <div className="flex items-end gap-2">
          <span className="text-4xl font-bold" style={{ color: '#c084fc' }}>
            {typeof value === 'number' ? value.toLocaleString('en-US') : value}
          </span>
          {latestUnit && <span className="text-base mb-1" style={{ color: '#71717a' }}>{latestUnit}</span>}
        </div>
        <div className="text-xs mt-2" style={{ color: '#3f3f46' }}>
          {data[0].label} · only 1 record — need more workouts for a chart
        </div>
      </div>
    )
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div className="px-4 pt-4 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-end justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest truncate max-w-[160px]" style={{ color: '#52525b' }}>{title}</div>
            {subtitle && <div className="text-xs mt-0.5" style={{ color: '#3f3f46' }}>{subtitle}</div>}
          </div>
          {latestValue != null && (
            <div className="text-right shrink-0 ml-2">
              <span className="text-2xl font-bold" style={{ color: '#c084fc' }}>
                {typeof latestValue === 'number' ? latestValue.toLocaleString('en-US') : latestValue}
              </span>
              {latestUnit && <span className="text-sm ml-1" style={{ color: '#71717a' }}>{latestUnit}</span>}
              <div className="text-xs mt-0.5" style={{ color: '#3f3f46' }}>latest</div>
            </div>
          )}
        </div>
      </div>
      <div className="p-4">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="label" tick={{ fill: '#52525b', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#52525b', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{
                background: '#1a1a26',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 12,
                fontSize: 13,
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              }}
              labelStyle={{ color: '#71717a' }}
              itemStyle={{ color: '#c084fc' }}
            />
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke="#8b5cf6"
              strokeWidth={2.5}
              dot={{ fill: '#8b5cf6', r: 4, strokeWidth: 0 }}
              activeDot={{ r: 6, fill: '#c084fc', strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ── Exercise view ─────────────────────────────────────────────────────────────

function ExerciseView({ exercises }) {
  const [exerciseId, setExerciseId] = useState(null)
  const [metric, setMetric] = useState('max_weight')

  const selectedExercise = exercises?.find(e => e.id === exerciseId)

  // Count unique training sessions per exercise for the dropdown
  const exerciseCounts = useLiveQuery(async () => {
    try {
      const allSets = await db.sets.toArray()
      const workoutIds = [...new Set(allSets.map(s => s.workoutId))]
      const workouts = await db.workouts.where('id').anyOf(workoutIds).toArray()
      const dateByWorkoutId = Object.fromEntries(workouts.map(w => [w.id, w.date]))

      const counts = {}
      for (const s of allSets) {
        const date = dateByWorkoutId[s.workoutId]
        if (!date) continue
        const id = s.exerciseId
        if (!counts[id]) counts[id] = new Set()
        counts[id].add(date)
      }
      return Object.fromEntries(Object.entries(counts).map(([id, dates]) => [Number(id), dates.size]))
    } catch (err) {
      console.error('exerciseCounts error', err)
      return {}
    }
  }, [])

  const data = useLiveQuery(async () => {
    try {
      if (!exerciseId) return []
      const exercise = await db.exercises.get(exerciseId)
      const multiplier = exercise?.unilateral ? 2 : 1

      const sets = await db.sets.where('exerciseId').equals(exerciseId).toArray()
      if (!sets.length) return []

      const workoutIds = [...new Set(sets.map(s => s.workoutId))]
      const workouts = await db.workouts.where('id').anyOf(workoutIds).toArray()
      const dateMap = Object.fromEntries(workouts.map(w => [w.id, w.date]))

      const byDate = {}
      for (const s of sets) {
        const date = dateMap[s.workoutId]
        if (!date) continue
        if (!byDate[date]) byDate[date] = []
        byDate[date].push(s)
      }

      return Object.entries(byDate)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, sets]) => ({
          date,
          label: formatDate(date),
          max_weight: Math.max(...sets.map(s => s.weight)),
          total_volume: Math.round(sets.reduce((sum, s) => sum + s.weight * s.reps * multiplier, 0)),
          max_reps: Math.max(...sets.map(s => s.reps)),
        }))
    } catch (err) {
      console.error('ExerciseView data error', err)
      return []
    }
  }, [exerciseId])

  const latestValue = data && data.length > 0 ? data[data.length - 1][metric] : null
  const currentMetric = METRICS.find(m => m.id === metric)

  return (
    <div className="space-y-4">
      {/* Exercise select */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#3f3f46' }}>Exercise</label>
        <div className="relative">
          <select
            value={exerciseId ?? ''}
            onChange={e => setExerciseId(Number(e.target.value) || null)}
            className="w-full rounded-xl px-4 py-3 text-sm outline-none appearance-none cursor-pointer transition-all"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.10)',
              color: exerciseId ? '#f8f8ff' : '#52525b',
            }}
            onFocus={e => { e.target.style.boxShadow = '0 0 0 2px rgba(139,92,246,0.4)'; e.target.style.borderColor = 'rgba(139,92,246,0.5)' }}
            onBlur={e => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = 'rgba(255,255,255,0.10)' }}
          >
            <option value="">— select exercise —</option>
            {exercises?.map(e => (
              <option key={e.id} value={e.id}>
                {e.name}{e.unilateral ? ' (1 side)' : ''}{exerciseCounts?.[e.id] ? ` · ${exerciseCounts[e.id]}×` : ''}
              </option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#52525b' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>
      </div>

      {/* Unilateral note */}
      {selectedExercise?.unilateral && (
        <div
          className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs"
          style={{ background: 'rgba(139,92,246,0.10)', border: '1px solid rgba(139,92,246,0.2)', color: '#a78bfa' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 shrink-0">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          Unilateral exercise — volume includes both sides (×2)
        </div>
      )}

      {/* Metric pills */}
      {exerciseId && (
        <div className="flex gap-2">
          {METRICS.map(m => {
            const active = metric === m.id
            return (
              <button
                key={m.id}
                onClick={() => setMetric(m.id)}
                className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all"
                style={
                  active
                    ? { background: 'linear-gradient(135deg, #7c3aed, #9333ea)', color: '#fff', boxShadow: '0 0 12px rgba(139,92,246,0.3)' }
                    : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#71717a' }
                }
              >
                {m.label}
              </button>
            )
          })}
        </div>
      )}

      <ChartCard
        title={selectedExercise?.name}
        subtitle={currentMetric?.label}
        latestValue={latestValue}
        latestUnit={currentMetric?.unit}
        data={data}
        dataKey={metric}
      />

      {exerciseId && data === undefined && (
        <div className="text-sm text-center mt-8" style={{ color: '#52525b' }}>Loading...</div>
      )}

      {exerciseId && data && data.length === 0 && (
        <div className="rounded-2xl p-8 text-center fade-in"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.07)' }}>
          <div className="text-4xl mb-3">📉</div>
          <div className="font-semibold" style={{ color: '#d4d4d8' }}>No data yet</div>
          <div className="text-sm mt-1" style={{ color: '#52525b' }}>Log sets for this exercise to see your chart</div>
        </div>
      )}

      {!exerciseId && (
        <div className="rounded-2xl p-8 text-center fade-in"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.07)' }}>
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(139,92,246,0.10)', border: '1px solid rgba(139,92,246,0.18)' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" />
            </svg>
          </div>
          <div className="font-semibold" style={{ color: '#d4d4d8' }}>Pick an exercise</div>
          <div className="text-sm mt-1" style={{ color: '#52525b' }}>Select from the dropdown above to view your progress chart</div>
        </div>
      )}
    </div>
  )
}

// ── Daily total view ──────────────────────────────────────────────────────────

function DailyView() {
  const data = useLiveQuery(async () => {
    const workouts = await db.workouts.orderBy('date').toArray()
    if (!workouts.length) return []

    const exercises = await db.exercises.toArray()
    const exMap = Object.fromEntries(exercises.map(e => [e.id, e]))

    const result = []
    for (const workout of workouts) {
      const sets = await db.sets.where('workoutId').equals(workout.id).toArray()
      if (!sets.length) continue

      const totalVolume = sets.reduce((sum, s) => {
        const multiplier = exMap[s.exerciseId]?.unilateral ? 2 : 1
        return sum + s.weight * s.reps * multiplier
      }, 0)
      const totalSets = sets.length
      const exerciseCount = new Set(sets.map(s => s.exerciseId)).size

      result.push({
        date: workout.date,
        label: formatDate(workout.date),
        total_volume: Math.round(totalVolume),
        total_sets: totalSets,
        exercise_count: exerciseCount,
      })
    }
    return result
  })

  if (!data) return (
    <div className="flex justify-center items-center py-12">
      <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'rgba(139,92,246,0.3)', borderTopColor: '#8b5cf6' }} />
    </div>
  )
  if (data.length === 0) return (
    <div className="rounded-2xl p-8 text-center fade-in"
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.07)' }}>
      <div className="text-4xl mb-3">📈</div>
      <div className="font-semibold" style={{ color: '#d4d4d8' }}>No workouts yet</div>
      <div className="text-sm mt-1" style={{ color: '#52525b' }}>Start logging workouts to see your progress over time</div>
    </div>
  )

  const latest = data[data.length - 1]

  // Summary stats row
  const avgVolume = Math.round(data.reduce((s, d) => s + d.total_volume, 0) / data.length)
  const maxVolume = Math.max(...data.map(d => d.total_volume))

  return (
    <div className="space-y-4">
      {/* Summary chips */}
      <div className="flex gap-2">
        <div className="flex-1 rounded-xl px-3 py-2.5 text-center" style={{ background: 'rgba(139,92,246,0.10)', border: '1px solid rgba(139,92,246,0.18)' }}>
          <div className="text-xs" style={{ color: '#71717a' }}>Avg / workout</div>
          <div className="text-sm font-bold mt-0.5" style={{ color: '#c4b5fd' }}>{avgVolume.toLocaleString('en-US')} kg</div>
        </div>
        <div className="flex-1 rounded-xl px-3 py-2.5 text-center" style={{ background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.15)' }}>
          <div className="text-xs" style={{ color: '#71717a' }}>Maximum</div>
          <div className="text-sm font-bold mt-0.5" style={{ color: '#22d3ee' }}>{maxVolume.toLocaleString('en-US')} kg</div>
        </div>
        <div className="flex-1 rounded-xl px-3 py-2.5 text-center" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
          <div className="text-xs" style={{ color: '#71717a' }}>Workouts</div>
          <div className="text-sm font-bold mt-0.5" style={{ color: '#10b981' }}>{data.length}</div>
        </div>
      </div>

      <ChartCard
        title="Total volume"
        subtitle="weight lifted per workout"
        latestValue={latest.total_volume}
        latestUnit="kg"
        data={data}
        dataKey="total_volume"
      />

      <ChartCard
        title="Exercise count"
        subtitle="different exercises per workout"
        latestValue={latest.exercise_count}
        latestUnit=""
        data={data}
        dataKey="exercise_count"
      />
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────

const VIEWS = [
  { id: 'exercise', label: 'Exercise' },
  { id: 'daily', label: 'Daily overview' },
]

export default function Reports() {
  const exercises = useLiveQuery(() => db.exercises.orderBy('name').toArray())
  const [view, setView] = useState('exercise')

  if (!exercises) return (
    <div className="p-4 pt-6 flex flex-col items-center justify-center gap-2" style={{ minHeight: 200 }}>
      <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'rgba(139,92,246,0.3)', borderTopColor: '#8b5cf6' }} />
      <span className="text-xs" style={{ color: '#3f3f46' }}>Loading...</span>
    </div>
  )

  return (
    <div className="p-4 space-y-4 pb-6">
      <h1 className="text-xl font-bold tracking-tight pt-1" style={{ color: '#f8f8ff' }}>Charts</h1>

      {/* View switcher */}
      <div
        className="flex rounded-xl p-1 gap-1"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        {VIEWS.map(v => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
            style={
              view === v.id
                ? { background: 'linear-gradient(135deg, #7c3aed, #9333ea)', color: '#fff', boxShadow: '0 0 10px rgba(139,92,246,0.25)' }
                : { color: '#71717a' }
            }
          >
            {v.label}
          </button>
        ))}
      </div>

      {view === 'exercise' && <ExerciseView exercises={exercises} />}
      {view === 'daily' && <DailyView />}
    </div>
  )
}
