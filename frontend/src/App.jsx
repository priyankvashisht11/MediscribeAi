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
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import JoinClinicPage from './pages/JoinClinicPage'
import SetupPasswordPage from './pages/SetupPasswordPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import LandingPage from './pages/LandingPage'
import { authApi } from './services/api'
import { useDoctorStore } from './stores/doctorStore'

const NoteReview        = lazy(() => import('./pages/NoteReview'))
const TranscriptViewer  = lazy(() => import('./pages/TranscriptViewer'))
const DoctorsPage       = lazy(() => import('./pages/Doctors'))
const Settings          = lazy(() => import('./pages/Settings'))
const Analytics         = lazy(() => import('./pages/Analytics'))
const Help              = lazy(() => import('./pages/Help'))
const PatientDirectory  = lazy(() => import('./pages/PatientDirectory'))
const PatientProfile    = lazy(() => import('./pages/PatientProfile'))
const ClinicAdmin       = lazy(() => import('./pages/ClinicAdmin'))
const PricingPage       = lazy(() => import('./pages/PricingPage'))

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

function ConnectingScreen() {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--color-bg)',
      color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)',
    }}>
      Connecting…
    </div>
  )
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
})

function useAuth() {
  const [authed, setAuthed] = useState(false)
  const [checking, setChecking] = useState(true)

  const bootstrap = async () => {
    const token = localStorage.getItem('chartr_token')
    if (!token) {
      useDoctorStore.getState().clearDoctor()
      setAuthed(false)
      setChecking(false)
      return
    }
    try {
      const doctor = await authApi.me()
      useDoctorStore.getState().setDoctor(doctor)
      setAuthed(true)
    } catch {
      localStorage.removeItem('chartr_token')
      useDoctorStore.getState().clearDoctor()
      setAuthed(false)
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    bootstrap()
  }, [])

  useEffect(() => {
    const handler = () => bootstrap()
    window.addEventListener('chartr_auth_change', handler)
    return () => window.removeEventListener('chartr_auth_change', handler)
  }, [])

  return {
    authed,
    checking,
    onSuccess: () => {
      // Reset URL to / before swapping routers — prevents the authed tree
      // from briefly rendering <NotFound> because /login has no matching route.
      window.history.replaceState(null, '', '/')
      setAuthed(true)
      setChecking(false)
    },
  }
}

export default function App() {
  const { authed, checking, onSuccess } = useAuth()

  if (checking) return <ConnectingScreen />

  if (!authed) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage onSuccess={onSuccess} />} />
          <Route path="/signup" element={<SignupPage onSuccess={onSuccess} />} />
          <Route path="/join" element={<JoinClinicPage onSuccess={onSuccess} />} />
          <Route path="/setup-password" element={<SetupPasswordPage onSuccess={onSuccess} />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage onSuccess={onSuccess} />} />
          <Route path="*" element={<LoginPage onSuccess={onSuccess} />} />
        </Routes>
      </BrowserRouter>
    )
  }

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
            <Route path="patients" element={<Suspense fallback={<PageLoader />}><PatientDirectory /></Suspense>} />
            <Route path="patients/:patientId" element={<Suspense fallback={<PageLoader />}><PatientProfile /></Suspense>} />
            <Route path="clinic" element={<Suspense fallback={<PageLoader />}><ClinicAdmin /></Suspense>} />
            <Route path="pricing" element={<Suspense fallback={<PageLoader />}><PricingPage /></Suspense>} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
    </DoctorsProvider>
  )
}
