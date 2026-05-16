import { useNavigate } from 'react-router-dom'
import { useSessionHistory } from '../hooks/useSessionHistory'
import { useDoctors } from '../context/DoctorsContext'
import { formatDuration, formatDate } from '../utils/format'
import { Eye, FileText, Search, ClipboardList, X } from 'lucide-react'
import styles from './MobileSessionHistory.module.css'

function StatusPill({ status }) {
  const map = {
    completed: styles.pillCompleted,
    recording: styles.pillRecording,
    idle:      styles.pillIdle,
  }
  return (
    <span className={`${styles.pill} ${map[status] ?? styles.pillIdle}`}>
      {status === 'recording' && <span className={styles.recDot} />}
      {status}
    </span>
  )
}

function SessionCard({ session, getDoctorName, onViewNote, onViewTranscript }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardTop}>
        <div className={styles.cardLeft}>
          <span className={styles.patientName}>
            {session.patient_name ?? 'Patient not set'}
          </span>
          <span className={styles.doctor}>{getDoctorName(session.doctor_id)}</span>
        </div>
        <StatusPill status={session.status} />
      </div>

      <div className={styles.cardMeta}>
        <span>{formatDate(session.created_at)}</span>
        {session.duration_seconds > 0 && (
          <span>{formatDuration(session.duration_seconds)}</span>
        )}
      </div>

      <div className={styles.cardActions}>
        <button className={styles.actionBtn} onClick={onViewNote}>
          <Eye size={13} /> View Note
        </button>
        <button className={styles.actionBtn} onClick={onViewTranscript}>
          <FileText size={13} /> Transcript
        </button>
      </div>
    </div>
  )
}

export default function MobileSessionHistory({ filter }) {
  const navigate = useNavigate()
  const { getDoctorName } = useDoctors()
  const { data, loading, error, filters, updateFilter } = useSessionHistory()

  const hasMore = data.page < data.total_pages

  return (
    <div className={styles.screen}>
      {/* Sticky top bar */}
      <div className={styles.topbar}>
        <h1 className={styles.title}>
          {filter === 'active' ? 'Active Sessions' : 'Session History'}
        </h1>

        {/* Search */}
        <div className={styles.searchBar}>
          <Search size={14} className={styles.searchIcon} />
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Search patient…"
            value={filters.search}
            onChange={e => updateFilter('search', e.target.value)}
          />
          {filters.search && (
            <button className={styles.clearBtn} onClick={() => updateFilter('search', '')}>
              <X size={13} />
            </button>
          )}
        </div>

        {/* Status filter chips */}
        <div className={styles.chipRow}>
          {['', 'completed', 'recording', 'idle'].map(s => (
            <button
              key={s}
              className={`${styles.filterChip} ${filters.status === s ? styles.filterChipActive : ''}`}
              onClick={() => updateFilter('status', s)}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className={styles.list}>
        {error && (
          <div className={styles.errorBanner}>Failed to load: {error}</div>
        )}

        {loading && data.items.length === 0 ? (
          <div className={styles.skeletons}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} className={styles.skeletonCard}>
                <div className="skeleton-box" style={{ height: 14, width: '55%', borderRadius: 4 }} />
                <div className="skeleton-box" style={{ height: 11, width: '35%', borderRadius: 4, marginTop: 6 }} />
                <div className="skeleton-box" style={{ height: 11, width: '45%', borderRadius: 4, marginTop: 8 }} />
              </div>
            ))}
          </div>
        ) : data.items.length === 0 ? (
          <div className={styles.emptyState}>
            <ClipboardList size={40} strokeWidth={1} className={styles.emptyIcon} />
            <p className={styles.emptyText}>No sessions match your filters</p>
            <button className={styles.newBtn} onClick={() => navigate('/sessions/new')}>
              Start a session
            </button>
          </div>
        ) : (
          <>
            <div className={styles.countRow}>
              {data.total} session{data.total !== 1 ? 's' : ''}
            </div>

            {data.items.map(s => (
              <SessionCard
                key={s.id}
                session={s}
                getDoctorName={getDoctorName}
                onViewNote={() => navigate(`/sessions/${s.id}/review`)}
                onViewTranscript={() => navigate(`/sessions/${s.id}/transcript`)}
              />
            ))}

            {loading && (
              <div className={styles.loadingRow}>
                <span className={styles.spinner} /> Loading…
              </div>
            )}

            {!loading && hasMore && (
              <button
                className={styles.loadMoreBtn}
                onClick={() => updateFilter('page', data.page + 1)}
              >
                Load more
              </button>
            )}

            <div style={{ height: 24 }} />
          </>
        )}
      </div>
    </div>
  )
}
