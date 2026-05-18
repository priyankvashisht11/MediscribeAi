import { useNavigate, useSearchParams } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { useSessionHistory } from '../hooks/useSessionHistory'
import { useDoctors } from '../context/DoctorsContext'
import { PaginationBar } from '../components/PaginationBar'
import { formatDuration, formatDate } from '../utils/format'
import { Eye, ClipboardList, FileText } from 'lucide-react'
import MobileSessionHistory from './MobileSessionHistory'
import styles from './SessionHistory.module.css'

const isMobile = Capacitor.isNativePlatform() || window.innerWidth <= 768

function StatusChip({ status }) {
  return (
    <span className={`${styles.chip} ${styles[`chip_${status}`]}`}>
      {status}
    </span>
  )
}

function TableSkeletonRows({ count }) {
  return Array.from({ length: count }).map((_, i) => (
    <tr key={i}>
      {Array.from({ length: 5 }).map((__, j) => (
        <td key={j}>
          <div className="skeleton-box" style={{ height: 14, width: j === 0 ? '80%' : '60%', borderRadius: 4 }} />
        </td>
      ))}
    </tr>
  ))
}

export default function SessionHistory({ filter }) {
  if (isMobile) return <MobileSessionHistory filter={filter} />
  return <DesktopSessionHistory filter={filter} />
}

function DesktopSessionHistory({ filter }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { getDoctorName, doctors } = useDoctors()

  const { data, loading, error, filters, updateFilter } = useSessionHistory()

  return (
    <div className={styles.page}>
      <div className={styles.titleRow}>
        <h1 className={styles.title}>
          {filter === 'active' ? 'Active Sessions' : 'Session History'}
        </h1>
        {!loading && data.total > 0 && (
          <span className={styles.countBadge}>{data.total}</span>
        )}
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <input
          className={styles.input}
          type="text"
          placeholder="Search patient…"
          value={filters.search}
          onChange={e => updateFilter('search', e.target.value)}
        />
        <input
          className={styles.input}
          type="date"
          value={filters.dateFrom}
          onChange={e => updateFilter('dateFrom', e.target.value)}
          aria-label="From date"
        />
        <input
          className={styles.input}
          type="date"
          value={filters.dateTo}
          onChange={e => updateFilter('dateTo', e.target.value)}
          aria-label="To date"
        />
        <select
          className={styles.input}
          value={filters.doctorId}
          onChange={e => updateFilter('doctorId', e.target.value)}
        >
          <option value="">All Doctors</option>
          {doctors.map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <select
          className={styles.input}
          value={filters.status}
          onChange={e => updateFilter('status', e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="completed">Completed</option>
          <option value="recording">Recording</option>
          <option value="idle">Idle</option>
        </select>
      </div>

      {error && (
        <div className={styles.errorBanner}>Failed to load sessions: {error}</div>
      )}

      <div className={styles.tableWrap}>
        <table className={`${styles.table} history-table`}>
          <thead>
            <tr>
              <th>Date / Time</th>
              <th>Doctor</th>
              <th>Patient</th>
              <th>Duration</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeletonRows count={5} />
            ) : data.items.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className={styles.empty}>
                    <ClipboardList size={40} strokeWidth={1} />
                    <p>No sessions match your filters</p>
                    <button className={styles.newBtn} onClick={() => navigate('/sessions/new')}>
                      Start your first session
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              data.items.map(s => (
                <tr key={s.id}>
                  <td data-label="Date">{formatDate(s.created_at)}</td>
                  <td data-label="Doctor">{getDoctorName(s.doctor_id)}</td>
                  <td data-label="Patient">{s.patient_name ?? '—'}</td>
                  <td data-label="Duration">{formatDuration(s.duration_seconds)}</td>
                  <td data-label="Status"><StatusChip status={s.status} /></td>
                  <td data-label="Actions" className={styles.actionCell}>
                    <button
                      className={styles.viewBtn}
                      onClick={() => navigate(`/sessions/${s.id}/review`)}
                    >
                      <Eye size={13} /> View Note
                    </button>
                    <button
                      className={styles.viewBtn}
                      onClick={() => navigate(`/sessions/${s.id}/transcript`)}
                    >
                      <FileText size={13} /> Transcript
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && (
        <PaginationBar
          currentPage={data.page}
          totalPages={data.total_pages}
          total={data.total}
          onPageChange={page => updateFilter('page', page)}
        />
      )}
    </div>
  )
}
