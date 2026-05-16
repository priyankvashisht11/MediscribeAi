import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { patientsApi } from '../services/api'
import { Search, UserSquare, ChevronRight, Plus, X } from 'lucide-react'
import styles from './MobilePatientDirectory.module.css'

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

function Avatar({ name }) {
  return (
    <div className={styles.avatar}>
      {name.trim().charAt(0).toUpperCase()}
    </div>
  )
}

function PatientRow({ patient, onTap }) {
  return (
    <button className={styles.row} onClick={onTap}>
      <Avatar name={patient.name} />
      <div className={styles.rowInfo}>
        <span className={styles.rowName}>{patient.name}</span>
        <span className={styles.rowMeta}>
          {[
            patient.age != null && `${patient.age}y`,
            patient.gender,
            patient.phone,
          ].filter(Boolean).join(' · ') || 'No details'}
          {patient.chronic_conditions && (
            <span className={styles.conditionHint}>
              {' · '}
              {patient.chronic_conditions.split(',')[0].trim()}
            </span>
          )}
        </span>
      </div>
      <div className={styles.rowRight}>
        <span className={styles.visitBadge}>
          {patient.visit_count} visit{patient.visit_count !== 1 ? 's' : ''}
        </span>
        <ChevronRight size={14} className={styles.chevron} />
      </div>
    </button>
  )
}

export default function MobilePatientDirectory() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [patients, setPatients] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const inputRef = useRef(null)

  const debouncedQuery = useDebounce(query, 300)

  useEffect(() => { setPage(1) }, [debouncedQuery])

  useEffect(() => {
    if (debouncedQuery.length > 0 && debouncedQuery.length < 3) return
    setLoading(true)
    setError(null)
    const params = { page, page_size: 25 }
    if (debouncedQuery.length >= 3) params.search = debouncedQuery

    patientsApi.list(params)
      .then(data => {
        setPatients(prev => page === 1 ? (data.items || []) : [...prev, ...(data.items || [])])
        setTotal(data.total || 0)
      })
      .catch(err => setError(err.message || 'Failed to load patients'))
      .finally(() => setLoading(false))
  }, [debouncedQuery, page])

  const showHint = query.length > 0 && query.length < 3
  const hasMore = patients.length < total

  return (
    <div className={styles.screen}>
      {/* Sticky header + search */}
      <div className={styles.topbar}>
        <div className={styles.topbarRow}>
          <h1 className={styles.title}>Patients</h1>
          {total > 0 && <span className={styles.countPill}>{total}</span>}
        </div>
        <div className={styles.searchBar}>
          <Search size={15} className={styles.searchIcon} />
          <input
            ref={inputRef}
            type="search"
            placeholder="Search by name…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className={styles.searchInput}
          />
          {query && (
            <button className={styles.clearBtn} onClick={() => setQuery('')}>
              <X size={14} />
            </button>
          )}
        </div>
        {showHint && (
          <p className={styles.hint}>Type at least 3 characters to search</p>
        )}
      </div>

      {/* Scrollable list */}
      <div className={styles.list}>
        {error ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyText}>{error}</p>
          </div>
        ) : !loading && patients.length === 0 ? (
          <div className={styles.emptyState}>
            <UserSquare size={40} className={styles.emptyIcon} />
            <p className={styles.emptyText}>
              {debouncedQuery.length >= 3
                ? `No patients matching "${debouncedQuery}"`
                : 'No patients yet'}
            </p>
            {debouncedQuery.length < 3 && (
              <p className={styles.emptyHint}>
                Patients are created automatically when you start a new session
              </p>
            )}
          </div>
        ) : (
          <>
            {patients.map(p => (
              <PatientRow
                key={p.id}
                patient={p}
                onTap={() => navigate(`/patients/${p.id}`)}
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
                onClick={() => setPage(n => n + 1)}
              >
                Load more ({total - patients.length} remaining)
              </button>
            )}

            {/* Bottom spacer for FAB */}
            <div style={{ height: 80 }} />
          </>
        )}
      </div>

      {/* FAB — New Session */}
      <button
        className={styles.fab}
        onClick={() => navigate('/sessions/new')}
        aria-label="New Session"
      >
        <Plus size={22} />
      </button>
    </div>
  )
}
