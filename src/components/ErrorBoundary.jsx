import { Component } from 'react'
import { logger } from '../logger'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    logger.error('react', 'Rendering crash', {
      message: error.message,
      stack: error.stack?.slice(0, 600),
      component: info.componentStack?.slice(0, 400),
    })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="flex flex-col items-center justify-center px-6 text-center"
          style={{ minHeight: '100dvh', background: '#0b0b11' }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.25)' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div className="text-lg font-bold mb-1" style={{ color: '#f8f8ff' }}>Something went wrong</div>
          <div className="text-sm mb-6" style={{ color: '#52525b' }}>
            Your workout data is safe. The error has been logged.
          </div>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="px-6 py-3 rounded-2xl font-semibold text-sm"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #9333ea)', color: '#fff' }}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
