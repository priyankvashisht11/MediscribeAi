import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell, RadialBarChart, RadialBar,
} from 'recharts'
import { useDoctorStore } from '../stores/doctorStore'
import { authHeader } from '../utils/apiFetch'
import {
  Clock, Users, FileCheck, TrendingUp, Zap,
  Stethoscope, Calendar, Award, Activity, CheckCircle,
} from 'lucide-react'
import styles from './Analytics.module.css'

const BASE = import.meta.env.VITE_API_URL || ''

function apiFetch(path, params = {}) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null)).toString()
  const url = `${BASE}${path}${qs ? `?${qs}` : ''}`
  return fetch(url, { headers: authHeader() }).then(r => r.json())
}

function formatHour(h) {
  if (h === null || h === undefined) return '—'
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:00 ${suffix}`
}

function fmtDuration(min) {
  if (!min) return '—'
  if (min < 60) return `${min.toFixed(1)} min`
  return `${(min / 60).toFixed(1)} hr`
}

function fmtDate(iso) {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

// ── Hero: Time Saved ──────────────────────────────────────────────────────────
function TimeSavedHero({ overview }) {
  if (!overview) return (
    <div className={styles.heroCard}>
      <div className={styles.heroLeft}>
        <Zap size={20} className={styles.heroIcon} />
        <div>
          <div className={styles.heroLabel}>AI Documentation Time Saved</div>
          <div className={styles.heroValue}>—</div>
        </div>
      </div>
    </div>
  )

  const MINUTES_SAVED_PER_SESSION = 12
  const totalMinutes = (overview.total_sessions || 0) * MINUTES_SAVED_PER_SESSION
  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60
  const display = hours > 0 ? `${hours}h ${mins}m` : `${mins} min`
  const notesTotal = Math.round((overview.finalized_notes_pct / 100) * overview.total_sessions) || 0
  const notesPending = overview.total_sessions - notesTotal

  return (
    <div className={styles.heroCard}>
      <div className={styles.heroLeft}>
        <Zap size={20} className={styles.heroIcon} />
        <div>
          <div className={styles.heroLabel}>AI Documentation Time Saved</div>
          <div className={styles.heroValue}>{display}</div>
          <div className={styles.heroSub}>
            {overview.total_sessions} sessions × ~{MINUTES_SAVED_PER_SESSION} min saved per session vs manual note-writing
          </div>
        </div>
      </div>
      <div className={styles.heroStats}>
        <div className={styles.heroStat}>
          <div className={styles.heroStatVal}>{overview.finalized_notes_pct ?? 0}%</div>
          <div className={styles.heroStatLabel}>Notes finalised</div>
        </div>
        <div className={styles.heroStat}>
          <div className={styles.heroStatVal}>{overview.total_patients_seen ?? 0}</div>
          <div className={styles.heroStatLabel}>Unique patients</div>
        </div>
        <div className={styles.heroStat}>
          <div className={styles.heroStatVal}>{notesPending}</div>
          <div className={styles.heroStatLabel}>Notes pending</div>
        </div>
      </div>
    </div>
  )
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, sub }) {
  return (
    <div className={styles.kpiCard}>
      <div className={styles.kpiTop}>
        <span className={styles.kpiLabel}>{label}</span>
        <Icon size={14} className={styles.kpiIcon} />
      </div>
      <div className={styles.kpiValue}>{value ?? '—'}</div>
      {sub && <div className={styles.kpiSub}>{sub}</div>}
    </div>
  )
}

// ── Sessions trend chart ───────────────────────────────────────────────────────
function SessionsTrend({ doctorId }) {
  const [days, setDays] = useState(14)

  const { data: byDay = [], isLoading } = useQuery({
    queryKey: ['analytics-sessions-by-day', doctorId, days],
    queryFn: () => apiFetch('/api/analytics/sessions-by-day', { doctor_id: doctorId, days }),
    staleTime: 300_000,
  })

  const hasData = byDay.some(d => d.count > 0)

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>Sessions — Daily Trend</h2>
        <div className={styles.toggleGroup}>
          {[7, 14, 30].map(d => (
            <button
              key={d}
              className={`${styles.toggleBtn} ${days === d ? styles.toggleBtnActive : ''}`}
              onClick={() => setDays(d)}
            >{d}d</button>
          ))}
        </div>
      </div>
      {isLoading ? (
        <div className={styles.loading}>Loading…</div>
      ) : !hasData ? (
        <div className={styles.emptyChart}>
          <Activity size={24} strokeWidth={1.5} />
          <p>No completed sessions in this period yet.</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={byDay} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
              tickFormatter={d => d.slice(5)}
              interval={Math.max(0, Math.floor(byDay.length / 7) - 1)}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(v) => [v, 'Sessions']}
              labelFormatter={l => `Date: ${l}`}
              contentStyle={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40}>
              {byDay.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.count > 0 ? 'var(--color-accent, #2563eb)' : 'var(--color-border)'}
                  fillOpacity={entry.count > 0 ? 0.85 : 0.3}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ── Weekday Pattern ───────────────────────────────────────────────────────────
function WeekdayPattern({ doctorId }) {
  const { data: byWeekday = [], isLoading } = useQuery({
    queryKey: ['analytics-sessions-by-weekday', doctorId],
    queryFn: () => apiFetch('/api/analytics/sessions-by-weekday', { doctor_id: doctorId }),
    staleTime: 300_000,
  })

  const max = byWeekday.length > 0 ? Math.max(...byWeekday.map(d => d.count), 1) : 1
  const hasData = byWeekday.some(d => d.count > 0)

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>Busiest Days of Week</h2>
      </div>
      {isLoading ? (
        <div className={styles.loading}>Loading…</div>
      ) : !hasData ? (
        <div className={styles.emptyChart}>
          <Calendar size={24} strokeWidth={1.5} />
          <p>Patterns will appear after more sessions are completed.</p>
        </div>
      ) : (
        <div className={styles.weekdayGrid}>
          {byWeekday.map(d => (
            <div key={d.day} className={styles.weekdayCol}>
              <div className={styles.weekdayBarWrap}>
                <div
                  className={styles.weekdayBar}
                  style={{ height: `${Math.max(4, Math.round((d.count / max) * 100))}%` }}
                />
              </div>
              <div className={styles.weekdayLabel}>{d.day}</div>
              <div className={styles.weekdayCount}>{d.count}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Top Diagnoses ─────────────────────────────────────────────────────────────
function TopDiagnoses({ doctorId }) {
  const { data: icd = [], isLoading } = useQuery({
    queryKey: ['analytics-icd', doctorId],
    queryFn: () => apiFetch('/api/analytics/icd-breakdown', { doctor_id: doctorId, limit: 8 }),
    staleTime: 300_000,
  })

  const max = icd.length > 0 ? Math.max(...icd.map(r => r.count)) : 1

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>Top Diagnoses (ICD-10)</h2>
      </div>
      {isLoading ? (
        <div className={styles.loading}>Loading…</div>
      ) : icd.length === 0 ? (
        <div className={styles.emptyChart}>
          <Stethoscope size={24} strokeWidth={1.5} />
          <p>Diagnoses appear after notes with ICD codes are finalised.</p>
        </div>
      ) : (
        <div className={styles.icdList}>
          {icd.map((row, i) => (
            <div key={row.code} className={styles.icdRow}>
              <div className={styles.icdRank}>{i + 1}</div>
              <div className={styles.icdMeta}>
                <span className={styles.icdCode}>{row.code}</span>
                <span className={styles.icdDesc}>{row.description}</span>
              </div>
              <div className={styles.icdBarWrap}>
                <div
                  className={styles.icdBar}
                  style={{ width: `${Math.round((row.count / max) * 100)}%` }}
                />
              </div>
              <span className={styles.icdCount}>{row.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Documentation Health ──────────────────────────────────────────────────────
function DocHealth({ overview }) {
  if (!overview) return null
  const pct = overview.finalized_notes_pct ?? 0
  const total = overview.total_sessions ?? 0
  const finalized = Math.round((pct / 100) * total)
  const pending = total - finalized

  const segments = [
    { label: 'Finalised', count: finalized, color: '#16a34a' },
    { label: 'Pending review', count: pending, color: '#f59e0b' },
  ]

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>Documentation Health</h2>
      </div>
      <div className={styles.docHealth}>
        <div className={styles.docHealthBar}>
          {total > 0 && (
            <>
              <div style={{ flex: finalized, background: '#16a34a', borderRadius: '4px 0 0 4px', minWidth: finalized > 0 ? 4 : 0 }} />
              <div style={{ flex: pending, background: '#f59e0b', borderRadius: '0 4px 4px 0', minWidth: pending > 0 ? 4 : 0 }} />
            </>
          )}
          {total === 0 && <div style={{ flex: 1, background: 'var(--color-border)', borderRadius: 4 }} />}
        </div>
        <div className={styles.docHealthLegend}>
          {segments.map(s => (
            <div key={s.label} className={styles.docHealthItem}>
              <div className={styles.docHealthDot} style={{ background: s.color }} />
              <span className={styles.docHealthLabel}>{s.label}</span>
              <span className={styles.docHealthCount}>{s.count}</span>
            </div>
          ))}
          <div className={styles.docHealthItem} style={{ marginLeft: 'auto' }}>
            <CheckCircle size={13} style={{ color: pct >= 80 ? '#16a34a' : '#f59e0b' }} />
            <span className={styles.docHealthLabel}>{pct}% complete</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Doctor Breakdown table ────────────────────────────────────────────────────
function DoctorBreakdown() {
  const { data: allDoctors = [], isLoading } = useQuery({
    queryKey: ['analytics-doctor-breakdown'],
    queryFn: () => apiFetch('/api/analytics/doctor-breakdown'),
    staleTime: 300_000,
  })

  // Only show doctors who have at least one session
  const doctors = allDoctors.filter(d => d.total_sessions > 0)
  if (isLoading || doctors.length <= 1) return null

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>Doctor Performance</h2>
        <span className={styles.cardBadge}>{doctors.length} active doctors</span>
      </div>
      <div className={styles.doctorTable}>
        <div className={styles.doctorTableHead}>
          <span>Doctor</span>
          <span>Sessions</span>
          <span>Patients</span>
          <span>Avg Duration</span>
          <span>Notes Done</span>
          <span>Last Active</span>
        </div>
        {doctors.map(d => {
          const notePct = d.total_sessions > 0
            ? Math.round((d.notes_finalized / d.total_sessions) * 100)
            : 0
          return (
            <div key={d.id} className={styles.doctorTableRow}>
              <div>
                <div className={styles.doctorName}>{d.name}</div>
                <div className={styles.doctorSpec}>{d.specialty}</div>
              </div>
              <span className={styles.doctorStat}>{d.total_sessions}</span>
              <span className={styles.doctorStat}>{d.unique_patients}</span>
              <span className={styles.doctorStat}>{fmtDuration(d.avg_duration_min)}</span>
              <div>
                <span className={styles.doctorStat}>{d.notes_finalized}</span>
                <span className={styles.doctorStatSub}> / {d.total_sessions} ({notePct}%)</span>
              </div>
              <span className={styles.doctorDate}>{fmtDate(d.last_session_at)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Analytics() {
  const doctor = useDoctorStore(s => s.doctor)
  const doctorId = doctor?.id

  const { data: overview, isLoading: ovLoading } = useQuery({
    queryKey: ['analytics-overview', doctorId],
    queryFn: () => apiFetch('/api/analytics/overview', { doctor_id: doctorId }),
    staleTime: 300_000,
  })

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Analytics</h1>
          <p className={styles.sub}>Practice intelligence · All time</p>
        </div>
      </div>

      <TimeSavedHero overview={overview} />

      {/* KPI grid — 6 cards */}
      <div className={styles.kpiGrid}>
        <KpiCard icon={Activity}   label="Total Sessions"   value={ovLoading ? '…' : overview?.total_sessions}          sub="all time" />
        <KpiCard icon={Calendar}   label="This Month"       value={ovLoading ? '…' : overview?.sessions_this_month}     sub="sessions" />
        <KpiCard icon={TrendingUp} label="This Week"        value={ovLoading ? '…' : overview?.sessions_this_week}      sub="sessions" />
        <KpiCard icon={Users}      label="Unique Patients"  value={ovLoading ? '…' : overview?.total_patients_seen}     sub="seen all time" />
        <KpiCard icon={Clock}      label="Avg Duration"     value={ovLoading ? '…' : `${overview?.avg_session_duration_minutes ?? 0} min`} sub="per session" />
        <KpiCard icon={Award}      label="Peak Hour"        value={ovLoading ? '…' : formatHour(overview?.busiest_hour)} sub="busiest time (IST)" />
      </div>

      {/* Documentation health bar */}
      <DocHealth overview={overview} />

      {/* Trend + Weekday pattern */}
      <div className={styles.twoCol}>
        <SessionsTrend doctorId={doctorId} />
        <WeekdayPattern doctorId={doctorId} />
      </div>

      {/* Diagnoses full-width */}
      <TopDiagnoses doctorId={doctorId} />

      {/* Doctor breakdown (clinic plan — only when 2+ doctors have sessions) */}
      <DoctorBreakdown />
    </div>
  )
}
