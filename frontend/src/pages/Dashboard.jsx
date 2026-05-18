import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDashboardStats } from '../hooks/useDashboardStats'
import { useActiveSessions } from '../hooks/useActiveSessions'
import { useDoctors } from '../context/DoctorsContext'
import { useDoctorStore } from '../stores/doctorStore'
import { useUiStore } from '../stores/uiStore'
import { formatDuration } from '../utils/format'
import { Plus, Activity, Calendar, Mic, FileCheck, ArrowRight } from 'lucide-react'
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

/* ── Mini bar chart ───────────────────────────────────────────────────────── */
function BreakdownBar({ completed, idle, recording, total }) {
  if (!total) return null
  const pct = v => `${Math.max(2, Math.round((v / total) * 100))}%`
  return (
    <div className={styles.barTrack}>
      {completed > 0 && <div className={styles.barSegCompleted} style={{ width: pct(completed) }} />}
      {recording > 0 && <div className={styles.barSegRecording} style={{ width: pct(recording) }} />}
      {idle > 0 && <div className={styles.barSegIdle} style={{ flex: 1 }} />}
    </div>
  )
}

/* ── KPI Card ─────────────────────────────────────────────────────────────── */
function KpiCard({ label, value, icon: Icon, variant, animate, badge }) {
  const animated = useCountUp(value, animate)
  return (
    <div className={`${styles.kpiCard} ${styles[`kpiCard_${variant}`] || ''}`}>
      <div className={styles.kpiTop}>
        <div className={`${styles.kpiIconWrap} ${variant === 'live' ? styles.kpiIconPulse : ''}`}>
          {Icon && <Icon size={16} />}
        </div>
        <span className={styles.kpiLabel}>{label}</span>
      </div>
      <span className={styles.kpiValue}>{animated}</span>
      {badge && <span className={styles.kpiBadge}>{badge}</span>}
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

  const firstName = getFirstName(doctor?.name)
  const todayCount = stats?.today_sessions ?? 0
  // Use live activeSessions count as ground truth — avoids poll-drift with stats API
  const liveCount = activeSessions.filter(s => s.status === 'recording').length
  const isLive = liveCount > 0

  const KPI_CARDS = [
    {
      label: 'Total Sessions',
      value: stats?.total_sessions,
      icon: Activity,
      variant: 'default',
    },
    {
      label: 'Today',
      value: todayCount,
      icon: Calendar,
      variant: todayCount > 0 ? 'today' : 'default',
    },
    {
      label: 'Recording Now',
      value: liveCount,
      icon: Mic,
      variant: isLive ? 'live' : 'default',
      badge: isLive ? '● LIVE' : null,
    },
    {
      label: 'Notes Finalized',
      value: stats?.finalized_notes,
      icon: FileCheck,
      variant: (stats?.finalized_notes ?? 0) > 0 ? 'success' : 'default',
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
        <button className={styles.newSessionBtn} onClick={() => navigate('/sessions/new')}>
          <Plus size={15} /> New Session
        </button>
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
            <div className={styles.emptyIcon}><Mic size={22} strokeWidth={1.5} /></div>
            <p className={styles.emptyTitle}>No active sessions right now</p>
            <p className={styles.emptyHint}>Start a session to begin recording and transcribing.</p>
            <button className={styles.emptyAction} onClick={() => navigate('/sessions/new')}>
              <Plus size={13} /> Start Session
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

      {/* ── Breakdown ── */}
      {!statsLoading && stats && totalBreakdown > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Session Breakdown</h2>
          <div className={styles.breakdownCard}>
            <BreakdownBar
              completed={stats.completed_sessions ?? 0}
              idle={stats.idle_sessions ?? 0}
              recording={liveCount}
              total={totalBreakdown}
            />
            <div className={styles.breakdownLegend}>
              <LegendItem dot="completed" label="Completed" value={stats.completed_sessions ?? 0} />
              {liveCount > 0 && <LegendItem dot="recording" label="Recording" value={liveCount} />}
              {(stats.idle_sessions ?? 0) > 0 && <LegendItem dot="idle" label="Idle" value={stats.idle_sessions} />}
              <div className={styles.legendDivider} />
              <LegendItem label="Avg Duration" value={formatDuration(stats.avg_duration_seconds)} />
              <LegendItem label="Notes Done" value={stats.finalized_notes ?? 0} />
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

function LegendItem({ dot, label, value }) {
  return (
    <div className={styles.legendItem}>
      {dot && <span className={`${styles.legendDot} ${styles[`legendDot_${dot}`]}`} />}
      <span className={styles.legendLabel}>{label}</span>
      <span className={styles.legendVal}>{value}</span>
    </div>
  )
}
