import { useState, useEffect } from 'react'
import Dashboard from './pages/Dashboard'
import Log from './pages/Log'
import History from './pages/History'
import Reports from './pages/Reports'
import Exercises from './pages/Exercises'
import AbsolutePRs from './pages/AbsolutePRs'
import Consistency from './pages/Consistency'
import LogViewer from './pages/LogViewer'

const TABS = [
  {
    id: 'dashboard',
    label: 'Overview',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    id: 'log',
    label: 'Workout',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M6 5v14M18 5v14M3 8h3M18 8h3M3 16h3M18 16h3M6 12h12" />
      </svg>
    ),
  },
  {
    id: 'history',
    label: 'History',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    id: 'reports',
    label: 'Charts',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
        <polyline points="16 7 22 7 22 13" />
      </svg>
    ),
  },
  {
    id: 'absolute-prs',
    label: 'PRs',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
      </svg>
    ),
  },
  {
    id: 'exercises',
    label: 'Exercises',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" />
        <line x1="3" y1="12" x2="3.01" y2="12" />
        <line x1="3" y1="18" x2="3.01" y2="18" />
      </svg>
    ),
  },
]

export default function App() {
  const [tab, setTab] = useState('dashboard')
  const [subView, setSubView] = useState(null)
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return (
    <div
      className="flex flex-col max-w-lg mx-auto"
      style={{
        background: '#0b0b11',
        color: '#f8f8ff',
        height: '100dvh',
      }}
    >
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {/* Safe-area spacer — pushes content below the Dynamic Island / notch / status bar */}
        <div style={{ height: 'env(safe-area-inset-top, 44px)', minHeight: 44 }} />
{!isOnline && (
          <div className="flex items-center gap-2 px-4 py-2 text-xs font-medium"
            style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', borderBottom: '1px solid rgba(245,158,11,0.2)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
              <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
              <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
              <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
              <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
              <line x1="12" y1="20" x2="12.01" y2="20" />
            </svg>
            Offline — changes saved locally
          </div>
        )}
        {tab === 'dashboard' && <Dashboard onStartWorkout={() => setTab('log')} onOpenConsistency={() => setSubView('consistency')} />}
        {tab === 'log' && <Log />}
        {tab === 'history' && <History />}
        {tab === 'reports' && <Reports />}
        {tab === 'absolute-prs' && <AbsolutePRs />}
        {tab === 'exercises' && <Exercises onOpenLogs={() => setSubView('logs')} />}
      </div>

      {subView === 'consistency' && (
        <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: '#0b0b11' }}>
          <Consistency onBack={() => setSubView(null)} />
        </div>
      )}
      {subView === 'logs' && (
        <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: '#0b0b11' }}>
          <LogViewer onBack={() => setSubView(null)} />
        </div>
      )}

      <nav
        className="flex"
        style={{
          background: 'rgba(0,0,0,0.80)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {TABS.map(t => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex-1 flex flex-col items-center gap-0.5 py-1.5 transition-colors"
              style={{ color: active ? '#8b5cf6' : '#52525b', minWidth: 0 }}
            >
              {t.icon}
              <span
                className="text-xs font-medium leading-none truncate w-full text-center"
                style={{ fontSize: 10 }}
              >
                {t.label}
              </span>
              <span
                className="rounded-full transition-all duration-200"
                style={{
                  width: active ? 16 : 4,
                  height: 2,
                  marginTop: 2,
                  background: active ? '#8b5cf6' : 'transparent',
                }}
              />
            </button>
          )
        })}
      </nav>
    </div>
  )
}
