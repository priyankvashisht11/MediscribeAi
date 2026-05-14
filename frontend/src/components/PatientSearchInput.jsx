import { useState, useEffect, useRef } from 'react'
import { patientsApi } from '../services/api'
import { Search, UserSquare } from 'lucide-react'

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

/**
 * Typeahead patient search input.
 * Props:
 *   value: string (patient name text)
 *   onChange(name, existingPatient | null): called on every input change
 *   onSelect(patient): called when user picks an existing patient
 *   placeholder: string
 */
export default function PatientSearchInput({ value, onChange, onSelect, placeholder }) {
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const debounced = useDebounce(value, 300)
  const containerRef = useRef(null)

  useEffect(() => {
    if (debounced.length < 3) {
      setResults([])
      setOpen(false)
      return
    }
    patientsApi.list({ search: debounced, page: 1, page_size: 5 })
      .then(data => {
        setResults(data.items || [])
        setOpen((data.items || []).length > 0)
        setActiveIdx(-1)
      })
      .catch(() => { setResults([]); setOpen(false) })
  }, [debounced])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = (patient) => {
    onChange(patient.name, patient)
    onSelect?.(patient)
    setOpen(false)
    setResults([])
  }

  const handleKeyDown = (e) => {
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, -1))
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault()
      handleSelect(results[activeIdx])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input
        type="text"
        value={value}
        onChange={e => { onChange(e.target.value, null); setOpen(true) }}
        onKeyDown={handleKeyDown}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder={placeholder || 'Patient name'}
        autoComplete="off"
        style={{
          width: '100%', padding: 'var(--space-2) var(--space-3)',
          fontSize: 'var(--text-sm)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-sm)', background: 'var(--color-surface)',
          color: 'var(--color-text)', boxSizing: 'border-box',
        }}
      />

      {/* Dropdown */}
      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)',
          marginTop: 4, overflow: 'hidden',
        }}>
          <div style={{ padding: 'var(--space-2) var(--space-3)',
                        fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)',
                        borderBottom: '1px solid var(--color-border)' }}>
            Existing patients — select to reuse record
          </div>
          {results.map((p, i) => (
            <button
              key={p.id}
              onMouseDown={() => handleSelect(p)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center',
                gap: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)',
                border: 'none', cursor: 'pointer', textAlign: 'left',
                background: i === activeIdx ? 'var(--color-primary-light)' : 'transparent',
                transition: 'background 0.1s',
              }}
              onMouseEnter={() => setActiveIdx(i)}
            >
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'var(--color-primary-light)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-primary)',
                flexShrink: 0,
              }}>
                {p.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500,
                               color: 'var(--color-text)' }}>
                  {p.name}
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                  {[p.age != null && `${p.age}y`, p.gender, p.phone].filter(Boolean).join(' · ')}
                  {p.visit_count > 0 && ` · ${p.visit_count} visit${p.visit_count !== 1 ? 's' : ''}`}
                </div>
              </div>
              {p.chronic_conditions && (
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-warning)',
                                flexShrink: 0 }}>
                  ⚠ {p.chronic_conditions.split(',')[0].trim()}
                </span>
              )}
            </button>
          ))}
          <div style={{
            padding: 'var(--space-2) var(--space-3)',
            borderTop: '1px solid var(--color-border)',
            fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)',
          }}>
            Not in list? Continue typing to create a new patient record.
          </div>
        </div>
      )}
    </div>
  )
}
