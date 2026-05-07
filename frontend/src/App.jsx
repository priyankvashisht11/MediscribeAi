import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AppShell from './components/AppShell'
import Dashboard from './pages/Dashboard'
import NewSession from './pages/NewSession'
import ActiveSession from './pages/ActiveSession'
import NoteReview from './pages/NoteReview'
import SessionHistory from './pages/SessionHistory'
import DoctorsPage from './pages/Doctors'
import NotFound from './pages/NotFound'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Dashboard />} />
            <Route path="sessions/new" element={<NewSession />} />
            <Route path="sessions/active" element={<SessionHistory filter="active" />} />
            <Route path="sessions/history" element={<SessionHistory />} />
            <Route path="sessions/:id/live" element={<ActiveSession />} />
            <Route path="sessions/:id/review" element={<NoteReview />} />
            <Route path="doctors" element={<DoctorsPage />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
