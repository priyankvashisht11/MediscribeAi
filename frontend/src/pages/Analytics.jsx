import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useUiStore } from '../stores/uiStore'
import { authHeader } from '../utils/apiFetch'
import styles from './Analytics.module.css'

const BASE = import.meta.env.VITE_API_URL || ''

function apiFetch(path, doctorId) {
  const url = doctorId ? `${BASE}${path}?doctor_id=${doctorId}` : `${BASE}${path}`
  return fetch(url, { headers: authHeader() }).then(r => r.json())
}

function StatCard({ label, value, sub }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statValue}>{value ?? '—'}</div>
      <div className={styles.statLabel}>{label}</div>
      {sub && <div className={styles.statSub}>{sub}</div>}
    </div>
  )
}

export default function Analytics() {
  const selectedDoctorId = useUiStore(s => s.activeDoctorId)

  const { data: overview, isLoading: ovLoading } = useQuery({
    queryKey: ['analytics-overview', selectedDoctorId],
    queryFn: () => apiFetch('/api/analytics/overview', selectedDoctorId),
    staleTime: 300_000,
  })

  const { data: icd = [], isLoading: icdLoading } = useQuery({
    queryKey: ['analytics-icd', selectedDoctorId],
    queryFn: () => apiFetch('/api/analytics/icd-breakdown', selectedDoctorId),
    staleTime: 300_000,
  })

  const { data: byDay = [], isLoading: dayLoading } = useQuery({
    queryKey: ['analytics-sessions-by-day', selectedDoctorId],
    queryFn: () => apiFetch('/api/analytics/sessions-by-day', selectedDoctorId),
    staleTime: 300_000,
  })

  const maxIcd = icd.length > 0 ? Math.max(...icd.map(r => r.count)) : 1

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Analytics</h1>
        <p className={styles.sub}>Practice overview based on completed sessions</p>
      </div>

      {/* KPI cards */}
      <div className={styles.statGrid}>
        <StatCard label="Total Sessions" value={ovLoading ? '…' : overview?.total_sessions} />
        <StatCard label="Avg Duration" value={ovLoading ? '…' : `${overview?.avg_session_duration_minutes ?? 0} min`} />
        <StatCard label="This Week" value={ovLoading ? '…' : overview?.sessions_this_week} sub="sessions completed" />
        <StatCard label="Notes Finalized" value={ovLoading ? '…' : overview?.notes_finalized_this_week} sub="this week" />
      </div>

      {/* Sessions bar chart */}
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Sessions — Last 30 Days</h2>
        {dayLoading ? (
          <div className={styles.loading}>Loading…</div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byDay} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 9 }}
                tickFormatter={d => d.slice(5)}
                interval={4}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 9 }} />
              <Tooltip
                formatter={(v) => [v, 'Sessions']}
                labelFormatter={l => `Date: ${l}`}
              />
              <Bar dataKey="count" fill="var(--color-primary)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ICD-10 breakdown */}
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Top Diagnoses (ICD-10)</h2>
        {icdLoading ? (
          <div className={styles.loading}>Loading…</div>
        ) : icd.length === 0 ? (
          <p className={styles.emptyState}>
            Your most common diagnoses will appear here as you complete more sessions.
          </p>
        ) : (
          <div className={styles.icdList}>
            {icd.map(row => (
              <div key={row.code} className={styles.icdRow}>
                <div className={styles.icdMeta}>
                  <span className={styles.icdCode}>{row.code}</span>
                  <span className={styles.icdDesc}>{row.description}</span>
                </div>
                <div className={styles.icdBarWrap}>
                  <div
                    className={styles.icdBar}
                    style={{ width: `${Math.round((row.count / maxIcd) * 100)}%` }}
                  />
                </div>
                <span className={styles.icdCount}>{row.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
