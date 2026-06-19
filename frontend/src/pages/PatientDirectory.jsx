import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { patientsApi } from '../services/api'
import { Search, UserSquare, ChevronRight, Plus } from 'lucide-react'
import styles from './PatientDirectory.module.css'

function avatarGradient() {
  return 'linear-gradient(135deg, #1a1a1a 0%, #404040 100%)'
}

function genderIcon(gender) {
  if (!gender) return null
  const g = gender.toLowerCase()
  if (g === 'male') return '♂'
  if (g === 'female') return '♀'
  return '⚧'
}

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

function SkeletonRow() {
  return (
    <div className={styles.skeletonRow}>
      <div className={`skeleton-box ${styles.skeletonAvatar}`} />
      <div className={styles.skeletonInfo}>
        <div className="skeleton-box" style={{ height: 14, width: '45%' }} />
        <div className="skeleton-box" style={{ height: 11, width: '30%' }} />
      </div>
    </div>
  )
}

export default function PatientDirectory() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [patients, setPatients] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const inputRef = useRef(null)

  const debouncedQuery = useDebounce(query, 300)

  useEffect(() => { setPage(1) }, [debouncedQuery])

  useEffect(() => {
    if (debouncedQuery.length > 0 && debouncedQuery.length < 3) return
    setLoading(true)
    setError(null)
    const params = { page, page_size: 20 }
    if (debouncedQuery.length >= 3) params.search = debouncedQuery
    patientsApi.list(params)
      .then(data => { setPatients(data.items || []); setTotal(data.total || 0) })
      .catch(err => setError(err.message || 'Failed to load patients'))
      .finally(() => setLoading(false))
  }, [debouncedQuery, page])

  useEffect(() => { inputRef.current?.focus() }, [])

  const showSearchHint = query.length > 0 && query.length < 3

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>Patients</h1>
          {!loading && total > 0 && (
            <span className={styles.totalBadge}>{total}</span>
          )}
        </div>
        <button className={styles.newBtn} onClick={() => navigate('/sessions/new')}>
          <Plus size={14} /> New Session
        </button>
      </div>

      {/* Search */}
      <div className={styles.searchWrap}>
        <Search size={16} className={styles.searchIcon} />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search patients by name…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className={styles.searchInput}
        />
        {query && (
          <button className={styles.clearBtn} onClick={() => setQuery('')}>✕</button>
        )}
      </div>

      {showSearchHint && (
        <p className={styles.searchHint}>Type at least 3 characters to search</p>
      )}

      {/* Content */}
      {loading ? (
        <div className={styles.list}>
          {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      ) : error ? (
        <div className="error-state">
          <p className="error-state-message">{error}</p>
        </div>
      ) : patients.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}><UserSquare size={28} strokeWidth={1.4} /></div>
          <p className={styles.emptyTitle}>
            {query.length >= 3 ? `No patients matching "${query}"` : 'No patients yet'}
          </p>
          <p className={styles.emptyHint}>
            Patients are created automatically when you start a new session.
          </p>
        </div>
      ) : (
        <>
          <p className={styles.resultMeta}>
            {total} patient{total !== 1 ? 's' : ''} {query.length >= 3 ? `matching "${query}"` : 'total'}
          </p>

          <div className={styles.list}>
            {patients.map(p => {
              const firstCondition = p.chronic_conditions
                ? p.chronic_conditions.split(',')[0].trim()
                : null

              const metaParts = [
                p.age != null && `${p.age}y`,
                p.phone,
              ].filter(Boolean)

              return (
                <button
                  key={p.id}
                  className={styles.patientRow}
                  onClick={() => navigate(`/patients/${p.id}`)}
                >
                  <div
                    className={styles.avatar}
                    style={{ background: avatarGradient(p.name) }}
                  >
                    {p.name.trim().charAt(0).toUpperCase()}
                  </div>

                  <div className={styles.info}>
                    <div className={styles.nameRow}>
                      <span className={styles.name}>{p.name}</span>
                      {p.gender && (
                        <span className={styles.genderBadge}>{genderIcon(p.gender)}</span>
                      )}
                      {firstCondition && (
                        <span className={styles.conditionChip}>{firstCondition}</span>
                      )}
                    </div>
                    <div className={styles.meta}>
                      {metaParts.length > 0 ? metaParts.join(' · ') : 'No additional details'}
                    </div>
                  </div>

                  <div className={styles.right}>
                    <div className={styles.visitBadge}>
                      <span className={styles.visitNum}>{p.visit_count}</span>
                      <span className={styles.visitLabel}>{p.visit_count === 1 ? 'visit' : 'visits'}</span>
                    </div>
                    <ChevronRight size={14} className={styles.chevron} />
                  </div>
                </button>
              )
            })}
          </div>

          {total > 20 && (
            <div className={styles.pagination}>
              <button
                className="btn btn-ghost btn-sm"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >
                ← Prev
              </button>
              <span className={styles.pageInfo}>Page {page} of {Math.ceil(total / 20)}</span>
              <button
                className="btn btn-ghost btn-sm"
                disabled={page * 20 >= total}
                onClick={() => setPage(p => p + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
