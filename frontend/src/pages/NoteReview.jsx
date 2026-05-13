import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useNote } from '../hooks/useNote'
import { useUiStore } from '../stores/uiStore'
import { formatRelativeTime } from '../utils/format'
import { ArrowLeft, Printer, FileDown, CheckCircle, FileText } from 'lucide-react'
import { apiFetch } from '../utils/apiFetch'
import styles from './NoteReview.module.css'

const BASE = import.meta.env.VITE_API_URL || ''

const SOAP_SECTIONS = [
  { key: 'subjective',  label: 'Subjective (S)' },
  { key: 'objective',   label: 'Objective (O)' },
  { key: 'assessment',  label: 'Assessment (A)' },
  { key: 'plan',        label: 'Plan (P)' },
]

const AUDIT_LABELS = {
  generated:    '✨ Generated',
  regenerated:  '🔄 Regenerated',
  section_edit: '✏️ Edited',
  finalized:    '✅ Finalized',
}

const SOAP_SECTION_LABELS = {
  subjective:       'Subjective',
  objective:        'Objective',
  assessment:       'Assessment',
  plan:             'Plan',
  chief_complaint:  'Chief Complaint',
}

// ── Loading / Generating state ─────────────────────────────────────────────────
function GeneratingState({ status }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', minHeight: '60vh', gap: 'var(--space-4)' }}>
      <div style={{ width: '56px', height: '56px', borderRadius: '50%',
                    background: 'var(--color-surface-2)',
                    animation: 'pulse 1.5s ease-in-out infinite' }} />
      <h2 style={{ color: 'var(--color-text)', fontSize: 'var(--text-lg)', fontWeight: 700 }}>
        {status === 'generating' ? 'Generating clinical note…' : 'Loading note…'}
      </h2>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)',
                  maxWidth: '40ch', textAlign: 'center' }}>
        {status === 'generating'
          ? 'AI is analysing the transcript and generating your SOAP note. This takes 15–30 seconds.'
          : 'Fetching your note…'}
      </p>
      {status === 'generating' && (
        <div style={{ width: '240px', height: '4px', background: 'var(--color-surface-offset)',
                      borderRadius: '999px', overflow: 'hidden' }}>
          <div style={{ height: '100%', background: 'var(--color-primary)',
                        borderRadius: '999px', width: '40%',
                        animation: 'pulse 1.5s ease-in-out infinite' }} />
        </div>
      )}
    </div>
  )
}

