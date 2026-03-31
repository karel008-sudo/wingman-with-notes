import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'

function isoDate(d) {
  return d.toISOString().slice(0, 10)
}

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

function computeStreaks(workoutDates, today) {
  // Current streak
  let streak = 0
  let check = new Date()
  if (!workoutDates.has(today)) check.setDate(check.getDate() - 1)
  while (workoutDates.has(isoDate(check))) {
    streak++
    check.setDate(check.getDate() - 1)
  }

  // Longest streak
  const sorted = [...workoutDates].sort()
  let longest = 0
  let current = 0
  let prev = null
  for (const d of sorted) {
    if (prev) {
      const diff = Math.round((new Date(d) - new Date(prev)) / 86400000)
      if (diff === 1) {
        current++
      } else {
        current = 1
      }
    } else {
      current = 1
    }
    if (current > longest) longest = current
    prev = d
  }

  return { streak, longestStreak: longest }
}

function getMotivationalText(streak, last28Days, avgPerWeek, totalDays) {
  if (streak >= 7) return `🔥 ${streak} consecutive days — you're unstoppable!`
  if (streak >= 3) return `⚡ ${streak}-day streak. The momentum is real.`
  if (last28Days >= 16) return `💪 You've trained ${last28Days} of the last 28 days. Impressive.`
  if (avgPerWeek >= 4) return `🏆 ${avgPerWeek} sessions per week. Athlete-level consistency.`
  if (avgPerWeek >= 3) return `🎯 ${avgPerWeek} sessions per week on average. Solid rhythm.`
  return `💪 ${totalDays} training days logged and counting.`
}

