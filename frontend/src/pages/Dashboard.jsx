import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { sessionsApi, doctorsApi } from '../services/api'
import { Plus, Eye } from 'lucide-react'
import styles from './Dashboard.module.css'

/* ── Count-up hook ────────────────────────────────────────────────────────── */
function useCountUp(target, duration = 800) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    let start = 0
    const step = target / (duration / 16)
    const timer = setInterval(() => {
      start += step
      if (start >= target) { setValue(target); clearInterval(timer) }
      else setValue(Math.floor(start))
    }, 16)
    return () => clearInterval(timer)
  }, [target, duration])
  return value
}

/* ── KPI Card ─────────────────────────────────────────────────────────────── */
function KpiCard({ label, value, delta, deltaLabel }) {
  const animated = useCountUp(value)
  const positive = delta >= 0
  return (
    <div className={styles.kpiCard}>
      <span className={styles.kpiLabel}>{label}</span>
      <span className={styles.kpiValue}>{animated}</span>
      {delta !== undefined && (
        <span className={`${styles.kpiDelta} ${positive ? styles.positive : styles.negative}`}>
          {positive ? '↑' : '↓'} {Math.abs(delta)} {deltaLabel}
        </span>
      )}
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

/* ── Session card ─────────────────────────────────────────────────────────── */
function SessionCard({ session, doctors }) {
  const navigate = useNavigate()
  const doctor = doctors?.find((d) => d.id === session.doctor_id)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (session.status !== 'recording') return
    const t = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(t)
  }, [session.status])

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  return (
    <div className={styles.sessionCard}>
      <div className={styles.sessionCardTop}>
        <div>
          <p className={styles.sessionDoctor}>{doctor?.name ?? 'Unknown Doctor'}</p>
          <span className={styles.specialtyBadge}>{doctor?.specialty}</span>
        </div>
        <StatusChip status={session.status} />
      </div>
      <p className={styles.sessionPatient}>
        {session.patient_name ?? 'Patient not assigned'}
      </p>
      {session.status === 'recording' && (
        <p className={styles.sessionTimer}>{fmt(elapsed)}</p>
      )}
      <button
        className={styles.sessionAction}
        onClick={() =>
          navigate(
            session.status === 'completed'
              ? `/sessions/${session.id}/review`
              : `/sessions/${session.id}/live`
          )
        }
      >
        {session.status === 'completed' ? (
          <><Eye size={13} /> View Note</>
        ) : (
          'Open Session'
        )}
      </button>
    </div>
  )
}

/* ── Main Dashboard ───────────────────────────────────────────────────────── */
export default function Dashboard() {
  const navigate = useNavigate()
  const { data: sessions = [] } = useQuery({ queryKey: ['sessions'], queryFn: sessionsApi.list })
  const { data: doctors = [] } = useQuery({ queryKey: ['doctors'], queryFn: doctorsApi.list })

  const active = sessions.filter((s) => s.status === 'recording').length
  const completed = sessions.filter((s) => s.status === 'completed').length
  const pending = sessions.filter((s) => s.status !== 'completed').length

  const [page, setPage] = useState(1)
  const PER_PAGE = 10
  const totalPages = Math.ceil(sessions.length / PER_PAGE)
  const pageRows = sessions.slice((page - 1) * PER_PAGE, page * PER_PAGE)

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
        <KpiCard label="Active Now" value={active} delta={active} deltaLabel="sessions" />
        <KpiCard label="Today's Sessions" value={sessions.length} delta={3} deltaLabel="vs yesterday" />
        <KpiCard label="Notes Pending" value={pending} />
        <KpiCard label="Avg Session (min)" value={12} />
      </div>

      {/* Zone 2 — Active sessions */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Active Sessions</h2>
        {sessions.length === 0 ? (
          <p className={styles.empty}>No active sessions right now.</p>
        ) : (
          <div className={styles.sessionGrid}>
            {sessions.slice(0, 5).map((s) => (
              <SessionCard key={s.id} session={s} doctors={doctors} />
            ))}
          </div>
        )}
      </section>

      {/* Zone 3 — Recent sessions table */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Recent Sessions</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Doctor</th>
                <th>Patient</th>
                <th>Date / Time</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((s) => {
                const doc = doctors.find((d) => d.id === s.doctor_id)
                return (
                  <tr key={s.id}>
                    <td>{doc?.name ?? '—'}</td>
                    <td>{s.patient_name ?? '—'}</td>
                    <td>{new Date(s.created_at).toLocaleString()}</td>
                    <td><StatusChip status={s.status} /></td>
                    <td>
                      <button
                        className={styles.viewBtn}
                        onClick={() => navigate(`/sessions/${s.id}/review`)}
                      >
                        <Eye size={13} /> View Note
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className={styles.pagination}>
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>← Prev</button>
            <span>Page {page} of {totalPages}</span>
            <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>Next →</button>
          </div>
        )}
      </section>
    </div>
  )
}
