import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { useDashboardStats } from '../hooks/useDashboardStats'
import { useActiveSessions } from '../hooks/useActiveSessions'
import { useDoctors } from '../context/DoctorsContext'
import { useUiStore } from '../stores/uiStore'
import { formatDuration, formatDate } from '../utils/format'
import { Plus, Activity, Calendar, Mic, FileCheck } from 'lucide-react'
import styles from './Dashboard.module.css'

const isNative = Capacitor.isNativePlatform()

/* ── Count-up hook ────────────────────────────────────────────────────────── */
function useCountUp(target, enabled = true, duration = 800) {
  const [value, setValue] = useState(0)
  const prevTarget = useRef(0)

  useEffect(() => {
    if (!enabled) { setValue(target ?? 0); return }
    const end = target ?? 0
    if (prevTarget.current === end) return
    prevTarget.current = end
    let start = 0
    const step = end / (duration / 16)
    const timer = setInterval(() => {
      start += step
      if (start >= end) { setValue(end); clearInterval(timer) }
      else setValue(Math.floor(start))
    }, 16)
    return () => clearInterval(timer)
  }, [target, enabled, duration])

  return value
}

/* ── KPI Card ─────────────────────────────────────────────────────────────── */
function KpiCard({ label, value, icon: Icon, color, pulse, animate }) {
  const animated = useCountUp(value, animate)
  return (
    <div className={`${styles.kpiCard} ${pulse ? 'kpi-card--pulse' : ''}`}
         style={{ borderTopColor: `var(--color-${color === 'muted' ? 'border' : color})` }}>
      <div className={styles.kpiTop}>
        <span className={styles.kpiLabel}>{label}</span>
        {Icon && <Icon size={16} style={{ color: `var(--color-${color === 'muted' ? 'text-muted' : color})` }} />}
      </div>
      <span className={styles.kpiValue}>{animated}</span>
    </div>
  )
}

/* ── KPI Skeleton ─────────────────────────────────────────────────────────── */
function KpiSkeleton() {
  return (
    <div className={styles.kpiCard}>
      <div className={`skeleton-box ${styles.skeletonLabel}`} />
      <div className={`skeleton-box ${styles.skeletonValue}`} />
    </div>
  )
}

/* ── Status chip ──────────────────────────────────────────────────────────── */
function StatusChip({ status }) {
  return (
    <span className={`${styles.chip} ${styles[`chip_${status}`]}`}>
      {status === 'recording' && <span className={styles.pulseDot} />}
      {status}
    </span>
  )
}

/* ── Active Session Card ──────────────────────────────────────────────────── */
function ActiveSessionCard({ session, getDoctorName, onNavigate }) {
  const [elapsed, setElapsed] = useState(() => {
    if (!session.started_at) return 0
    return Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000)
  })

  useEffect(() => {
    if (session.status !== 'recording') return
    const t = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(t)
  }, [session.status])

  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  return (
    <div className={styles.sessionCard}>
      <div className={styles.sessionCardTop}>
        <div>
          <p className={styles.sessionDoctor}>{getDoctorName(session.doctor_id)}</p>
        </div>
        <StatusChip status={session.status} />
      </div>
      <p className={styles.sessionPatient}>{session.patient_name ?? 'Patient not assigned'}</p>
      {session.status === 'recording' && (
        <p className={styles.sessionTimer}>{fmt(elapsed)}</p>
      )}
      <button className={styles.sessionAction} onClick={onNavigate}>
        Open Session
      </button>
    </div>
  )
}

/* ── Active Session Card Skeleton ─────────────────────────────────────────── */
function ActiveCardSkeleton() {
  return (
    <div className={styles.sessionCard}>
      <div className={`skeleton-box ${styles.skeletonLine}`} style={{ width: '60%', height: 16 }} />
      <div className={`skeleton-box ${styles.skeletonLine}`} style={{ width: '40%', height: 12, marginTop: 8 }} />
    </div>
  )
}

