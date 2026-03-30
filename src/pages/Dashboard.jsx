import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function getWeekStart(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = (day === 0 ? -6 : 1 - day)
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function isoDate(d) {
  return d.toISOString().slice(0, 10)
}

function formatBigNumber(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return Math.round(n).toLocaleString('en-US')
  return Math.round(n).toString()
}

function daysAgoText(dateStr) {
  if (!dateStr) return null
  const today = isoDate(new Date())
  if (dateStr === today) return 'Today'
  const diff = Math.round((new Date(today) - new Date(dateStr)) / 86400000)
  if (diff === 1) return 'Yesterday'
  if (diff <= 6) return `${diff} days ago`
  return `${Math.round(diff / 7)} wks ago`
}

function greeting() {
  const h = new Date().getHours()
  if (h < 6) return 'Good night'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function motivationalMsg(streak, daysSinceLast) {
  if (daysSinceLast === 0) return { text: 'Already crushed it today. Nice! 💪', color: '#10b981' }
  if (streak >= 7)         return { text: `${streak} day streak! Incredible. 🔥`, color: '#f59e0b' }
  if (streak >= 3)         return { text: 'Streak is growing. Keep it going! 🔥', color: '#f59e0b' }
  if (daysSinceLast === 1) return { text: 'Rested and ready. Let\'s go! ⚡', color: '#8b5cf6' }
  if (daysSinceLast === 2) return { text: 'Body is recovered. Time to grind! 💪', color: '#8b5cf6' }
  if (daysSinceLast >= 3)  return { text: 'The gym is calling. Don\'t resist! 🚀', color: '#f43f5e' }
  return { text: 'Ready for a workout?', color: '#8b5cf6' }
}

export default function Dashboard({ onStartWorkout }) {
  const allWorkouts = useLiveQuery(() => db.workouts.orderBy('date').toArray())
  const allSets = useLiveQuery(() => db.sets.toArray())
  const allExercises = useLiveQuery(() => db.exercises.toArray())

  if (!allWorkouts || !allSets || !allExercises) {
    return (
      <div className="p-4 pt-6 flex flex-col items-center justify-center gap-2" style={{ minHeight: 200 }}>
        <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'rgba(139,92,246,0.3)', borderTopColor: '#8b5cf6' }} />
        <span className="text-xs" style={{ color: '#3f3f46' }}>Loading...</span>
      </div>
    )
  }

  const exMap = Object.fromEntries(allExercises.map(e => [e.id, e]))

  // Dates with workouts (Set for O(1) lookup)
  const workoutDates = new Set(allWorkouts.map(w => w.date))
  const sortedDates = [...workoutDates].sort()
  const lastDate = sortedDates[sortedDates.length - 1] ?? null
  const today = isoDate(new Date())

  // Streak
  let streak = 0
  let check = new Date()
  // if no workout today, start checking from yesterday for streak
  if (!workoutDates.has(today)) check.setDate(check.getDate() - 1)
  while (workoutDates.has(isoDate(check))) {
    streak++
    check.setDate(check.getDate() - 1)
  }

  const daysSinceLast = lastDate
    ? Math.round((new Date(today) - new Date(lastDate)) / 86400000)
    : 999

  const msg = motivationalMsg(streak, daysSinceLast)

  // This week's workout days (Mon=0 … Sun=6)
  const weekStart = getWeekStart()
  const thisWeekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return { iso: isoDate(d), hasWorkout: workoutDates.has(isoDate(d)) }
  })

  // Volume per workout (accounting for unilateral)
  function workoutVolume(workoutId) {
    return allSets
      .filter(s => s.workoutId === workoutId)
      .reduce((sum, s) => {
        const mul = exMap[s.exerciseId]?.unilateral ? 2 : 1
        return sum + s.weight * s.reps * mul
      }, 0)
  }

  // This week volume
  const thisWeekWorkoutIds = new Set(
    allWorkouts.filter(w => w.date >= isoDate(weekStart)).map(w => w.id)
  )
  const thisWeekVolume = [...thisWeekWorkoutIds].reduce((s, id) => s + workoutVolume(id), 0)

  // Last week volume
  const lastWeekStart = new Date(weekStart)
  lastWeekStart.setDate(lastWeekStart.getDate() - 7)
  const lastWeekEnd = new Date(weekStart)
  lastWeekEnd.setDate(lastWeekEnd.getDate() - 1)
  const lastWeekWorkoutIds = new Set(
    allWorkouts.filter(w => w.date >= isoDate(lastWeekStart) && w.date <= isoDate(lastWeekEnd)).map(w => w.id)
  )
  const lastWeekVolume = [...lastWeekWorkoutIds].reduce((s, id) => s + workoutVolume(id), 0)

  const volumeDiff = lastWeekVolume > 0
    ? Math.round(((thisWeekVolume - lastWeekVolume) / lastWeekVolume) * 100)
    : null

  // Total all-time volume
  const totalVolume = allWorkouts.reduce((s, w) => s + workoutVolume(w.id), 0)

  // Last workout info
  const lastWorkout = allWorkouts[allWorkouts.length - 1]
  const lastWorkoutExercises = lastWorkout
    ? [...new Set(allSets.filter(s => s.workoutId === lastWorkout.id).map(s => exMap[s.exerciseId]?.name).filter(Boolean))]
    : []

  // Last 8 weeks volume for mini bar chart
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const ws = new Date(weekStart)
    ws.setDate(ws.getDate() - (7 * (7 - i)))
    const we = new Date(ws)
    we.setDate(we.getDate() + 6)
    const ids = allWorkouts.filter(w => w.date >= isoDate(ws) && w.date <= isoDate(we)).map(w => w.id)
    return ids.reduce((s, id) => s + workoutVolume(id), 0)
  })
  const maxWeekVol = Math.max(...weeks, 1)

  const todayIdx = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1

  // ── Achievements ──────────────────────────────────────────────────────────

  // Best single workout volume ever
  const bestWorkoutVolume = Math.max(...allWorkouts.map(w => workoutVolume(w.id)), 0)

  // Best week volume ever (scan all weeks in history)
  const firstDate = sortedDates[0]
  let bestWeekVolume = 0
  if (firstDate) {
    const firstWeekStart = getWeekStart(new Date(firstDate + 'T12:00:00'))
    const totalWeeks = Math.ceil((new Date(today) - firstWeekStart) / (7 * 86400000)) + 1
    for (let i = 0; i < totalWeeks; i++) {
      const ws = new Date(firstWeekStart)
      ws.setDate(ws.getDate() + i * 7)
      const we = new Date(ws)
      we.setDate(we.getDate() + 6)
      const vol = allWorkouts
        .filter(w => w.date >= isoDate(ws) && w.date <= isoDate(we))
        .reduce((s, w) => s + workoutVolume(w.id), 0)
      if (vol > bestWeekVolume) bestWeekVolume = vol
    }
  }

  // Recent PRs — max weight per exercise in last 14 days vs before that
  const cutoff = isoDate(new Date(Date.now() - 14 * 86400000))
  const recentWorkoutIds = new Set(allWorkouts.filter(w => w.date >= cutoff).map(w => w.id))
  const olderWorkoutIds = new Set(allWorkouts.filter(w => w.date < cutoff).map(w => w.id))

  const recentMax = {}
  const historicalMax = {}
  for (const s of allSets) {
    if (recentWorkoutIds.has(s.workoutId)) {
      if (!recentMax[s.exerciseId] || s.weight > recentMax[s.exerciseId]) recentMax[s.exerciseId] = s.weight
    }
    if (olderWorkoutIds.has(s.workoutId)) {
      if (!historicalMax[s.exerciseId] || s.weight > historicalMax[s.exerciseId]) historicalMax[s.exerciseId] = s.weight
    }
  }

  const recentPRs = Object.entries(recentMax)
    .filter(([eid, w]) => w > (historicalMax[eid] ?? 0))
    .map(([eid, w]) => ({ name: exMap[Number(eid)]?.name ?? '—', weight: w }))
    .sort((a, b) => b.weight - a.weight)

  // Milestone badges
  const badges = []

  // Streak milestones
  const streakMilestones = [3, 5, 7, 14, 21, 30, 60, 100]
  const streakBadge = [...streakMilestones].reverse().find(m => streak >= m)
  if (streakBadge) badges.push({ icon: '🔥', label: `${streakBadge}-Day Streak`, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' })

  // Workout count
  const countMilestones = [10, 25, 50, 100, 200, 500]
  const countBadge = [...countMilestones].reverse().find(m => allWorkouts.length >= m)
  if (countBadge) badges.push({ icon: '💪', label: `${countBadge} Workouts`, color: '#10b981', bg: 'rgba(16,185,129,0.12)' })

  // Total volume milestones (kg)
  const volMilestones = [50000, 100000, 250000, 500000, 1000000]
  const volBadge = [...volMilestones].reverse().find(m => totalVolume >= m)
  if (volBadge) badges.push({ icon: '⚡', label: `${formatBigNumber(volBadge)} kg Lifted`, color: '#22d3ee', bg: 'rgba(34,211,238,0.10)' })

  // Best week — show if this week is a new best
  const isThisWeekBest = thisWeekVolume > 0 && thisWeekVolume >= bestWeekVolume
  if (isThisWeekBest) badges.push({ icon: '📈', label: 'Best Week Ever!', color: '#c084fc', bg: 'rgba(192,132,252,0.12)' })

  return (
    <div className="p-4 pb-8 space-y-4">

      {/* Greeting */}
      <div className="pt-2 pb-1">
        <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#3f3f46' }}>{greeting()}</div>
        <div className="text-xl font-bold mt-1 tracking-tight leading-snug" style={{ color: msg.color }}>
          {msg.text}
        </div>
        {lastDate && (
          <div className="text-xs mt-1" style={{ color: '#52525b' }}>
            Last workout {daysAgoText(lastDate)}
          </div>
        )}
      </div>

      {/* Streak + week dots */}
      <div
        className="rounded-2xl p-4"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#3f3f46' }}>Streak</div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-4xl font-bold" style={{ color: streak > 0 ? '#f59e0b' : '#3f3f46' }}>{streak}</span>
              <span className="text-sm" style={{ color: '#52525b' }}>day streak</span>
              {streak > 0 && <span className="text-xl">🔥</span>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#3f3f46' }}>This week</div>
            <div className="text-2xl font-bold" style={{ color: '#f8f8ff' }}>
              {thisWeekDays.filter(d => d.hasWorkout).length}
              <span className="text-sm font-normal ml-1" style={{ color: '#52525b' }}>/ 7 days</span>
            </div>
          </div>
        </div>

        {/* Week dots */}
        <div className="flex gap-1.5">
          {thisWeekDays.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-lg transition-all"
                style={{
                  height: 6,
                  background: d.hasWorkout
                    ? 'linear-gradient(135deg, #7c3aed, #c026d3)'
                    : i === todayIdx
                    ? 'rgba(139,92,246,0.2)'
                    : 'rgba(255,255,255,0.06)',
                }}
              />
              <span
                className="text-xs"
                style={{ color: i === todayIdx ? '#8b5cf6' : '#3f3f46', fontWeight: i === todayIdx ? 700 : 400 }}
              >
                {DAYS[i]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Volume this week vs last week */}
      <div className="grid grid-cols-2 gap-3">
        <div
          className="rounded-2xl p-4"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#3f3f46' }}>
            This week
          </div>
          <div className="text-2xl font-bold" style={{ color: '#c084fc' }}>
            {formatBigNumber(thisWeekVolume)}
          </div>
          <div className="text-xs mt-0.5" style={{ color: '#52525b' }}>kg total</div>
          {volumeDiff !== null && (
            <div
              className="text-xs mt-2 font-semibold"
              style={{ color: volumeDiff >= 0 ? '#10b981' : '#f43f5e' }}
            >
              {volumeDiff >= 0 ? '▲' : '▼'} {Math.abs(volumeDiff)}% vs last week
            </div>
          )}
        </div>

        <div
          className="rounded-2xl p-4"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#3f3f46' }}>
            All time
          </div>
          <div className="text-2xl font-bold" style={{ color: '#22d3ee' }}>
            {formatBigNumber(totalVolume)}
          </div>
          <div className="text-xs mt-0.5" style={{ color: '#52525b' }}>kg total</div>
          <div className="text-xs mt-2" style={{ color: '#3f3f46' }}>
            {allWorkouts.length} workouts
          </div>
        </div>
      </div>

      {/* 8-week bar chart */}
      <div
        className="rounded-2xl p-4"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#3f3f46' }}>
          Volume last 8 weeks
        </div>
        <div className="flex items-end gap-1.5" style={{ height: 56 }}>
          {weeks.map((vol, i) => (
            <div key={i} className="flex-1 flex flex-col justify-end" style={{ height: '100%' }}>
              <div
                className="w-full rounded-sm transition-all"
                style={{
                  height: `${Math.max((vol / maxWeekVol) * 100, vol > 0 ? 4 : 0)}%`,
                  background: i === 7
                    ? 'linear-gradient(180deg, #8b5cf6, #6d28d9)'
                    : 'rgba(139,92,246,0.25)',
                  minHeight: vol > 0 ? 4 : 0,
                }}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-xs" style={{ color: '#3f3f46' }}>-7 wks</span>
          <span className="text-xs font-semibold" style={{ color: '#8b5cf6' }}>this week</span>
        </div>
      </div>

      {/* Last workout */}
      {lastWorkout && (
        <div
          className="rounded-2xl p-4"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#3f3f46' }}>
            Last workout
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold" style={{ color: '#f8f8ff' }}>
                {daysAgoText(lastWorkout.date)}
              </div>
              <div className="text-xs mt-1" style={{ color: '#52525b' }}>
                {lastWorkoutExercises.slice(0, 4).join(', ')}
                {lastWorkoutExercises.length > 4 && ` +${lastWorkoutExercises.length - 4}`}
              </div>
            </div>
            <div
              className="text-sm font-bold px-3 py-1.5 rounded-xl"
              style={{ background: 'rgba(139,92,246,0.12)', color: '#a78bfa' }}
            >
              {lastWorkoutExercises.length} exercises
            </div>
          </div>
        </div>
      )}

      {/* Achievements */}
      {(recentPRs.length > 0 || badges.length > 0) && (
        <div
          className="rounded-2xl p-4 space-y-3"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#3f3f46' }}>
            Achievements
          </div>

          {/* Milestone badges */}
          {badges.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {badges.map(b => (
                <div
                  key={b.label}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                  style={{ background: b.bg, color: b.color, border: `1px solid ${b.color}33` }}
                >
                  <span>{b.icon}</span>
                  <span>{b.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Recent PRs */}
          {recentPRs.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-medium" style={{ color: '#52525b' }}>
                🏆 Personal Records (last 14 days)
              </div>
              {recentPRs.map(pr => (
                <div key={pr.name} className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: '#d4d4d8' }}>{pr.name}</span>
                  <span className="text-sm font-bold" style={{ color: '#c084fc' }}>{pr.weight} kg</span>
                </div>
              ))}
            </div>
          )}

          {/* Best workout + best week stats */}
          <div className="flex gap-2 pt-1">
            {bestWorkoutVolume > 0 && (
              <div className="flex-1 rounded-xl px-3 py-2 text-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <div className="text-xs" style={{ color: '#3f3f46' }}>Best session</div>
                <div className="text-sm font-bold mt-0.5" style={{ color: '#f59e0b' }}>
                  {formatBigNumber(bestWorkoutVolume)} kg
                </div>
              </div>
            )}
            {bestWeekVolume > 0 && (
              <div className="flex-1 rounded-xl px-3 py-2 text-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <div className="text-xs" style={{ color: '#3f3f46' }}>Best week</div>
                <div className="text-sm font-bold mt-0.5" style={{ color: '#22d3ee' }}>
                  {formatBigNumber(bestWeekVolume)} kg
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CTA */}
      <button
        onClick={onStartWorkout}
        className="w-full py-4 rounded-2xl font-bold text-lg transition-all active:scale-95 btn-primary"
        style={{
          background: 'linear-gradient(135deg, #7c3aed, #9333ea)',
          color: '#fff',
          boxShadow: '0 0 32px rgba(139,92,246,0.30)',
          letterSpacing: '-0.01em',
        }}
      >
        Start Workout
      </button>
    </div>
  )
}
