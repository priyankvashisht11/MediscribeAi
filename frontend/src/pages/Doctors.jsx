import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../utils/apiFetch'
import { Stethoscope, ArrowRight, Calendar, Search } from 'lucide-react'
import styles from './Doctors.module.css'

function avatarGradient() {
  return 'linear-gradient(135deg, #1a1a1a 0%, #404040 100%)'
}

function initials(name) {
  const cleaned = name.replace(/^(dr\.?\s+|prof\.?\s+)/i, '').trim()
  const parts = cleaned.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return cleaned.slice(0, 2).toUpperCase()
}

function formatLastSeen(iso) {
  if (!iso) return 'No sessions yet'
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now - d) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function DoctorCardSkeleton() {
  return (
    <div className={styles.card}>
      <div className={`skeleton-box ${styles.avatarSkeleton}`} />
      <div className={styles.info}>
        <div className="skeleton-box" style={{ height: 14, width: '70%', marginBottom: 8 }} />
        <div className="skeleton-box" style={{ height: 11, width: '45%', marginBottom: 6 }} />
        <div className="skeleton-box" style={{ height: 11, width: '60%' }} />
      </div>
    </div>
  )
}

export default function DoctorsPage() {
  const navigate = useNavigate()
  const [doctors, setDoctors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    apiFetch('/api/doctors/with-stats')
      .then(r => r.json())
      .then(data => { setDoctors(data); setLoading(false) })
      .catch(err => { setError(err.message || 'Failed to load'); setLoading(false) })
  }, [])

  useEffect(() => { if (!loading) inputRef.current?.focus() }, [loading])

  const q = query.trim().toLowerCase()
  const filtered = q
    ? doctors.filter(d =>
        d.name.toLowerCase().includes(q) ||
        (d.specialty || '').toLowerCase().includes(q) ||
        (d.email || '').toLowerCase().includes(q)
      )
    : doctors

  if (error) {
    return (
      <div className="error-state">
        <Stethoscope size={24} style={{ color: 'var(--color-error)' }} />
        <p className="error-state-message">Failed to load doctors: {error}</p>
        <button className="btn btn-ghost btn-sm" onClick={() => window.location.reload()}>Try Again</button>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Doctors</h1>
        {!loading && doctors.length > 0 && (
          <span className={styles.countBadge}>{filtered.length}</span>
        )}
      </div>

      {/* Search */}
      {!loading && doctors.length > 0 && (
        <div className={styles.searchWrap}>
          <Search size={15} className={styles.searchIcon} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search by name, specialty, or email…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className={styles.searchInput}
          />
          {query && (
            <button className={styles.clearBtn} onClick={() => setQuery('')}>✕</button>
          )}
        </div>
      )}

      <div className={styles.list}>
        {loading
          ? Array.from({ length: 5 }).map((_, i) => <DoctorCardSkeleton key={i} />)
          : filtered.length === 0 && q ? (
            <div style={{ padding: 'var(--space-8) 0', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
              No doctors matching "{query}"
            </div>
          )
          : filtered.map((d) => (
              <div key={d.id} className={styles.card}>
                <div
                  className={styles.avatar}
                  style={{ background: avatarGradient(d.name) }}
                >
                  {initials(d.name)}
                </div>
                <div className={styles.info}>
                  <p className={styles.name}>{d.name}</p>
                  <div className={styles.metaRow}>
                    {d.specialty && <span className={styles.specialty}>{d.specialty}</span>}
                    {d.email && <span className={styles.email}>{d.email}</span>}
                  </div>
                  <div className={styles.metaRow} style={{ marginTop: 4, gap: 12 }}>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Calendar size={10} /> Last active: {formatLastSeen(d.last_session_at)}
                    </span>
                  </div>
                </div>
                <div className={styles.cardRight}>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div className={styles.statBox}>
                      <span className={styles.statNum}>{d.session_count}</span>
                      <span className={styles.statLbl}>sessions</span>
                    </div>
                    <div className={styles.statBox}>
                      <span className={styles.statNum}>{d.patient_count}</span>
                      <span className={styles.statLbl}>patients</span>
                    </div>
                    <div className={styles.statBox}>
                      <span className={styles.statNum}>{d.finalized_notes}</span>
                      <span className={styles.statLbl}>notes done</span>
                    </div>
                  </div>
                  <button
                    className={styles.viewBtn}
                    onClick={() => navigate(`/sessions/history?doctor=${d.id}`)}
                  >
                    View Sessions <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            ))
        }
      </div>
    </div>
  )
}
