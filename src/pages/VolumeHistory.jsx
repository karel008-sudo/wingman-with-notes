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

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function weekRangeLabel(ws, we) {
  const s = new Date(ws + 'T12:00:00'), e = new Date(we + 'T12:00:00')
  const sm = MONTH_SHORT[s.getMonth()], em = MONTH_SHORT[e.getMonth()]
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

// ── Main ─────────────────────────────────────────────────────────────────────

export default function VolumeHistory({ onBack }) {
  const allWorkouts  = useLiveQuery(() => db.workouts.orderBy('date').toArray(), [], [])
  const allSets      = useLiveQuery(() => db.sets.toArray(), [], [])
  const allExercises = useLiveQuery(() => db.exercises.toArray(), [], [])

  const today      = isoDate(new Date())
  const weekStart  = getWeekStart()
  const wsIso      = isoDate(weekStart)

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
            <div className="font-bold text-lg leading-tight" style={{ color: '#f8f8ff' }}>Weekly Volume</div>
            <div className="text-xs" style={{ color: '#52525b' }}>Your training load, week by week.</div>
          </div>
        </div>
        <div className="rounded-2xl p-6 flex flex-col items-center text-center gap-3"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="text-4xl">📊</div>
          <div className="font-semibold text-base" style={{ color: '#f8f8ff' }}>No volume data yet</div>
          <div className="text-sm leading-relaxed" style={{ color: '#52525b' }}>
            Log your first workout and your complete weekly volume history will appear here — training load, trends, and your strongest periods.
          </div>
        </div>
      </div>
    )
  }

  // ── Build all weeks first→current ──────────────────────────────────────────
  const firstWeekStart = getWeekStart(new Date(sortedDates[0] + 'T12:00:00'))
  const allWeeks = []
  let cur = new Date(firstWeekStart)
  while (cur <= weekStart) {
    const ws = isoDate(cur)
    const weDate = new Date(cur); weDate.setDate(weDate.getDate() + 6)
    const we = isoDate(weDate)
    const weekWorkouts = allWorkouts.filter(w => w.date >= ws && w.date <= we)
    const volume = Math.round(weekWorkouts.reduce((s, w) => s + (volMap[w.id] || 0), 0))
    const dateDays = new Set(weekWorkouts.map(w => w.date))
    allWeeks.push({
      ws, we, label: weekRangeLabel(ws, we),
      volume, workouts: weekWorkouts.length, days: dateDays.size,
      isCurrent: ws === wsIso,
    })
    cur.setDate(cur.getDate() + 7)
  }

  const allWeeksDesc  = [...allWeeks].reverse()
  const activeWeeks   = allWeeks.filter(w => w.volume > 0)
  const bestWeek      = allWeeks.reduce((b, w) => w.volume > (b?.volume || 0) ? w : b, null)
  const maxVolume     = Math.max(...allWeeks.map(w => w.volume), 1)

  const currentWeek   = allWeeks[allWeeks.length - 1]
  const lastWeek      = allWeeks[allWeeks.length - 2] || null
  const volumeDiff    = lastWeek?.volume > 0
    ? Math.round(((currentWeek.volume - lastWeek.volume) / lastWeek.volume) * 100)
    : null

  // 8-week average (last 8 non-empty or all)
  const last8 = allWeeks.slice(-8)
  const avg8  = last8.length ? Math.round(last8.reduce((s, w) => s + w.volume, 0) / last8.length) : 0

  // Overall avg across active weeks
  const avgAll = activeWeeks.length
    ? Math.round(activeWeeks.reduce((s, w) => s + w.volume, 0) / activeWeeks.length)
    : 0

  // Recent 4w vs previous 4w
  const recent4  = allWeeks.slice(-4)
  const prev4    = allWeeks.slice(-8, -4)
  const avg4r    = recent4.length ? Math.round(recent4.reduce((s, w) => s + w.volume, 0) / recent4.length) : 0
  const avg4p    = prev4.length  ? Math.round(prev4.reduce((s, w) => s + w.volume, 0) / prev4.length)  : 0
  const trend4   = avg4p > 0 ? Math.round(((avg4r - avg4p) / avg4p) * 100) : null

  // Pct of active weeks above all-time avg
  const aboveAvg = activeWeeks.filter(w => w.volume > avgAll)
  const pctAbove = activeWeeks.length ? Math.round((aboveAvg.length / activeWeeks.length) * 100) : 0

  // Motivational callout
  const motivational = (() => {
    if (bestWeek?.isCurrent) return `Strongest week yet at ${formatBigNumber(currentWeek.volume)} kg. Keep pushing.`
    if (volumeDiff !== null && volumeDiff > 15) return `Up ${volumeDiff}% vs last week. Load is building.`
    if (trend4 !== null && trend4 > 0) return `Last 4 weeks trending +${trend4}% vs the 4 before. Good momentum.`
    if (currentWeek.volume > avg8 && avg8 > 0) return `This week is above your 8-week average. Solid effort.`
    if (activeWeeks.length >= 6) return `${activeWeeks.length} active weeks logged. Volume builds over time.`
    return `${formatBigNumber(Math.round(activeWeeks.reduce((s, w) => s + w.volume, 0)))} kg across ${activeWeeks.length} active weeks.`
  })()

  // Chart: show up to last 16 weeks (or all if fewer)
  const chartWeeks = allWeeks.slice(-16)
  const chartMax   = Math.max(...chartWeeks.map(w => w.volume), 1)

  const insightRows = [
    { label: 'Strongest week',     value: `${formatBigNumber(bestWeek?.volume || 0)} kg`, sub: bestWeek?.label },
    { label: 'All-time avg / wk',  value: `${formatBigNumber(avgAll)} kg`, sub: `${activeWeeks.length} active weeks` },
    { label: 'Recent 4w avg',      value: `${formatBigNumber(avg4r)} kg`,
      sub: trend4 !== null ? (trend4 >= 0 ? `▲ ${trend4}% vs prev 4w` : `▼ ${Math.abs(trend4)}% vs prev 4w`) : 'baseline' },
    { label: 'Above avg weeks',    value: `${pctAbove}%`, sub: `of ${activeWeeks.length} active weeks` },
  ]

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 pb-8 space-y-4">
      <div style={{ height: 'env(safe-area-inset-top, 44px)', minHeight: 44 }} />

      {/* Header */}
      <div className="flex items-center gap-3">
        <BackButton onBack={onBack} />
        <div>
          <div className="font-bold text-lg leading-tight" style={{ color: '#f8f8ff' }}>Weekly Volume</div>
          <div className="text-xs" style={{ color: '#52525b' }}>Your training load, week by week.</div>
        </div>
      </div>

      {/* Hero 2×2 */}
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
        </div>

        <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#3f3f46' }}>8-wk avg</div>
          <div className="text-3xl font-bold" style={{ color: '#f59e0b' }}>{formatBigNumber(avg8)}</div>
          <div className="text-xs mt-0.5" style={{ color: '#52525b' }}>kg per week</div>
          {currentWeek.volume > 0 && avg8 > 0 && (
            <div className="text-xs mt-2" style={{ color: currentWeek.volume >= avg8 ? '#10b981' : '#52525b' }}>
              {currentWeek.volume >= avg8 ? '↑ above avg' : '↓ below avg'}
            </div>
          )}
        </div>

        <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#3f3f46' }}>Best week</div>
          <div className="text-3xl font-bold" style={{ color: '#10b981' }}>{formatBigNumber(bestWeek?.volume || 0)}</div>
          <div className="text-xs mt-0.5" style={{ color: '#52525b' }}>{bestWeek?.label}</div>
        </div>

        <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#3f3f46' }}>Active weeks</div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold" style={{ color: '#22d3ee' }}>{activeWeeks.length}</span>
            <span className="text-sm" style={{ color: '#52525b' }}>/ {allWeeks.length}</span>
          </div>
          <div className="text-xs mt-0.5" style={{ color: '#52525b' }}>total weeks</div>
        </div>
      </div>

      {/* Motivational callout */}
      <div className="rounded-2xl p-4" style={{ background: 'rgba(139,92,246,0.10)', border: '1px solid rgba(139,92,246,0.25)' }}>
        <p className="text-sm font-medium leading-relaxed" style={{ color: '#c4b5fd' }}>{motivational}</p>
      </div>

      {/* Full-history bar chart */}
      <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#3f3f46' }}>
          Volume history{chartWeeks.length < allWeeks.length ? ` · last ${chartWeeks.length} weeks` : ''}
        </div>
        <div className="flex items-end gap-0.5" style={{ height: 96 }}>
          {chartWeeks.map((w, i) => {
            const isBest = bestWeek && w.ws === bestWeek.ws
            const pct = Math.max((w.volume / chartMax) * 100, w.volume > 0 ? 3 : 0)
            return (
              <div key={w.ws} className="flex-1 flex flex-col items-center justify-end" style={{ height: '100%' }}>
                <div className="w-full rounded-sm" style={{
                  height: `${pct}%`,
                  background: w.isCurrent
                    ? 'linear-gradient(180deg, #8b5cf6, #6d28d9)'
                    : isBest
                    ? '#f59e0b'
                    : w.volume > avg8 && avg8 > 0
                    ? 'rgba(139,92,246,0.50)'
                    : 'rgba(139,92,246,0.22)',
                  minHeight: w.volume > 0 ? 3 : 0,
                }} />
              </div>
            )
          })}
        </div>
        {/* Avg line indicator */}
        {avg8 > 0 && (
          <div className="relative mt-1" style={{ height: 1 }}>
            <div className="absolute inset-x-0" style={{
              height: 1,
              bottom: `${Math.round((avg8 / chartMax) * 96)}px`,
              background: 'rgba(245,158,11,0.35)',
              position: 'absolute',
            }} />
          </div>
        )}
        <div className="flex justify-between mt-2">
          <span className="text-xs" style={{ color: '#3f3f46' }}>
            {chartWeeks[0]?.label}
          </span>
          <span className="text-xs font-semibold" style={{ color: '#8b5cf6' }}>this week</span>
        </div>
        {/* Legend */}
        <div className="flex gap-3 mt-1.5">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm" style={{ background: 'rgba(139,92,246,0.22)' }} />
            <span style={{ fontSize: 10, color: '#52525b' }}>Week</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm" style={{ background: 'rgba(139,92,246,0.50)' }} />
            <span style={{ fontSize: 10, color: '#52525b' }}>Above 8-wk avg</span>
          </div>
          {bestWeek && !bestWeek.isCurrent && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm" style={{ background: '#f59e0b' }} />
              <span style={{ fontSize: 10, color: '#52525b' }}>Best</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm" style={{ background: '#6d28d9' }} />
            <span style={{ fontSize: 10, color: '#52525b' }}>Current</span>
          </div>
        </div>
      </div>

      {/* Weekly archive */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#3f3f46' }}>
          Weekly history
        </div>
        <div className="space-y-2">
          {allWeeksDesc.map((w, i) => {
            const next     = allWeeksDesc[i + 1]
            const trend    = next?.volume > 0
              ? Math.round(((w.volume - next.volume) / next.volume) * 100)
              : null
            const isBest   = bestWeek && w.ws === bestWeek.ws
            const isAbove  = avgAll > 0 && w.volume > avgAll
            const barPct   = Math.max((w.volume / maxVolume) * 100, w.volume > 0 ? 3 : 0)

            return (
              <div key={w.ws} className="rounded-2xl px-4 py-3" style={{
                background: w.isCurrent ? 'rgba(139,92,246,0.08)' : 'rgba(255,255,255,0.03)',
                border:     w.isCurrent ? '1px solid rgba(139,92,246,0.25)' : '1px solid rgba(255,255,255,0.06)',
              }}>
                {/* Row 1: label + badges + trend */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-semibold" style={{ color: w.isCurrent ? '#c4b5fd' : '#d4d4d8' }}>
                      {w.label}
                    </span>
                    {w.isCurrent && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full"
                        style={{ background: 'rgba(139,92,246,0.20)', color: '#a78bfa' }}>
                        Current
                      </span>
                    )}
                    {isBest && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full"
                        style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
                        Best {w.isCurrent ? '🔥' : ''}
                      </span>
                    )}
                    {isAbove && !isBest && !w.isCurrent && (
                      <span className="text-xs" style={{ color: '#52525b' }}>↑</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {trend !== null && w.volume > 0 && (
                      <span className="text-xs font-semibold" style={{ color: trend >= 0 ? '#10b981' : '#f43f5e' }}>
                        {trend >= 0 ? '▲' : '▼'}{Math.abs(trend)}%
                      </span>
                    )}
                    {w.volume === 0 && <span className="text-xs" style={{ color: '#3f3f46' }}>rest</span>}
                  </div>
                </div>

                {w.volume > 0 && (
                  <>
                    {/* Row 2: volume + sessions/days */}
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-bold" style={{ color: w.isCurrent ? '#c4b5fd' : '#71717a' }}>
                        {formatBigNumber(w.volume)} kg
                      </span>
                      <span className="text-xs" style={{ color: '#52525b' }}>
                        {w.workouts} {w.workouts === 1 ? 'session' : 'sessions'} · {w.days} {w.days === 1 ? 'day' : 'days'}
                      </span>
                    </div>
                    {/* Volume bar */}
                    <div className="rounded-full overflow-hidden" style={{ height: 3, background: 'rgba(255,255,255,0.06)' }}>
                      <div className="h-full rounded-full" style={{
                        width: `${barPct}%`,
                        background: w.isCurrent
                          ? 'linear-gradient(90deg, #7c3aed, #8b5cf6)'
                          : isBest
                          ? '#f59e0b'
                          : isAbove
                          ? 'rgba(139,92,246,0.55)'
                          : 'rgba(139,92,246,0.30)',
                      }} />
                    </div>
                  </>
                )}
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
              <div key={row.label} className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: i < insightRows.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
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
