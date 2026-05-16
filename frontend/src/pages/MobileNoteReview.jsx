import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useNote } from '../hooks/useNote'
import { useUiStore } from '../stores/uiStore'
import { apiFetch } from '../utils/apiFetch'
import { ChevronDown, ArrowLeft, CheckCircle, Share2, FileText } from 'lucide-react'
import { sharePdf } from '../utils/nativeShare'
import styles from './MobileNoteReview.module.css'

const BASE = import.meta.env.VITE_API_URL || ''

const SOAP_SECTIONS = [
  { key: 'subjective',  label: 'Subjective',  letter: 'S' },
  { key: 'objective',   label: 'Objective',   letter: 'O' },
  { key: 'assessment',  label: 'Assessment',  letter: 'A' },
  { key: 'plan',        label: 'Plan',        letter: 'P' },
]

// ── Generating / Loading state ─────────────────────────────────────────────────
function GeneratingState({ status }) {
  return (
    <div className={styles.centeredState}>
      <div className={styles.pulseCircle} />
      <h2 className={styles.stateTitle}>
        {status === 'generating' ? 'Generating note…' : 'Loading…'}
      </h2>
      <p className={styles.stateBody}>
        {status === 'generating'
          ? 'AI is analysing the transcript. This takes 15–30 seconds.'
          : 'Fetching your note…'}
      </p>
      {status === 'generating' && <div className={styles.progressBar}><div className={styles.progressFill} /></div>}
    </div>
  )
}

// ── Error state ────────────────────────────────────────────────────────────────
function ErrorState({ errorMessage, onRetry }) {
  return (
    <div className={styles.centeredState}>
      <span className={styles.errorIcon}>⚠️</span>
      <h2 className={styles.stateTitle} style={{ color: 'var(--color-error)' }}>Generation failed</h2>
      <p className={styles.stateBody}>{errorMessage}</p>
      <button className={styles.retryBtn} onClick={onRetry}>Try Again</button>
    </div>
  )
}

