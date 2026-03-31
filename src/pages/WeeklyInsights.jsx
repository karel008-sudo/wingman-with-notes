import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'

// ── Helpers ──────────────────────────────────────────────────────────────────

function isoDate(d) { return d.toISOString().slice(0, 10) }

function getWeekStart(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  d.setHours(0, 0, 0, 0)
  return d
}

function formatBigNumber(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return Math.round(n).toLocaleString('en-US')
  return Math.round(n).toString()
}

const MONTH = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAY_INITIALS = ['M','T','W','T','F','S','S']

function weekRangeLabel(ws, we) {
  const s = new Date(ws + 'T12:00:00'), e = new Date(we + 'T12:00:00')
  const sm = MONTH[s.getMonth()], em = MONTH[e.getMonth()]
  if (sm === em) return `${sm} ${s.getDate()}–${e.getDate()}`
  return `${sm} ${s.getDate()} – ${em} ${e.getDate()}`
}

function BackButton({ onBack }) {
  return (
    <button
      onClick={onBack}
      className="flex items-center justify-center w-9 h-9 rounded-xl transition-opacity active:opacity-60"
      style={{ background: 'rgba(255,255,255,0.06)', color: '#a78bfa' }}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function WeeklyInsights({ onBack }) {
  const allWorkouts  = useLiveQuery(() => db.workouts.orderBy('date').toArray(), [], [])
  const allSets      = useLiveQuery(() => db.sets.toArray(), [], [])
  const allExercises = useLiveQuery(() => db.exercises.toArray(), [], [])

  const today     = isoDate(new Date())
  const weekStart = getWeekStart()
  const wsIso     = isoDate(weekStart)

  // Build maps
  const exMap = Object.fromEntries(allExercises.map(e => [e.id, e]))
  const volMap = {}
  for (const w of allWorkouts) {
    volMap[w.id] = allSets
      .filter(s => s.workoutId === w.id)
      .reduce((sum, s) => sum + s.weight * s.reps * (exMap[s.exerciseId]?.unilateral ? 2 : 1), 0)
  }

  const sortedDates = [...new Set(allWorkouts.map(w => w.date))].sort()

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!sortedDates.length) {
    return (
      <div className="p-4 pb-8">
        <div style={{ height: 'env(safe-area-inset-top, 44px)', minHeight: 44 }} />
        <div className="flex items-center gap-3 mb-6">
          <BackButton onBack={onBack} />
          <div>
            <div className="font-bold text-lg leading-tight" style={{ color: '#f8f8ff' }}>Weekly Insights</div>
            <div className="text-xs" style={{ color: '#52525b' }}>Your training rhythm, week by week</div>
          </div>
        </div>
        <div className="rounded-2xl p-6 flex flex-col items-center text-center gap-3"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="text-4xl">📊</div>
          <div className="font-semibold text-base" style={{ color: '#f8f8ff' }}>No training weeks yet</div>
          <div className="text-sm leading-relaxed" style={{ color: '#52525b' }}>
            Log your first workout and your weekly training history will appear here — volumes, patterns, and your week-by-week progress.
          </div>
        </div>
      </div>
    )
  }

  // ── Build weekly data ──────────────────────────────────────────────────────
  const firstWeekStart = getWeekStart(new Date(sortedDates[0] + 'T12:00:00'))
  const allWeeks = []

  let cur = new Date(weekStart)
  while (cur >= firstWeekStart) {
    const ws = isoDate(cur)
    const weDate = new Date(cur); weDate.setDate(weDate.getDate() + 6)
    const we = isoDate(weDate)
    const weekWorkouts = allWorkouts.filter(w => w.date >= ws && w.date <= we)
    const volume = weekWorkouts.reduce((s, w) => s + (volMap[w.id] || 0), 0)
    const wDateSet = new Set(weekWorkouts.map(w => w.date))

    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(cur); d.setDate(d.getDate() + i)
      const iso = isoDate(d)
      return { iso, has: wDateSet.has(iso), future: iso > today, today: iso === today }
    })

    allWeeks.push({ ws, we, label: weekRangeLabel(ws, we), volume, count: weekWorkouts.length, days, isCurrent: ws === wsIso })
    cur.setDate(cur.getDate() - 7)
  }

  // ── Derived stats ──────────────────────────────────────────────────────────
  const currentWeek    = allWeeks[0]
  const lastWeek       = allWeeks[1] || null
  const activeWeeks    = allWeeks.filter(w => w.count > 0)
  const bestWeek       = allWeeks.reduce((b, w) => w.volume > (b?.volume || 0) ? w : b, null)
  const maxVolume      = Math.max(...allWeeks.map(w => w.volume), 1)
  const avgSessions    = (sortedDates.length / allWeeks.length).toFixed(1)
  const last4Active    = activeWeeks.slice(0, 4)
  const avgLast4Vol    = last4Active.length ? Math.round(last4Active.reduce((s, w) => s + w.volume, 0) / last4Active.length) : 0
  const consistency    = Math.round((activeWeeks.length / allWeeks.length) * 100)
  const volumeDiff     = lastWeek?.volume > 0
    ? Math.round(((currentWeek.volume - lastWeek.volume) / lastWeek.volume) * 100)
    : null

  const thisWeekDayCount = currentWeek.days.filter(d => d.has).length
  const motivational = (() => {
    if (thisWeekDayCount >= 4) return `${thisWeekDayCount} days trained this week. Outstanding.`
    if (thisWeekDayCount >= 3) return `${thisWeekDayCount} days in. Solid week in progress.`
    if (volumeDiff !== null && volumeDiff > 0) return `Up ${volumeDiff}% on volume vs last week.`
    if (activeWeeks.length >= 6) return `${activeWeeks.length} active weeks logged. Consistency wins.`
    return `${allWorkouts.length} total sessions. Every week builds the pattern.`
  })()

  const insightRows = [
    { label: 'Best week', value: bestWeek ? `${formatBigNumber(bestWeek.volume)} kg` : '—', sub: bestWeek?.label },
    { label: 'Avg volume (last 4)', value: `${formatBigNumber(avgLast4Vol)} kg`, sub: 'per active week' },
    { label: 'Avg days / wk', value: `${avgSessions}`, sub: `over ${allWeeks.length} weeks` },
    { label: 'Consistency', value: `${consistency}%`, sub: 'weeks with training' },
  ]

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 pb-8 space-y-4">
      <div style={{ height: 'env(safe-area-inset-top, 44px)', minHeight: 44 }} />

      {/* Header */}
      <div className="flex items-center gap-3">
        <BackButton onBack={onBack} />
        <div>
          <div className="font-bold text-lg leading-tight" style={{ color: '#f8f8ff' }}>Weekly Insights</div>
          <div className="text-xs" style={{ color: '#52525b' }}>Your training rhythm, week by week</div>
        </div>
      </div>

      {/* Hero stats 2×2 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#3f3f46' }}>This week</div>
          <div className="text-3xl font-bold" style={{ color: '#c084fc' }}>{formatBigNumber(currentWeek.volume)}</div>
          <div className="text-xs mt-0.5" style={{ color: '#52525b' }}>kg lifted</div>
          {volumeDiff !== null && (
            <div className="text-xs mt-2 font-semibold" style={{ color: volumeDiff >= 0 ? '#10b981' : '#f43f5e' }}>
              {volumeDiff >= 0 ? '▲' : '▼'} {Math.abs(volumeDiff)}% vs last
            </div>
          )}
          {volumeDiff === null && lastWeek && lastWeek.volume === 0 && (
            <div className="text-xs mt-2" style={{ color: '#3f3f46' }}>rest week before</div>
          )}
        </div>

        <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#3f3f46' }}>Days trained</div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold" style={{ color: '#22d3ee' }}>{currentWeek.days.filter(d => d.has).length}</span>
            <span className="text-sm" style={{ color: '#52525b' }}>/ 7</span>
          </div>
          <div className="text-xs mt-0.5" style={{ color: '#52525b' }}>this week</div>
        </div>

        <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#3f3f46' }}>Active weeks</div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold" style={{ color: '#10b981' }}>{activeWeeks.length}</span>
            <span className="text-sm" style={{ color: '#52525b' }}>/ {allWeeks.length}</span>
          </div>
          <div className="text-xs mt-0.5" style={{ color: '#52525b' }}>total</div>
        </div>

        <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#3f3f46' }}>Avg / week</div>
          <div className="text-3xl font-bold" style={{ color: '#f59e0b' }}>{avgSessions}</div>
          <div className="text-xs mt-0.5" style={{ color: '#52525b' }}>days/wk</div>
        </div>
      </div>

      {/* Motivational callout */}
      <div className="rounded-2xl p-4" style={{ background: 'rgba(139,92,246,0.10)', border: '1px solid rgba(139,92,246,0.25)' }}>
        <p className="text-sm font-medium leading-relaxed" style={{ color: '#c4b5fd' }}>{motivational}</p>
      </div>

      {/* Weekly archive */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#3f3f46' }}>
          Training History
        </div>
        <div className="space-y-2">
          {allWeeks.map(week => {
            const isBest = bestWeek && week.ws === bestWeek.ws && week.volume > 0
            const barPct = maxVolume > 0 ? Math.max((week.volume / maxVolume) * 100, week.volume > 0 ? 3 : 0) : 0

            return (
              <div
                key={week.ws}
                className="rounded-2xl p-3"
                style={{
                  background: week.isCurrent ? 'rgba(139,92,246,0.10)' : 'rgba(255,255,255,0.04)',
                  border: week.isCurrent ? '1px solid rgba(139,92,246,0.28)' : '1px solid rgba(255,255,255,0.07)',
                }}
              >
                {/* Row 1: label + badges */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold" style={{ color: week.isCurrent ? '#c4b5fd' : '#d4d4d8' }}>
                    {week.label}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {week.isCurrent && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(139,92,246,0.20)', color: '#a78bfa' }}>
                        This week
                      </span>
                    )}
                    {isBest && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
                        Best {week.isCurrent ? '🔥' : ''}
                      </span>
                    )}
                    {week.days === 0 ? (
                      <span className="text-xs" style={{ color: '#3f3f46' }}>rest</span>
                    ) : (
                      <span className="text-xs" style={{ color: '#52525b' }}>
                        {week.days} {week.days === 1 ? 'day' : 'days'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Row 2: volume bar */}
                {week.volume > 0 && (
                  <div className="mb-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold" style={{ color: week.isCurrent ? '#c4b5fd' : '#71717a' }}>
                        {formatBigNumber(week.volume)} kg
                      </span>
                    </div>
                    <div className="rounded-full overflow-hidden" style={{ height: 3, background: 'rgba(255,255,255,0.06)' }}>
                      <div className="h-full rounded-full" style={{
                        width: `${barPct}%`,
                        background: week.isCurrent
                          ? 'linear-gradient(90deg, #7c3aed, #a78bfa)'
                          : isBest
                          ? '#f59e0b'
                          : 'rgba(139,92,246,0.40)',
                      }} />
                    </div>
                  </div>
                )}

                {/* Row 3: day dots Mo–Su */}
                <div className="flex gap-1">
                  {week.days.map((day, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                      <div className="rounded-full" style={{
                        width: 6, height: 6,
                        background: day.has
                          ? (week.isCurrent ? '#8b5cf6' : 'rgba(139,92,246,0.55)')
                          : day.future
                          ? 'transparent'
                          : day.today
                          ? 'rgba(139,92,246,0.22)'
                          : 'rgba(255,255,255,0.07)',
                        outline: day.today && !day.has ? '1px solid rgba(139,92,246,0.45)' : 'none',
                      }} />
                      <span style={{ fontSize: 7, color: '#2d2d35', lineHeight: 1 }}>
                        {DAY_INITIALS[i]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Insights */}
      {activeWeeks.length > 1 && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#3f3f46' }}>
            Insights
          </div>
          <div className="rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            {insightRows.map((row, i) => (
              <div
                key={row.label}
                className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: i < insightRows.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
              >
                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#3f3f46' }}>
                  {row.label}
                </span>
                <div className="text-right">
                  <span className="text-sm font-semibold" style={{ color: '#d4d4d8' }}>{row.value}</span>
                  {row.sub && <span className="text-xs ml-1.5" style={{ color: '#52525b' }}>{row.sub}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
