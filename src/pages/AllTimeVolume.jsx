import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'

// ── Helpers ──────────────────────────────────────────────────────────────────

function isoDate(d) { return d.toISOString().slice(0, 10) }

function formatBigNumber(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return Math.round(n).toLocaleString('en-US')
  return Math.round(n).toString()
}

function getWeekStart(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  d.setHours(0, 0, 0, 0)
  return d
}

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const MONTH_FULL  = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MILESTONES  = [50_000, 100_000, 250_000, 500_000, 1_000_000]

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

export default function AllTimeVolume({ onBack }) {
  const allWorkouts  = useLiveQuery(() => db.workouts.orderBy('date').toArray(), [], [])
  const allSets      = useLiveQuery(() => db.sets.toArray(), [], [])
  const allExercises = useLiveQuery(() => db.exercises.toArray(), [], [])

  const today          = isoDate(new Date())
  const currentMonthKey = today.slice(0, 7)

  // Maps
  const exMap = Object.fromEntries(allExercises.map(e => [e.id, e]))
  const volMap = {}
  for (const w of allWorkouts) {
    volMap[w.id] = allSets
      .filter(s => s.workoutId === w.id)
      .reduce((sum, s) => sum + s.weight * s.reps * (exMap[s.exerciseId]?.unilateral ? 2 : 1), 0)
  }

  const totalVolume = Object.values(volMap).reduce((s, v) => s + v, 0)
  const sortedDates = [...new Set(allWorkouts.map(w => w.date))].sort()

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!sortedDates.length) {
    return (
      <div className="p-4 pb-8">
        <div style={{ height: 'env(safe-area-inset-top, 44px)', minHeight: 44 }} />
        <div className="flex items-center gap-3 mb-6">
          <BackButton onBack={onBack} />
          <div>
            <div className="font-bold text-lg leading-tight" style={{ color: '#f8f8ff' }}>All-Time Volume</div>
            <div className="text-xs" style={{ color: '#52525b' }}>Every kilogram you've ever lifted, tracked.</div>
          </div>
        </div>
        <div className="rounded-2xl p-6 flex flex-col items-center text-center gap-3"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="text-4xl">⚡</div>
          <div className="font-semibold text-base" style={{ color: '#f8f8ff' }}>No volume logged yet</div>
          <div className="text-sm leading-relaxed" style={{ color: '#52525b' }}>
            Start logging workouts and your complete volume history will appear here — total weight lifted, monthly breakdowns, and your strongest periods ever.
          </div>
        </div>
      </div>
    )
  }

  // ── Monthly aggregation ────────────────────────────────────────────────────
  const byMonth = {}
  for (const w of allWorkouts) {
    const mk = w.date.slice(0, 7)
    if (!byMonth[mk]) byMonth[mk] = { volume: 0, workouts: 0, dates: new Set() }
    byMonth[mk].volume   += volMap[w.id] || 0
    byMonth[mk].workouts += 1
    byMonth[mk].dates.add(w.date)
  }

  // All months first→current (including empty ones)
  const allMonths = []
  let [fy, fm] = sortedDates[0].slice(0, 7).split('-').map(Number)
  const [cy, cm] = currentMonthKey.split('-').map(Number)
  while (fy < cy || (fy === cy && fm <= cm)) {
    const mk   = `${fy}-${String(fm).padStart(2, '0')}`
    const d    = byMonth[mk] || { volume: 0, workouts: 0, dates: new Set() }
    allMonths.push({
      key: mk, year: fy, month: fm,
      label:     MONTH_SHORT[fm - 1],
      fullLabel: `${MONTH_FULL[fm - 1]} ${fy}`,
      volume:    Math.round(d.volume),
      workouts:  d.workouts,
      days:      d.dates.size,
      isCurrent: mk === currentMonthKey,
    })
    fm++; if (fm > 12) { fm = 1; fy++ }
  }

  const allMonthsDesc = [...allMonths].reverse()
  const maxMonthVol   = Math.max(...allMonths.map(m => m.volume), 1)
  const bestMonth     = allMonths.reduce((b, m) => m.volume > (b?.volume || 0) ? m : b, null)
  const activeMonths  = allMonths.filter(m => m.volume > 0)

  // ── Per-day volume (for best day) ─────────────────────────────────────────
  const volByDay = {}
  for (const w of allWorkouts) {
    volByDay[w.date] = (volByDay[w.date] || 0) + (volMap[w.id] || 0)
  }
  const bestDayEntry = Object.entries(volByDay).reduce((b, e) => e[1] > (b?.[1] || 0) ? e : b, null)
  const bestDayVol   = bestDayEntry ? Math.round(bestDayEntry[1]) : 0
  const bestDayLabel = bestDayEntry
    ? new Date(bestDayEntry[0] + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null

  // ── Weekly avg ────────────────────────────────────────────────────────────
  const firstWeekStart = getWeekStart(new Date(sortedDates[0] + 'T12:00:00'))
  const currentWeekStart = getWeekStart()
  let totalWeeks = 0
  { let c = new Date(firstWeekStart); while (c <= currentWeekStart) { totalWeeks++; c.setDate(c.getDate() + 7) } }
  const avgVolumePerWeek = totalWeeks > 0 ? Math.round(totalVolume / totalWeeks) : 0
  const avgPerSession    = allWorkouts.length > 0 ? Math.round(totalVolume / allWorkouts.length) : 0

  // ── Recent 30 days ────────────────────────────────────────────────────────
  const cutoff30    = isoDate(new Date(Date.now() - 30 * 86400000))
  const recent30Vol = Math.round(allWorkouts.filter(w => w.date >= cutoff30).reduce((s, w) => s + (volMap[w.id] || 0), 0))
  const avgMonthVol = activeMonths.length
    ? Math.round(activeMonths.reduce((s, m) => s + m.volume, 0) / activeMonths.length)
    : 0

  // ── Milestone ─────────────────────────────────────────────────────────────
  const nextMilestone = MILESTONES.find(m => totalVolume < m)
  const prevMilestone = nextMilestone
    ? (MILESTONES[MILESTONES.indexOf(nextMilestone) - 1] || 0)
    : MILESTONES[MILESTONES.length - 1]
  const msPct = nextMilestone
    ? Math.min(((totalVolume - prevMilestone) / (nextMilestone - prevMilestone)) * 100, 100)
    : 100

  // Bar chart: up to last 12 months
  const chartMonths = allMonths.slice(-12)
  const chartMax    = Math.max(...chartMonths.map(m => m.volume), 1)

  // Insights rows
  const insightRows = [
    { label: 'Monthly average', value: `${formatBigNumber(avgMonthVol)} kg`, sub: 'active months' },
    { label: 'Avg / week',      value: `${formatBigNumber(avgVolumePerWeek)} kg`, sub: 'all time' },
    { label: 'Recent 30 days',  value: `${formatBigNumber(recent30Vol)} kg`,
      sub: recent30Vol >= avgMonthVol ? '↑ above monthly avg' : '↓ below monthly avg' },
    { label: 'Training span',   value: `${allMonths.length} mo`, sub: `${sortedDates.length} active days` },
  ]

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 pb-8 space-y-4">
      <div style={{ height: 'env(safe-area-inset-top, 44px)', minHeight: 44 }} />

      {/* Header */}
      <div className="flex items-center gap-3">
        <BackButton onBack={onBack} />
        <div>
          <div className="font-bold text-lg leading-tight" style={{ color: '#f8f8ff' }}>All-Time Volume</div>
          <div className="text-xs" style={{ color: '#52525b' }}>Every kilogram you've ever lifted, tracked.</div>
        </div>
      </div>

      {/* Hero — total volume */}
      <div className="rounded-2xl p-4"
        style={{ background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.18)' }}>
        <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#0891b2' }}>
          Total volume lifted
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-5xl font-black" style={{ color: '#22d3ee' }}>
            {formatBigNumber(Math.round(totalVolume))}
          </span>
          <span className="text-xl font-semibold" style={{ color: '#0891b2' }}>kg</span>
        </div>
        <div className="text-xs mt-1.5" style={{ color: '#0891b2' }}>
          {allWorkouts.length} sessions · {sortedDates.length} training days
        </div>
      </div>

      {/* Supporting stats 2×2 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#3f3f46' }}>Best month</div>
          <div className="text-2xl font-bold" style={{ color: '#f59e0b' }}>{formatBigNumber(bestMonth?.volume || 0)}</div>
          <div className="text-xs mt-0.5" style={{ color: '#52525b' }}>{bestMonth?.fullLabel}</div>
        </div>
        <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#3f3f46' }}>Best day</div>
          <div className="text-2xl font-bold" style={{ color: '#10b981' }}>{formatBigNumber(bestDayVol)}</div>
          <div className="text-xs mt-0.5" style={{ color: '#52525b' }}>{bestDayLabel}</div>
        </div>
        <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#3f3f46' }}>Avg / session</div>
          <div className="text-2xl font-bold" style={{ color: '#c084fc' }}>{formatBigNumber(avgPerSession)}</div>
          <div className="text-xs mt-0.5" style={{ color: '#52525b' }}>kg per workout</div>
        </div>
        <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#3f3f46' }}>Avg / week</div>
          <div className="text-2xl font-bold" style={{ color: '#8b5cf6' }}>{formatBigNumber(avgVolumePerWeek)}</div>
          <div className="text-xs mt-0.5" style={{ color: '#52525b' }}>kg per week</div>
        </div>
      </div>

      {/* Monthly bar chart */}
      <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#3f3f46' }}>
          Monthly volume{chartMonths.length < allMonths.length ? ` · last ${chartMonths.length} months` : ''}
        </div>
        <div className="flex items-end gap-1" style={{ height: 80 }}>
          {chartMonths.map(m => {
            const isBest = bestMonth && m.key === bestMonth.key
            const pct = Math.max((m.volume / chartMax) * 100, m.volume > 0 ? 3 : 0)
            return (
              <div key={m.key} className="flex-1 flex flex-col items-center justify-end" style={{ height: '100%' }}>
                <div className="w-full rounded-sm" style={{
                  height: `${pct}%`,
                  background: m.isCurrent
                    ? 'linear-gradient(180deg, #22d3ee, #0891b2)'
                    : isBest
                    ? '#f59e0b'
                    : 'rgba(139,92,246,0.30)',
                  minHeight: m.volume > 0 ? 3 : 0,
                }} />
              </div>
            )
          })}
        </div>
        <div className="flex gap-1 mt-1.5">
          {chartMonths.map(m => (
            <div key={m.key} className="flex-1 text-center" style={{
              fontSize: 8,
              color: m.isCurrent ? '#22d3ee' : '#3f3f46',
              fontWeight: m.isCurrent ? 700 : 400,
            }}>
              {m.label}
            </div>
          ))}
        </div>
        {/* Legend */}
        <div className="flex gap-3 mt-2.5">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm" style={{ background: 'rgba(139,92,246,0.50)' }} />
            <span style={{ fontSize: 10, color: '#52525b' }}>Month</span>
          </div>
          {bestMonth && !bestMonth.isCurrent && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm" style={{ background: '#f59e0b' }} />
              <span style={{ fontSize: 10, color: '#52525b' }}>Best</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm" style={{ background: '#22d3ee' }} />
            <span style={{ fontSize: 10, color: '#52525b' }}>Current</span>
          </div>
        </div>
      </div>

      {/* Milestone */}
      {nextMilestone && (
        <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#3f3f46' }}>
            Next milestone
          </div>
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-lg font-bold" style={{ color: '#f8f8ff' }}>
              {formatBigNumber(nextMilestone)} kg
            </span>
            <span className="text-xs" style={{ color: '#52525b' }}>
              {formatBigNumber(Math.round(nextMilestone - totalVolume))} kg to go
            </span>
          </div>
          <div className="rounded-full overflow-hidden" style={{ height: 6, background: 'rgba(255,255,255,0.08)' }}>
            <div className="h-full rounded-full" style={{
              width: `${msPct}%`,
              background: 'linear-gradient(90deg, #7c3aed, #22d3ee)',
            }} />
          </div>
          <div className="text-xs mt-1.5" style={{ color: '#52525b' }}>
            {Math.round(msPct)}% there
          </div>
        </div>
      )}

      {/* Monthly history */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#3f3f46' }}>
          Monthly history
        </div>
        <div className="space-y-2">
          {allMonthsDesc.map((m, i) => {
            const prev    = allMonthsDesc[i + 1]
            const trend   = prev?.volume > 0
              ? Math.round(((m.volume - prev.volume) / prev.volume) * 100)
              : null
            const isBest  = bestMonth && m.key === bestMonth.key
            const barPct  = Math.max((m.volume / maxMonthVol) * 100, m.volume > 0 ? 3 : 0)

            return (
              <div key={m.key} className="rounded-2xl px-4 py-3" style={{
                background: m.isCurrent ? 'rgba(34,211,238,0.07)' : 'rgba(255,255,255,0.03)',
                border:     m.isCurrent ? '1px solid rgba(34,211,238,0.20)' : '1px solid rgba(255,255,255,0.06)',
              }}>
                {/* Row 1 */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-semibold" style={{ color: m.isCurrent ? '#22d3ee' : '#d4d4d8' }}>
                      {m.fullLabel}
                    </span>
                    {m.isCurrent && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full"
                        style={{ background: 'rgba(34,211,238,0.15)', color: '#22d3ee' }}>
                        Current
                      </span>
                    )}
                    {isBest && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full"
                        style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
                        Best
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {trend !== null && m.volume > 0 && (
                      <span className="text-xs font-semibold" style={{ color: trend >= 0 ? '#10b981' : '#f43f5e' }}>
                        {trend >= 0 ? '▲' : '▼'}{Math.abs(trend)}%
                      </span>
                    )}
                    {m.volume === 0 && (
                      <span className="text-xs" style={{ color: '#3f3f46' }}>rest</span>
                    )}
                  </div>
                </div>

                {m.volume > 0 && (
                  <>
                    {/* Row 2: volume + stats */}
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold" style={{ color: m.isCurrent ? '#22d3ee' : '#71717a' }}>
                        {formatBigNumber(m.volume)} kg
                      </span>
                      <span className="text-xs" style={{ color: '#52525b' }}>
                        {m.workouts} {m.workouts === 1 ? 'session' : 'sessions'} · {m.days} {m.days === 1 ? 'day' : 'days'}
                      </span>
                    </div>
                    {/* Volume bar */}
                    <div className="rounded-full overflow-hidden" style={{ height: 3, background: 'rgba(255,255,255,0.06)' }}>
                      <div className="h-full rounded-full" style={{
                        width: `${barPct}%`,
                        background: m.isCurrent
                          ? 'linear-gradient(90deg, #0891b2, #22d3ee)'
                          : isBest
                          ? '#f59e0b'
                          : 'rgba(139,92,246,0.45)',
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
    </div>
  )
}