// ── Accordion section ──────────────────────────────────────────────────────────
function SoapAccordion({ section, value, isOpen, isEditing, isSaving, editValue,
                          onToggle, onEdit, onSaveEdit, onCancelEdit, onEditChange,
                          isFinalized }) {
  const textareaRef = useRef(null)

  // Scroll textarea into view when it appears (keyboard-aware)
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      setTimeout(() => {
        textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
    }
  }, [isEditing])

  return (
    <div className={`${styles.accordion} ${isOpen ? styles.accordionOpen : ''}`}>
      <button className={styles.accordionHeader} onClick={onToggle}>
        <div className={styles.accordionLeft}>
          <span className={styles.soapLetter}>{section.letter}</span>
          <span className={styles.soapLabel}>{section.label}</span>
        </div>
        <ChevronDown size={16} className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`} />
      </button>

      {isOpen && (
        <div className={styles.accordionBody}>
          {isEditing ? (
            <>
              <textarea
                ref={textareaRef}
                className={styles.textarea}
                value={editValue ?? ''}
                onChange={(e) => onEditChange(e.target.value)}
                rows={6}
                autoFocus
              />
              <div className={styles.editActions}>
                <button className={styles.cancelBtn} onClick={onCancelEdit}>Cancel</button>
                <button className={styles.saveBtn} onClick={onSaveEdit} disabled={isSaving}>
                  {isSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className={styles.sectionText}>{value || '—'}</p>
              {!isFinalized && (
                <button className={styles.editBtn} onClick={onEdit}>Edit</button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function MobileNoteReview() {
  const { id: sessionId } = useParams()
  const navigate = useNavigate()
  const addToast = useUiStore((s) => s.addToast)

  const { note, status, errorMessage, refetch } = useNote(sessionId)

  const [edits, setEdits] = useState({})
  const [editingSection, setEditingSection] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [openSections, setOpenSections] = useState(() => new Set(['subjective']))
  const [prescLoading, setPrescLoading] = useState(false)
  const [instrLoading, setInstrLoading] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)

  const noteId = note?.note_id
  const displayNote = note ? { ...note, ...edits } : null

  const toggleSection = (key) => {
    setOpenSections(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const handleEdit = (key) => {
    setEditingSection(key)
    setEdits(e => ({ ...e, [key]: displayNote[key] ?? '' }))
    setOpenSections(prev => new Set([...prev, key]))
  }

  const handleCancelEdit = () => {
    setEdits(e => { const c = { ...e }; delete c[editingSection]; return c })
    setEditingSection(null)
  }

  const handleSaveEdit = async () => {
    if (!note?.note_id || Object.keys(edits).length === 0) { setEditingSection(null); return }
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

  const _downloadPdf = async (endpoint, filename, setLoading, label) => {
    if (!noteId) return
    setLoading(true)
    const slowTimer = setTimeout(() => addToast({ type: 'info', message: 'Generating document…' }), 8000)
    try {
      const res = await apiFetch(`/api/notes/${noteId}/${endpoint}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      await sharePdf(blob, filename)
      addToast({ type: 'success', message: `${label} ready` })
    } catch (e) {
      addToast({ type: 'error', message: `${label} failed: ${e.message}` })
    } finally {
      clearTimeout(slowTimer)
      setLoading(false)
    }
  }

  const handleFinalize = async () => {
    if (!note?.note_id) return
    try {
      const res = await apiFetch(`/api/notes/${note.note_id}/finalize`, { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      addToast({ type: 'success', message: 'Note finalized ✓' })
      refetch()
    } catch (err) {
      setSaveError(`Finalize failed: ${err.message}`)
    }
  }

  if (status === 'loading' || status === 'generating') return <GeneratingState status={status} />
  if (status === 'error') return <ErrorState errorMessage={errorMessage} onRetry={refetch} />
  if (!displayNote) return null

  const confidencePct = Math.round((displayNote.confidence_score || 0) * 100)
  const confColor = confidencePct >= 70 ? 'var(--color-success)' : confidencePct >= 40 ? 'var(--color-warning)' : 'var(--color-error)'
  const noteDate = new Date(displayNote.created_at || Date.now()).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric'
  })

  return (
    <div className={styles.screen}>
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/sessions/history')}>
          <ArrowLeft size={18} />
        </button>
        <div className={styles.headerCenter}>
          <span className={styles.headerTitle}>SOAP Note</span>
          <span className={styles.headerDate}>{noteDate}</span>
        </div>
        {displayNote.is_finalized ? (
          <span className={styles.finalizedPill}><CheckCircle size={12} /> Done</span>
        ) : (
          <span className={styles.confPill} style={{ background: confColor + '22', color: confColor }}>
            {confidencePct}%
          </span>
        )}
      </div>

      {/* Chief complaint banner */}
      {displayNote.chief_complaint && (
        <div className={styles.ccBanner}>
          <span className={styles.ccLabel}>Chief Complaint</span>
          <span className={styles.ccText}>{displayNote.chief_complaint}</span>
        </div>
      )}

      {/* Save error */}
      {saveError && (
        <div className={styles.errorBanner}>⚠ {saveError}</div>
      )}

      {/* Scrollable content */}
      <div className={styles.content}>
        {/* SOAP Accordions */}
        {SOAP_SECTIONS.map(section => (
          <SoapAccordion
            key={section.key}
            section={section}
            value={displayNote[section.key]}
            isOpen={openSections.has(section.key)}
            isEditing={editingSection === section.key}
            isSaving={saving}
            editValue={edits[section.key]}
            onToggle={() => toggleSection(section.key)}
            onEdit={() => handleEdit(section.key)}
            onSaveEdit={handleSaveEdit}
            onCancelEdit={handleCancelEdit}
            onEditChange={(val) => setEdits(e => ({ ...e, [section.key]: val }))}
            isFinalized={displayNote.is_finalized}
          />
        ))}

        {/* ICD Codes */}
        {(displayNote.icd_codes || []).length > 0 && (
          <div className={styles.icdRow}>
            <span className={styles.icdLabel}>ICD-10</span>
            <div className={styles.icdChips}>
              {displayNote.icd_codes.map(icd => (
                <span key={icd.code} className={styles.icdChip} title={icd.description}>
                  {icd.code}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Missing info */}
        {(displayNote.missing_information || []).filter(m => !m.startsWith('Note generated from stub')).length > 0 && (
          <div className={styles.missingBanner}>
            <span className={styles.missingTitle}>Missing Info</span>
            <ul className={styles.missingList}>
              {displayNote.missing_information.map((m, i) => <li key={i}>{m}</li>)}
            </ul>
          </div>
        )}

        {/* Spacer so content isn't hidden behind action bar */}
        <div style={{ height: 160 }} />
      </div>

      {/* Fixed bottom action bar */}
      <div className={styles.actionBar}>
        {/* Transcript link */}
        <button
          className={styles.transcriptBtn}
          onClick={() => navigate(`/sessions/${sessionId}/transcript`)}
        >
          <FileText size={14} /> View Raw Transcript
        </button>

        {/* PDF download row */}
        <div className={styles.downloadRow}>
          <button
            className={styles.dlBtn}
            onClick={() => _downloadPdf('export/pdf', `note_${noteId?.slice(0,8)}.pdf`, setPdfLoading, 'SOAP PDF')}
            disabled={!noteId || pdfLoading}
          >
            <Share2 size={14} /> {pdfLoading ? '…' : 'SOAP PDF'}
          </button>
          <button
            className={styles.dlBtn}
            onClick={() => _downloadPdf('prescription', `rx_${noteId?.slice(0,8)}.pdf`, setPrescLoading, 'Prescription')}
            disabled={!noteId || prescLoading}
          >
            <Share2 size={14} /> {prescLoading ? '…' : 'Prescription'}
          </button>
          <button
            className={styles.dlBtn}
            onClick={() => _downloadPdf('instructions', `instr_${noteId?.slice(0,8)}.pdf`, setInstrLoading, 'Patient Sheet')}
            disabled={!noteId || instrLoading}
          >
            <Share2 size={14} /> {instrLoading ? '…' : 'Patient Sheet'}
          </button>
        </div>

        {/* Finalize */}
        <button
          className={`${styles.finalizeBtn} ${displayNote.is_finalized ? styles.finalizeBtnDone : ''}`}
          onClick={handleFinalize}
          disabled={displayNote.is_finalized}
        >
          <CheckCircle size={16} />
          {displayNote.is_finalized ? 'Note Finalized' : 'Finalize & Sign'}
        </button>
      </div>
    </div>
  )
}
