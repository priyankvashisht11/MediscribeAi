import { lazy, Suspense, useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DoctorsProvider } from './context/DoctorsContext'
import AppShell from './components/AppShell'
import Dashboard from './pages/Dashboard'
import NewSession from './pages/NewSession'
import ActiveSession from './pages/ActiveSession'
import SessionHistory from './pages/SessionHistory'
import NotFound from './pages/NotFound'
import PinGate from './pages/PinGate'

const NoteReview       = lazy(() => import('./pages/NoteReview'))
const TranscriptViewer = lazy(() => import('./pages/TranscriptViewer'))
const DoctorsPage      = lazy(() => import('./pages/Doctors'))
const Settings         = lazy(() => import('./pages/Settings'))
const Analytics        = lazy(() => import('./pages/Analytics'))
const Help             = lazy(() => import('./pages/Help'))

function PageLoader() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100%', minHeight: '200px',
      color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)',
    }}>
      Loading…
    </div>
  )
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
})

function _tokenValid() {
  try {
    const t = localStorage.getItem('mediscribe_token')
    if (!t) return false
    const { exp } = JSON.parse(atob(t.split('.')[1]))
    return exp * 1000 > Date.now()
  } catch { return false }
}

function useAuth() {
  const [authed, setAuthed] = useState(false)
  const [checking, setChecking] = useState(true)
  useEffect(() => {
    setAuthed(_tokenValid())
    setChecking(false)
    const handler = () => { setAuthed(_tokenValid()) }
    window.addEventListener('mediscribe_auth_change', handler)
    return () => window.removeEventListener('mediscribe_auth_change', handler)
  }, [])
  return { authed, checking, onSuccess: () => setAuthed(true) }
}

export default function App() {
  const { authed, checking, onSuccess } = useAuth()

  if (checking) return null  // ~0ms — localStorage is synchronous; avoids PIN flash
  if (!authed) return <PinGate onSuccess={onSuccess} />

  return (
    <DoctorsProvider>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Dashboard />} />
            <Route path="sessions/new" element={<NewSession />} />
            <Route path="sessions/active" element={<SessionHistory filter="active" />} />
            <Route path="sessions/history" element={<SessionHistory />} />
            <Route path="sessions/:id/live" element={<ActiveSession />} />
            <Route path="sessions/:id/review" element={<Suspense fallback={<PageLoader />}><NoteReview /></Suspense>} />
            <Route path="sessions/:sessionId/transcript" element={<Suspense fallback={<PageLoader />}><TranscriptViewer /></Suspense>} />
            <Route path="doctors" element={<Suspense fallback={<PageLoader />}><DoctorsPage /></Suspense>} />
            <Route path="settings" element={<Suspense fallback={<PageLoader />}><Settings /></Suspense>} />
            <Route path="analytics" element={<Suspense fallback={<PageLoader />}><Analytics /></Suspense>} />
            <Route path="help" element={<Suspense fallback={<PageLoader />}><Help /></Suspense>} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
    </DoctorsProvider>
  )
}
