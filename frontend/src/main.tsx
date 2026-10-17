import { Component, StrictMode, type ErrorInfo, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Shows a message instead of a blank page if rendering throws.
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('StepSafe crashed:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div role="alert" style={{ padding: 24, color: '#f1f5f9', fontFamily: 'sans-serif' }}>
        <h1>Something went wrong</h1>
        <p>StepSafe hit an error and could not display this screen. Try reloading the page.</p>
        <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.error.message}</pre>
      </div>
    )
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