function MonthCalendar({ year, month, workoutDates, currentStreakDates, today }) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const daysInMonth = lastDay.getDate()

  // Monday-first: 0=Mon … 6=Sun
  const startDow = (firstDay.getDay() + 6) % 7
  const totalCells = Math.ceil((startDow + daysInMonth) / 7) * 7

  const monthStr = String(month + 1).padStart(2, '0')
  const monthWorkoutCount = [...workoutDates].filter(d => d.startsWith(`${year}-${monthStr}`)).length

  const cells = []
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - startDow + 1
    if (dayNum < 1 || dayNum > daysInMonth) {
      cells.push(null)
    } else {
      const dayStr = `${year}-${monthStr}-${String(dayNum).padStart(2, '0')}`
      cells.push({ dayNum, iso: dayStr })
    }
  }

  const weeks = []
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7))
  }

  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      {/* Month header */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold" style={{ color: '#f8f8ff' }}>
          {MONTH_NAMES[month]} {year}
        </div>
        {monthWorkoutCount > 0 && (
          <div
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(139,92,246,0.18)', color: '#a78bfa' }}
          >
            {monthWorkoutCount} {monthWorkoutCount === 1 ? 'day' : 'days'}
          </div>
        )}
      </div>

      {/* Day of week headers */}
      <div className="grid grid-cols-7 mb-1">
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => (
          <div key={d} className="flex justify-center">
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#3f3f46', fontSize: 9 }}>
              {d}
            </span>
          </div>
        ))}
      </div>

      {/* Weeks */}
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7">
          {week.map((cell, ci) => {
            if (!cell) {
              return <div key={ci} style={{ aspectRatio: '1' }} />
            }
            const isToday = cell.iso === today
            const isWorkout = workoutDates.has(cell.iso)
            const isStreakDay = currentStreakDates.has(cell.iso)
            const isFuture = cell.iso > today

            let circleStyle = {}
            let textStyle = {}

            if (isStreakDay) {
              circleStyle = {
                background: 'linear-gradient(135deg, #7c3aed, #8b5cf6)',
              }
              textStyle = { color: '#ffffff', fontWeight: 700 }
            } else if (isWorkout) {
              circleStyle = {
                background: 'rgba(139,92,246,0.30)',
              }
              textStyle = { color: '#c4b5fd', fontWeight: 600 }
            } else if (isToday) {
              circleStyle = {
                border: '1.5px solid rgba(139,92,246,0.6)',
              }
              textStyle = { color: '#a78bfa' }
            } else if (isFuture) {
              textStyle = { color: '#27272a' }
            } else {
              textStyle = { color: '#3f3f46' }
            }

            return (
              <div key={ci} className="flex items-center justify-center" style={{ aspectRatio: '1' }}>
                <div
                  className="flex items-center justify-center rounded-full"
                  style={{ width: '80%', aspectRatio: '1', ...circleStyle }}
                >
                  <span className="text-xs leading-none" style={{ fontSize: 11, ...textStyle }}>
                    {cell.dayNum}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

export default function Consistency({ onBack }) {
  const allWorkouts = useLiveQuery(() => db.workouts.orderBy('date').toArray())

  if (!allWorkouts) {
    return (
      <div className="p-4 flex flex-col items-center justify-center gap-2" style={{ minHeight: 200 }}>
        <div
          className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'rgba(139,92,246,0.3)', borderTopColor: '#8b5cf6' }}
        />
        <span className="text-xs" style={{ color: '#3f3f46' }}>Loading...</span>
      </div>
    )
  }

  const today = isoDate(new Date())
  const workoutDates = new Set(allWorkouts.map(w => w.date))

  // Empty state
  if (workoutDates.size === 0) {
    return (
      <div className="p-4 pb-8">
        <div style={{ height: 'env(safe-area-inset-top, 44px)', minHeight: 44 }} />

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
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
            <div className="font-bold text-lg leading-tight" style={{ color: '#f8f8ff' }}>Consistency</div>
            <div className="text-xs" style={{ color: '#52525b' }}>Your training rhythm and patterns</div>
          </div>
        </div>

        <div
          className="rounded-2xl p-6 flex flex-col items-center text-center gap-3"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="text-4xl">📅</div>
          <div className="font-semibold text-base" style={{ color: '#f8f8ff' }}>No training history yet</div>
          <div className="text-sm leading-relaxed" style={{ color: '#52525b' }}>
            Start logging workouts and your consistency picture will appear here — streaks, patterns, and your full training calendar.
          </div>
        </div>
      </div>
    )
  }

  // Compute metrics
  const { streak, longestStreak } = computeStreaks(workoutDates, today)
  const totalDays = workoutDates.size
  const thisMonthPrefix = today.slice(0, 7)
  const thisMonthDays = [...workoutDates].filter(d => d.startsWith(thisMonthPrefix)).length

  const sortedDates = [...workoutDates].sort()
  const firstDate = sortedDates[0]
  const firstDateObj = new Date(firstDate + 'T12:00:00')
  const todayObj = new Date(today + 'T12:00:00')
  const weeksSinceFirst = Math.max((todayObj - firstDateObj) / (7 * 86400000), 1)
  const avgPerWeek = (totalDays / weeksSinceFirst).toFixed(1)

  // Last 28 days
  const cutoff28 = isoDate(new Date(Date.now() - 27 * 86400000))
  const last28Days = [...workoutDates].filter(d => d >= cutoff28).length

  // Most active weekday (1=Mon … 0=Sun mapped to 0=Mon…6=Sun)
  const weekdayCounts = Array(7).fill(0)
  for (const d of workoutDates) {
    const dow = new Date(d + 'T12:00:00').getDay() // 0=Sun
    const monFirst = (dow + 6) % 7 // 0=Mon
    weekdayCounts[monFirst]++
  }
  const WEEKDAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const mostActiveDayIdx = weekdayCounts.indexOf(Math.max(...weekdayCounts))
  const mostActiveDay = WEEKDAY_LABELS[mostActiveDayIdx]

  // Best month
  const monthCounts = {}
  for (const d of workoutDates) {
    const key = d.slice(0, 7)
    monthCounts[key] = (monthCounts[key] ?? 0) + 1
  }
  const bestMonthKey = Object.entries(monthCounts).sort((a, b) => b[1] - a[1])[0]?.[0]
  const bestMonthCount = monthCounts[bestMonthKey] ?? 0
  const [bmYear, bmMonth] = (bestMonthKey ?? '').split('-')
  const bestMonthLabel = bestMonthKey
    ? `${MONTH_NAMES[parseInt(bmMonth, 10) - 1]} ${bmYear}`
    : '—'

  // Motivational text
  const motivationalText = getMotivationalText(streak, last28Days, parseFloat(avgPerWeek), totalDays)

  // Build current streak dates set
  const currentStreakDates = new Set()
  if (streak > 0) {
    const streakCheck = new Date()
    if (!workoutDates.has(today)) streakCheck.setDate(streakCheck.getDate() - 1)
    for (let i = 0; i < streak; i++) {
      currentStreakDates.add(isoDate(streakCheck))
      streakCheck.setDate(streakCheck.getDate() - 1)
    }
  }

  // Build list of months to show (newest first)
  const months = []
  const firstYear = firstDateObj.getFullYear()
  const firstMonthIdx = firstDateObj.getMonth()
  const todayYear = todayObj.getFullYear()
  const todayMonth = todayObj.getMonth()
  for (let y = todayYear; y >= firstYear; y--) {
    const mStart = y === todayYear ? todayMonth : 11
    const mEnd = y === firstYear ? firstMonthIdx : 0
    for (let m = mStart; m >= mEnd; m--) {
      months.push({ year: y, month: m })
    }
  }

  const heroStats = [
    {
      label: 'Current Streak',
      value: streak,
      unit: streak === 1 ? 'day' : 'days',
      icon: '🔥',
      color: '#f59e0b',
    },
    {
      label: 'Longest Streak',
      value: longestStreak,
      unit: longestStreak === 1 ? 'day' : 'days',
      icon: '🏆',
      color: '#8b5cf6',
    },
    {
      label: 'Total Days',
      value: totalDays,
      unit: null,
      icon: null,
      color: '#10b981',
    },
    {
      label: 'This Month',
      value: thisMonthDays,
      unit: null,
      icon: null,
      color: '#22d3ee',
    },
  ]

  const insightRows = [
    { label: 'Avg per week', value: `${avgPerWeek} / week` },
    { label: 'Most active day', value: mostActiveDay },
    { label: 'Best month', value: `${bestMonthLabel} · ${bestMonthCount} days` },
    { label: 'Last 28 days', value: `${last28Days} of 28 days` },
  ]

  return (
    <div className="p-4 pb-8 space-y-4">
      <div style={{ height: 'env(safe-area-inset-top, 44px)', minHeight: 44 }} />

      {/* Header */}
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
          <div className="font-bold text-lg leading-tight" style={{ color: '#f8f8ff' }}>Consistency</div>
          <div className="text-xs" style={{ color: '#52525b' }}>Your training rhythm and patterns</div>
        </div>
      </div>

      {/* Hero stats 2×2 */}
      <div className="grid grid-cols-2 gap-3">
        {heroStats.map(stat => (
          <div
            key={stat.label}
            className="rounded-2xl p-4"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#3f3f46' }}>
              {stat.label}
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold" style={{ color: stat.color }}>{stat.value}</span>
              {stat.icon && <span className="text-lg">{stat.icon}</span>}
              {stat.unit && <span className="text-xs" style={{ color: '#52525b' }}>{stat.unit}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Motivational callout */}
      <div
        className="rounded-2xl p-4"
        style={{ background: 'rgba(139,92,246,0.10)', border: '1px solid rgba(139,92,246,0.25)' }}
      >
        <p className="text-sm font-medium leading-relaxed" style={{ color: '#c4b5fd' }}>
          {motivationalText}
        </p>
      </div>

      {/* Training Calendar */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#3f3f46' }}>
          Training Calendar
        </div>
        <div className="space-y-3">
          {months.map(({ year, month }) => (
            <MonthCalendar
              key={`${year}-${month}`}
              year={year}
              month={month}
              workoutDates={workoutDates}
              currentStreakDates={currentStreakDates}
              today={today}
            />
          ))}
        </div>
      </div>

      {/* Insights */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#3f3f46' }}>
          Insights
        </div>
        <div
          className="rounded-2xl"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          {insightRows.map((row, i) => (
            <div
              key={row.label}
              className="flex items-center justify-between px-4 py-3"
              style={{
                borderBottom: i < insightRows.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
              }}
            >
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#3f3f46' }}>
                {row.label}
              </span>
              <span className="text-sm font-semibold" style={{ color: '#d4d4d8' }}>
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