/* ── Main Dashboard ───────────────────────────────────────────────────────── */
export default function Dashboard() {
  const navigate = useNavigate()
  const addToast = useUiStore((s) => s.addToast)
  const { stats, loading: statsLoading, error: statsError, hasAnimated, refresh } = useDashboardStats()
  const { sessions: activeSessions, loading: activeLoading } = useActiveSessions(10000)
  const { getDoctorName } = useDoctors()

  if (statsError && !stats) {
    return (
      <div className="error-state">
        <Activity size={24} style={{ color: 'var(--color-error)' }} />
        <p className="error-state-message">Failed to load dashboard: {statsError}</p>
        <button className="btn btn-ghost btn-sm" onClick={refresh}>Try Again</button>
      </div>
    )
  }

  const isFirstRun = !statsLoading && stats?.total_sessions === 0

  if (isFirstRun) {
    return (
      <div className="first-run-screen">
        <div className="first-run-content">
          <div className="first-run-icon">
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
              <circle cx="32" cy="32" r="30" stroke="var(--color-primary)" strokeWidth="2"/>
              <path d="M32 18v28M18 32h28" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </div>
          <h1 className="first-run-title">Welcome to Chartr</h1>
          <p className="first-run-desc">
            AI-assisted clinical documentation for Indian practitioners.
            Start your first session to begin.
          </p>
          <div className="first-run-actions">
            <button className="btn btn-primary btn-lg" onClick={() => navigate('/sessions/new')}>
              Start First Session
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => addToast({ type: 'info', message: 'Run: docker compose exec backend python scripts/seed_demo.py' })}
            >
              Load Demo Data
            </button>
          </div>
        </div>
      </div>
    )
  }

  const KPI_CARDS = [
    { label: 'Total Sessions',  value: stats?.total_sessions,  icon: Activity,   color: 'primary' },
    { label: 'Today',           value: stats?.today_sessions,  icon: Calendar,   color: 'success' },
    { label: 'Recording Now',   value: stats?.recording_now,   icon: Mic,        color: stats?.recording_now > 0 ? 'error' : 'muted', pulse: (stats?.recording_now ?? 0) > 0 },
    { label: 'Notes Finalized', value: stats?.finalized_notes, icon: FileCheck,  color: 'primary' },
  ]

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Dashboard</h1>
        <button className={styles.newSessionBtn} onClick={() => navigate('/sessions/new')}>
          <Plus size={15} /> New Session
        </button>
      </div>

      {/* Zone 1 — KPIs */}
      <div className={styles.kpiGrid}>
        {statsLoading
          ? Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)
          : KPI_CARDS.map(card => (
              <KpiCard
                key={card.label}
                label={card.label}
                value={card.value ?? 0}
                icon={card.icon}
                color={card.color}
                pulse={card.pulse}
                animate={!hasAnimated.current}
              />
            ))
        }
      </div>

      {/* Zone 2 — Active sessions */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Active Sessions</h2>
        {activeLoading ? (
          <div className={styles.sessionGrid}>
            <ActiveCardSkeleton />
            <ActiveCardSkeleton />
          </div>
        ) : activeSessions.length === 0 ? (
          <div className={styles.empty}>
            <Mic size={32} strokeWidth={1} style={{ color: 'var(--color-text-faint)' }} />
            <p>No active sessions right now.</p>
          </div>
        ) : (
          <div className={styles.sessionGrid}>
            {activeSessions.map(s => (
              <ActiveSessionCard
                key={s.id}
                session={s}
                getDoctorName={getDoctorName}
                onNavigate={() => navigate(`/sessions/${s.id}/live`)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Zone 3 — Quick stats row */}
      {!statsLoading && stats && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Session Breakdown</h2>
          <div className={styles.statsRow}>
            <div className={styles.statItem}>
              <span className={styles.statVal}>{stats.completed_sessions}</span>
              <span className={styles.statLabel}>Completed</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statVal}>{stats.idle_sessions}</span>
              <span className={styles.statLabel}>Idle</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statVal}>{formatDuration(stats.avg_duration_seconds)}</span>
              <span className={styles.statLabel}>Avg Duration</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statVal}>{stats.finalized_notes}</span>
              <span className={styles.statLabel}>Notes Done</span>
            </div>
          </div>
        </section>
      )}

      {/* Floating "New Session" button — mobile / native only, hidden on desktop */}
      <button
        className={styles.fab}
        onClick={() => navigate('/sessions/new')}
        aria-label="New Session"
      >
        <Plus size={24} />
      </button>
    </div>
  )
}