// ── Error state ────────────────────────────────────────────────────────────────
function ErrorState({ errorMessage, onRetry }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', minHeight: '60vh', gap: 'var(--space-4)' }}>
      <span style={{ fontSize: '2rem' }}>⚠️</span>
      <h2 style={{ color: 'var(--color-error)', fontSize: 'var(--text-lg)', fontWeight: 700 }}>
        Note generation failed
      </h2>
      <p style={{ color: 'var(--color-text-muted)', maxWidth: '40ch', textAlign: 'center',
                  fontSize: 'var(--text-sm)' }}>
        {errorMessage}
      </p>
      <button
        onClick={onRetry}
        style={{ background: 'var(--color-primary)', color: '#fff', border: 'none',
                 borderRadius: 'var(--radius-md)', padding: 'var(--space-2) var(--space-5)',
                 fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer' }}>
        Try Again
      </button>
    </div>
  )
}

// ── Confidence bar ─────────────────────────────────────────────────────────────
function ConfidenceBar({ score }) {
  const pct = Math.round((score || 0) * 100)
  const color = score > 0.7 ? 'var(--color-success)' : score > 0.4 ? 'var(--color-warning)' : 'var(--color-error)'
  return (
    <div style={{ padding: 'var(--space-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-1)' }}>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Note Confidence</span>
        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color }}>{pct}%</span>
      </div>
      <div style={{ height: '6px', background: 'var(--color-surface-offset)', borderRadius: '999px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color,
                      borderRadius: '999px', transition: 'width 0.5s ease' }} />
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function NoteReview() {
  const { id: sessionId } = useParams()
  const navigate = useNavigate()
  const addToast = useUiStore((s) => s.addToast)

  const { note, status, errorMessage, refetch } = useNote(sessionId)

  const [edits, setEdits] = useState({})
  const [editingSection, setEditingSection] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [auditLog, setAuditLog] = useState([])

  const noteId = note?.note_id

  useEffect(() => {
    if (!noteId) return
    fetch(`${BASE}/api/notes/${noteId}/audit`)
      .then(r => r.json())
      .then(setAuditLog)
      .catch(() => {})
  }, [noteId, note?.status])

  const displayNote = note ? { ...note, ...edits } : null

  if (status === 'loading' || status === 'generating') {
    return <GeneratingState status={status} />
  }

  if (status === 'error') {
    return <ErrorState errorMessage={errorMessage} onRetry={refetch} />
  }

  if (!displayNote) return null

  const handleEdit = (key) => {
    setEditingSection(key)
    setEdits((e) => ({ ...e, [key]: displayNote[key] ?? '' }))
  }

  const handleCancelEdit = () => {
    setEdits((e) => {
      const copy = { ...e }
      delete copy[editingSection]
      return copy
    })
    setEditingSection(null)
  }

  const handleSaveEdits = async () => {
    if (!note?.note_id || Object.keys(edits).length === 0) {
      setEditingSection(null)
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      const res = await apiFetch(`/api/notes/${note.note_id}`, {
        method: 'PATCH',
        body: JSON.stringify(edits),
      })
      if (!res.ok) throw new Error(`Save failed: HTTP ${res.status}`)
      setEdits({})
      setEditingSection(null)
      addToast({ type: 'success', message: 'Section saved' })
      refetch()
    } catch (err) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDownloadPdf = async () => {
    if (!noteId) return
    try {
      const res = await apiFetch(`/api/notes/${noteId}/export/pdf`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `mediscribe_note_${noteId.slice(0, 8)}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      addToast({ type: 'success', message: 'PDF downloaded' })
    } catch (e) {
      addToast({ type: 'error', message: `PDF export failed: ${e.message}` })
    }
  }

  const handleFinalize = async () => {
    if (!note?.note_id) return
    try {
      const res = await apiFetch(`/api/notes/${note.note_id}/finalize`, { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      addToast({ type: 'success', message: 'Note finalized and signed ✓' })
      refetch()
    } catch (err) {
      setSaveError(`Finalize failed: ${err.message}`)
    }
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>
            SOAP Note — {new Date(displayNote.created_at || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
          </h1>
          <p className={styles.subtitle}>
            Chief complaint: {displayNote.chief_complaint || '—'}
            {displayNote.generated_by && displayNote.generated_by !== 'stub' && (
              <span style={{ marginLeft: 'var(--space-3)', color: 'var(--color-primary)',
                             fontSize: 'var(--text-xs)', fontWeight: 600 }}>
                ✦ Generated by {displayNote.generated_by}
              </span>
            )}
          </p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.iconBtn} onClick={() => window.print()}>
            <Printer size={14} /> Print
          </button>
          <button
            className={styles.iconBtn}
            onClick={handleDownloadPdf}
            disabled={!noteId || note?.status === 'generating'}
          >
            <FileDown size={14} /> Export PDF
          </button>
        </div>
      </div>

      {saveError && (
        <div style={{ background: 'var(--color-error-light)', color: 'var(--color-error)',
                      padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--text-sm)' }}>
          ⚠ {saveError}
        </div>
      )}

      <div className={styles.layout}>
        {/* Main note — SOAP sections */}
        <div className={styles.notePanel}>
          {SOAP_SECTIONS.map(({ key, label }) => (
            <div key={key} className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionLabel}>{label}</span>
                {!displayNote.is_finalized && (
                  editingSection === key ? (
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                      <button className={styles.saveBtn} onClick={handleSaveEdits} disabled={saving}>
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                      <button className={styles.editBtn} onClick={handleCancelEdit}>Cancel</button>
                    </div>
                  ) : (
                    <button className={styles.editBtn} onClick={() => handleEdit(key)}>Edit</button>
                  )
                )}
              </div>
              {editingSection === key ? (
                <textarea
                  className={styles.textarea}
                  value={edits[key] ?? ''}
                  onChange={(e) => setEdits((f) => ({ ...f, [key]: e.target.value }))}
                  rows={5}
                  autoFocus
                />
              ) : (
                <p className={styles.sectionContent}>{displayNote[key] || '—'}</p>
              )}
            </div>
          ))}

          {/* ICD-10 codes */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionLabel}>ICD-10 Codes</span>
            </div>
            <div className={styles.icdChips}>
              {(displayNote.icd_codes || []).length > 0 ? (
                displayNote.icd_codes.map((icd) => (
                  <span key={icd.code} className={styles.icdChip} title={icd.description}>
                    {icd.code} — {icd.description}
                  </span>
                ))
              ) : (
                <span style={{ color: 'var(--color-text-faint)', fontSize: 'var(--text-xs)',
                               padding: '0 var(--space-4) var(--space-4)' }}>
                  No ICD codes suggested
                </span>
              )}
            </div>
          </div>

          {/* Missing information hints */}
          {(displayNote.missing_information || []).filter(m => !m.startsWith('Note generated from stub')).length > 0 && (
            <div style={{ background: 'var(--color-warning-light)', border: '1px solid var(--color-warning)',
                          borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)' }}>
              <p style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-warning)',
                          marginBottom: 'var(--space-2)', textTransform: 'uppercase' }}>
                Missing Information
              </p>
              <ul style={{ margin: 0, paddingLeft: 'var(--space-4)', fontSize: 'var(--text-xs)',
                           color: 'var(--color-text-secondary)' }}>
                {displayNote.missing_information.map((m, i) => <li key={i}>{m}</li>)}
              </ul>
            </div>
          )}

          <ConfidenceBar score={displayNote.confidence_score} />
        </div>

        {/* Sidebar */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarCard}>
            <h3 className={styles.sidebarTitle}>Session Info</h3>
            <dl className={styles.metaList}>
              <div className={styles.metaRow}>
                <dt>Date</dt>
                <dd>{new Date(displayNote.created_at || Date.now()).toLocaleDateString('en-IN')}</dd>
              </div>
              <div className={styles.metaRow}>
                <dt>Status</dt>
                <dd style={{ textTransform: 'capitalize' }}>{note.status}</dd>
              </div>
              <div className={styles.metaRow}>
                <dt>Confidence</dt>
                <dd>{Math.round((displayNote.confidence_score || 0) * 100)}%</dd>
              </div>
              <div className={styles.metaRow}>
                <dt>Model</dt>
                <dd>{displayNote.generated_by || '—'}</dd>
              </div>
            </dl>
          </div>

          <button
            className={styles.editBtn}
            onClick={() => navigate(`/sessions/${sessionId}/transcript`)}
            style={{ width: '100%', justifyContent: 'flex-start', marginBottom: 'var(--space-3)',
                     display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}
          >
            <FileText size={14} />
            View Raw Transcript
          </button>

          {displayNote.is_finalized && (
            <div className={styles.finalizedBadge}>
              <CheckCircle size={14} /> Finalized
            </div>
          )}

          <div className={styles.auditSection}>
            <h4 className={styles.sidebarTitle}>Edit History</h4>
            {auditLog.length === 0 ? (
              <p className={styles.auditEmpty}>No changes recorded yet</p>
            ) : (
              auditLog.map(entry => (
                <div key={entry.id} className={styles.auditEntry}>
                  <span className={styles.auditBadge}>
                    {AUDIT_LABELS[entry.change_type] ?? entry.change_type}
                  </span>
                  <span className={styles.auditTime}>{formatRelativeTime(entry.created_at)}</span>
                  {entry.change_type === 'section_edit' && entry.snapshot?.section && (
                    <span className={styles.auditDetail}>
                      {SOAP_SECTION_LABELS[entry.snapshot.section] ?? entry.snapshot.section}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </aside>
      </div>

      {/* Action bar */}
      <div className={styles.actionBar}>
        <button className={styles.backBtn} onClick={() => navigate('/sessions/history')}>
          <ArrowLeft size={14} /> Back to Sessions
        </button>
        <div className={styles.actionBarRight}>
          <button className={styles.finalizeBtn} onClick={handleFinalize}
                  disabled={displayNote.is_finalized}>
            <CheckCircle size={14} />
            {displayNote.is_finalized ? 'Finalized' : 'Finalize & Sign Note'}
          </button>
        </div>
      </div>
    </div>
  )
}
