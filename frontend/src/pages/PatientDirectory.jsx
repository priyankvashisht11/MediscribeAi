import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { patientsApi } from '../services/api'
import { Search, UserSquare, ChevronRight, Plus } from 'lucide-react'

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

function genderIcon(gender) {
  if (!gender) return ''
  const g = gender.toLowerCase()
  if (g === 'male') return '♂'
  if (g === 'female') return '♀'
  return '⚧'
}

export default function PatientDirectory() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [patients, setPatients] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const inputRef = useRef(null)

  const debouncedQuery = useDebounce(query, 300)

  useEffect(() => {
    setPage(1)
  }, [debouncedQuery])

  useEffect(() => {
    if (debouncedQuery.length > 0 && debouncedQuery.length < 3) return

    setLoading(true)
    setError(null)
    const params = { page, page_size: 20 }
    if (debouncedQuery.length >= 3) params.search = debouncedQuery

    patientsApi.list(params)
      .then(data => {
        setPatients(data.items || [])
        setTotal(data.total || 0)
      })
      .catch(err => setError(err.message || 'Failed to load patients'))
      .finally(() => setLoading(false))
  }, [debouncedQuery, page])

  // Focus search on mount
  useEffect(() => { inputRef.current?.focus() }, [])

  const showSearchHint = query.length > 0 && query.length < 3

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 'var(--space-6)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: 'var(--space-6)' }}>
        <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>Patients</h1>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => navigate('/sessions/new')}
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}
        >
          <Plus size={14} /> New Session
        </button>
      </div>

      {/* Search bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
        background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)', padding: 'var(--space-2) var(--space-3)',
        marginBottom: 'var(--space-4)',
      }}>
        <Search size={16} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search by name (min. 3 characters)…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{
            flex: 1, border: 'none', outline: 'none',
            background: 'transparent', fontSize: 'var(--text-sm)',
            color: 'var(--color-text)',
          }}
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            style={{ background: 'none', border: 'none', cursor: 'pointer',
                     color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}
          >
            ✕
          </button>
        )}
      </div>

      {showSearchHint && (
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)',
                    marginBottom: 'var(--space-3)', paddingLeft: 'var(--space-1)' }}>
          Type at least 3 characters to search
        </p>
      )}

      {/* Results */}
      {loading ? (
        <div style={{ padding: 'var(--space-12)', textAlign: 'center',
                      color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
          Loading…
        </div>
      ) : error ? (
        <div className="error-state">
          <p className="error-state-message">{error}</p>
        </div>
      ) : patients.length === 0 ? (
        <div style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
          <UserSquare size={40} style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }} />
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
            {query.length >= 3 ? `No patients matching "${query}"` : 'No patients yet'}
          </p>
          <p style={{ color: 'var(--color-text-faint)', fontSize: 'var(--text-xs)', marginTop: 'var(--space-2)' }}>
            Patients are created automatically when you start a new session
          </p>
        </div>
      ) : (
        <>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)',
                      marginBottom: 'var(--space-3)', paddingLeft: 'var(--space-1)' }}>
            {total} patient{total !== 1 ? 's' : ''} {query.length >= 3 ? `matching "${query}"` : 'total'}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {patients.map(p => (
              <button
                key={p.id}
                onClick={() => navigate(`/patients/${p.id}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--space-4)',
                  background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)',
                  cursor: 'pointer', textAlign: 'left', width: '100%',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--color-border)'}
              >
                {/* Avatar */}
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: 'var(--color-primary-light)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 'var(--text-sm)', fontWeight: 700,
                  color: 'var(--color-primary)', flexShrink: 0,
                }}>
                  {p.name.trim().charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>
                      {p.name}
                    </span>
                    {p.gender && (
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                        {genderIcon(p.gender)}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>
                    {[p.age != null && `${p.age}y`, p.phone].filter(Boolean).join(' · ') || 'No details'}
                    {p.chronic_conditions && (
                      <span style={{ marginLeft: 'var(--space-2)', color: 'var(--color-warning)' }}>
                        · {p.chronic_conditions.split(',')[0].trim()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Visit count + chevron */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                              flexShrink: 0 }}>
                  <span style={{
                    fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)',
                    background: 'var(--color-surface-2)', borderRadius: 'var(--radius-sm)',
                    padding: '2px 8px',
                  }}>
                    {p.visit_count} visit{p.visit_count !== 1 ? 's' : ''}
                  </span>
                  <ChevronRight size={14} style={{ color: 'var(--color-text-muted)' }} />
                </div>
              </button>
            ))}
          </div>

          {/* Pagination */}
          {total > 20 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                          gap: 'var(--space-4)', marginTop: 'var(--space-6)' }}>
              <button
                className="btn btn-ghost btn-sm"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >
                ← Prev
              </button>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                Page {page} of {Math.ceil(total / 20)}
              </span>
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
