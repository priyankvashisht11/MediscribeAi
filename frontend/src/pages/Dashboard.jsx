import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useDashboardStats } from '../hooks/useDashboardStats'
import { useActiveSessions } from '../hooks/useActiveSessions'
import { useDoctors } from '../context/DoctorsContext'
import { useDoctorStore } from '../stores/doctorStore'
import { useUiStore } from '../stores/uiStore'
import { useBilling } from '../hooks/useBilling'
import { formatDuration, formatDate } from '../utils/format'
import { apiFetch } from '../utils/apiFetch'
import { Plus, Activity, Calendar, Mic, FileCheck, ArrowRight, Eye } from 'lucide-react'
import styles from './Dashboard.module.css'

/* ── Helpers ──────────────────────────────────────────────────────────────── */
function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function getTodayLabel() {
  return new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function getFirstName(fullName) {
  if (!fullName) return null
  const cleaned = fullName.replace(/^(dr\.?\s+|mr\.?\s+|mrs\.?\s+|ms\.?\s+|prof\.?\s+)/i, '').trim()
  return cleaned.split(/\s+/)[0] || null
}

/* ── Count-up hook ────────────────────────────────────────────────────────── */
function useCountUp(target, enabled = true, duration = 900) {
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
function KpiCard({ label, value, icon: Icon, variant, animate, badge, sub }) {
  const animated = useCountUp(value, animate)
  return (
    <div className={`${styles.kpiCard} ${styles[`kpiCard_${variant}`] || ''}`}>
      <div className={styles.kpiTop}>
        <span className={styles.kpiLabel}>{label}</span>
        {Icon && (
          <div className={`${styles.kpiIconWrap} ${variant === 'live' ? styles.kpiIconPulse : ''}`}>
            <Icon size={14} />
          </div>
        )}
      </div>
      <span className={styles.kpiValue}>{animated}</span>
      <span className={styles.kpiSub}>
        {badge ? <span className={styles.kpiBadge}>{badge}</span> : sub}
      </span>
    </div>
  )
}

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
    <div className={`${styles.sessionCard} ${session.status === 'recording' ? styles.sessionCardLive : ''}`}>
      <div className={styles.sessionCardTop}>
        <p className={styles.sessionDoctor}>{getDoctorName(session.doctor_id)}</p>
        <StatusChip status={session.status} />
      </div>
      <p className={styles.sessionPatient}>{session.patient_name ?? 'Patient not assigned'}</p>
      {session.status === 'recording' && (
        <p className={styles.sessionTimer}>{fmt(elapsed)}</p>
      )}
      <button className={styles.sessionAction} onClick={onNavigate}>
        Open Session <ArrowRight size={11} />
      </button>
    </div>
  )
}

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
  const doctor = useDoctorStore((s) => s.doctor)
  const [demoLoading, setDemoLoading] = useState(false)
  const queryClient = useQueryClient()
  const { stats, loading: statsLoading, error: statsError, hasAnimated, refresh } = useDashboardStats()
  const { sessions: activeSessions, loading: activeLoading } = useActiveSessions(10000)
  const { getDoctorName } = useDoctors()
  const { billing } = useBilling()

  const { data: recentData } = useQuery({
    queryKey: ['dashboard-recent-sessions'],
    queryFn: async () => {
      const res = await apiFetch('/api/sessions?page=1&page_size=6')
      return res.json()
    },
    staleTime: 60_000,
  })
  const recentSessions = recentData?.items ?? []

  async function handleLoadDemo() {
    setDemoLoading(true)
    try {
      const res = await apiFetch('/api/demo/seed', { method: 'POST' })
      const data = await res.json()
      addToast({ type: 'success', message: 'Demo data loaded — refreshing…' })
      await queryClient.invalidateQueries()
      refresh()
    } catch {
      addToast({ type: 'error', message: 'Failed to load demo data' })
    } finally {
      setDemoLoading(false)
    }
  }

  async function handleUnloadDemo() {
    setDemoLoading(true)
    try {
      const res = await apiFetch('/api/demo/seed', { method: 'DELETE' })
      const data = await res.json()
      addToast({ type: 'success', message: `Demo data removed — ${data.removed} sessions cleared` })
      await queryClient.invalidateQueries()
      refresh()
    } catch {
      addToast({ type: 'error', message: 'Failed to unload demo data' })
    } finally {
      setDemoLoading(false)
    }
  }

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
  const isDemoAccount = doctor?.email === 'ananya@demo.chartr.in'
  const sessionGated = billing?.can_start_session === false

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
            <button
              className="btn btn-primary btn-lg"
              onClick={() => navigate(sessionGated ? '/pricing' : '/sessions/new')}
            >
              {sessionGated ? '🔒 Upgrade to Start Session' : 'Start First Session'}
            </button>
            {isDemoAccount && (
              <button
                className="btn btn-secondary"
                onClick={handleLoadDemo}
                disabled={demoLoading}
              >
                {demoLoading ? 'Loading…' : 'Load Demo Data'}
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  const firstName = getFirstName(doctor?.name)
  const todayCount = stats?.today_sessions ?? 0
  // Use live activeSessions count as ground truth — avoids poll-drift with stats API
  const liveCount = activeSessions.filter(s => s.status === 'recording').length
  const isLive = liveCount > 0

  const totalSessions = stats?.total_sessions ?? 0
  const finalizedNotes = stats?.finalized_notes ?? 0

  const KPI_CARDS = [
    {
      label: 'Total Sessions',
      value: totalSessions,
      icon: Activity,
      variant: 'default',
      sub: 'all time',
    },
    {
      label: 'Today',
      value: todayCount,
      icon: Calendar,
      variant: 'default',
      sub: 'since midnight',
    },
    {
      label: 'Recording Now',
      value: liveCount,
      icon: Mic,
      variant: isLive ? 'live' : 'default',
      badge: isLive ? '● LIVE' : null,
      sub: 'none active',
    },
    {
      label: 'Notes Finalized',
      value: finalizedNotes,
      icon: FileCheck,
      variant: 'default',
      sub: totalSessions > 0 ? `of ${totalSessions} sessions` : 'none yet',
    },
  ]

  const totalBreakdown = (stats?.completed_sessions ?? 0) + (stats?.idle_sessions ?? 0) + liveCount

  return (
    <div className={styles.page}>

      {/* ── Header row ── */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>
            {getGreeting()}{firstName ? `, ${firstName}` : ''}
          </h1>
          <p className={styles.pageMeta}>
            {getTodayLabel()}
            {!statsLoading && (
              <span className={styles.pageMetaHighlight}>
                {todayCount === 0
                  ? ' · No sessions yet today'
                  : ` · ${todayCount} session${todayCount !== 1 ? 's' : ''} today`}
              </span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isDemoAccount && (
            <>
              <button
                className="btn btn-ghost btn-sm"
                onClick={handleLoadDemo}
                disabled={demoLoading}
                style={{ fontSize: '12px', color: 'var(--color-text-muted)', opacity: 0.7 }}
              >
                {demoLoading ? 'Loading…' : 'Load demo data'}
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={handleUnloadDemo}
                disabled={demoLoading}
                style={{ fontSize: '12px', color: 'var(--color-text-muted)', opacity: 0.7 }}
              >
                {demoLoading ? 'Working…' : 'Unload demo data'}
              </button>
            </>
          )}
          <button
            className={styles.newSessionBtn}
            onClick={() => navigate(sessionGated ? '/pricing' : '/sessions/new')}
            title={sessionGated ? 'Monthly session limit reached — upgrade to continue' : undefined}
          >
            <Plus size={15} /> {sessionGated ? '🔒 Upgrade' : 'New Session'}
          </button>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className={styles.kpiGrid}>
        {statsLoading
          ? Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)
          : KPI_CARDS.map(card => (
              <KpiCard
                key={card.label}
                label={card.label}
                value={card.value ?? 0}
                icon={card.icon}
                variant={card.variant}
                animate={!hasAnimated.current}
                badge={card.badge}
              />
            ))
        }
      </div>

      {/* ── Active sessions ── */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Active Sessions</h2>
          {isLive && (
            <span className={styles.liveCount}>{liveCount} live</span>
          )}
        </div>

        {activeLoading ? (
          <div className={styles.sessionGrid}>
            <ActiveCardSkeleton /><ActiveCardSkeleton />
          </div>
        ) : activeSessions.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}><Mic size={16} strokeWidth={1.5} /></div>
            <div className={styles.emptyText}>
              <p className={styles.emptyTitle}>No active sessions</p>
              <p className={styles.emptyHint}>Start recording to begin transcribing</p>
            </div>
            <button
              className={styles.emptyAction}
              onClick={() => navigate(sessionGated ? '/pricing' : '/sessions/new')}
            >
              <Plus size={13} /> {sessionGated ? '🔒 Upgrade to Start' : 'Start Session'}
            </button>
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

      {/* ── Recent Sessions ── */}
      {recentSessions.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Recent Sessions</h2>
            <button className={styles.sectionLink} onClick={() => navigate('/sessions/history')}>
              View all <ArrowRight size={12} />
            </button>
          </div>
          <div className={styles.recentTable}>
            {recentSessions.map(s => (
              <div key={s.id} className={styles.recentRow}>
                <div className={styles.recentAvatar}>
                  {(s.patient_name ?? 'U').charAt(0).toUpperCase()}
                </div>
                <div className={styles.recentMain}>
                  <span className={styles.recentPatient}>{s.patient_name ?? 'Unknown patient'}</span>
                  <span className={styles.recentDoctor}>{getDoctorName(s.doctor_id)}</span>
                </div>
                <div className={styles.recentMeta}>
                  <span className={styles.recentDuration}>{formatDuration(s.duration_seconds)}</span>
                  <span className={styles.recentDate}>{formatDate(s.created_at)}</span>
                </div>
                <span className={`${styles.chip} ${styles[`chip_${s.status}`]}`}>{s.status}</span>
                <button
                  className={styles.recentAction}
                  onClick={() => navigate(`/sessions/${s.id}/review`)}
                >
                  <Eye size={13} /> View
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Breakdown ── */}
      {!statsLoading && stats && totalBreakdown > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Session Breakdown</h2>
          <div className={styles.statsRow}>
            <div className={styles.statItem}>
              <span className={styles.statVal}>{stats.completed_sessions ?? 0}</span>
              <span className={styles.statLabel}>completed</span>
            </div>
            {liveCount > 0 && <>
              <span className={styles.statDivider} />
              <div className={styles.statItem}>
                <span className={styles.statVal}>{liveCount}</span>
                <span className={styles.statLabel}>recording</span>
              </div>
            </>}
            <span className={styles.statDivider} />
            <div className={styles.statItem}>
              <span className={styles.statVal}>{formatDuration(stats.avg_duration_seconds)}</span>
              <span className={styles.statLabel}>avg duration</span>
            </div>
            <span className={styles.statDivider} />
            <div className={styles.statItem}>
              <span className={styles.statVal}>{stats.finalized_notes ?? 0}</span>
              <span className={styles.statLabel}>notes done</span>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

