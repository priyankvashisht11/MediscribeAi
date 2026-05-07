import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { notesApi, sessionsApi } from '../services/api'
import { useUiStore } from '../stores/uiStore'
import { ArrowLeft, Printer, FileDown, CheckCircle } from 'lucide-react'
import styles from './NoteReview.module.css'

export default function NoteReview() {
  const { id } = useParams()
  const navigate = useNavigate()
  const addToast = useUiStore((s) => s.addToast)

  const { data: session } = useQuery({ queryKey: ['session', id], queryFn: () => sessionsApi.get(id) })
  const { data: note } = useQuery({ queryKey: ['note', id], queryFn: () => notesApi.get(id) })

  const [fields, setFields] = useState({})
  const [editingSection, setEditingSection] = useState(null)
  const [finalizing, setFinalizing] = useState(false)

  const sections = [
    { key: 'chief_complaint', label: 'Chief Complaint' },
    { key: 'history_of_present_illness', label: 'History of Present Illness' },
    { key: 'review_of_systems', label: 'Review of Systems' },
    { key: 'past_medical_history', label: 'Past Medical History' },
    { key: 'medications', label: 'Current Medications & Allergies' },
    { key: 'physical_examination', label: 'Physical Examination' },
    { key: 'assessment', label: 'Assessment (Diagnosis)' },
    { key: 'plan', label: 'Plan' },
    { key: 'follow_up', label: 'Follow-up Instructions' },
  ]

  const handleEdit = (key) => {
    setEditingSection(key)
    setFields((f) => ({ ...f, [key]: note?.[key] ?? '' }))
  }

  const handleSave = (key) => {
    setEditingSection(null)
    addToast({ type: 'success', message: 'Section saved' })
  }

  const handleFinalize = async () => {
    setFinalizing(true)
    try {
      await notesApi.finalize(note.id)
      addToast({ type: 'success', message: 'Note finalized and saved ✓' })
      setTimeout(() => navigate('/'), 1500)
    } catch {
      addToast({ type: 'error', message: 'Failed to finalize note' })
      setFinalizing(false)
    }
  }

  if (!note) return <div className={styles.loading}>Loading note…</div>

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>
            Session with {session?.patient_name ?? 'Patient'} — {new Date().toLocaleDateString()}
          </h1>
          <p className={styles.subtitle}>
            Duration: 14:02 · Dr. {session?.doctor_id ?? 'Unknown'}
          </p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.iconBtn} onClick={() => window.print()}>
            <Printer size={14} /> Print
          </button>
          <button className={styles.iconBtn}>
            <FileDown size={14} /> Export PDF
          </button>
        </div>
      </div>

      <div className={styles.layout}>
        {/* Main note */}
        <div className={styles.notePanel}>
          {sections.map(({ key, label }) => (
            <div key={key} className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionLabel}>{label}</span>
                {editingSection === key ? (
                  <button className={styles.saveBtn} onClick={() => handleSave(key)}>
                    Save Section
                  </button>
                ) : (
                  <button className={styles.editBtn} onClick={() => handleEdit(key)}>
                    Edit
                  </button>
                )}
              </div>
              {editingSection === key ? (
                <textarea
                  className={styles.textarea}
                  value={fields[key] ?? ''}
                  onChange={(e) => setFields((f) => ({ ...f, [key]: e.target.value }))}
                  rows={4}
                  autoFocus
                />
              ) : (
                <p className={styles.sectionContent}>{note[key] ?? '—'}</p>
              )}
            </div>
          ))}

          {/* ICD codes */}
          {note.icd_codes && note.icd_codes.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionLabel}>ICD-10 Codes</span>
              </div>
              <div className={styles.icdChips}>
                {note.icd_codes.map((icd, i) => (
                  <span key={i} className={styles.icdChip}>
                    {icd.code} — {icd.description}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarCard}>
            <h3 className={styles.sidebarTitle}>Session Metadata</h3>
            <dl className={styles.metaList}>
              <div className={styles.metaRow}>
                <dt>Patient</dt>
                <dd>{session?.patient_name ?? '—'}</dd>
              </div>
              <div className={styles.metaRow}>
                <dt>Doctor</dt>
                <dd>Dr. {session?.doctor_id ?? '—'}</dd>
              </div>
              <div className={styles.metaRow}>
                <dt>Date</dt>
                <dd>{new Date().toLocaleDateString()}</dd>
              </div>
              <div className={styles.metaRow}>
                <dt>Duration</dt>
                <dd>14:02</dd>
              </div>
              <div className={styles.metaRow}>
                <dt>Consent</dt>
                <dd>✓ Given at {new Date().toLocaleTimeString()}</dd>
              </div>
              <div className={styles.metaRow}>
                <dt>Confidence</dt>
                <dd>{Math.round((note.confidence_score ?? 0) * 100)}%</dd>
              </div>
            </dl>
          </div>

          {note.is_finalized && (
            <div className={styles.finalizedBadge}>
              <CheckCircle size={14} /> Finalized
            </div>
          )}
        </aside>
      </div>

      {/* Bottom action bar */}
      <div className={styles.actionBar}>
        <button className={styles.backBtn} onClick={() => navigate('/sessions/history')}>
          <ArrowLeft size={14} /> Back to Sessions
        </button>
        <div className={styles.actionBarRight}>
          <button className={styles.saveDraftBtn}>Save Draft</button>
          <button
            className={styles.finalizeBtn}
            onClick={handleFinalize}
            disabled={finalizing || note.is_finalized}
          >
            <CheckCircle size={14} />
            {finalizing ? 'Finalizing…' : note.is_finalized ? 'Finalized' : 'Finalize & Sign Note'}
          </button>
        </div>
      </div>
    </div>
  )
}
