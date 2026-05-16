import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { patientsApi } from '../services/api'
import { ArrowLeft, Edit2, Save, X, ChevronDown, Plus, ExternalLink } from 'lucide-react'
import styles from './MobilePatientProfile.module.css'

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

function fmt(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtDur(seconds) {
  if (!seconds) return '—'
  const m = Math.floor(seconds / 60)
  return m > 0 ? `${m}m` : `${seconds}s`
}

// ── Visit card ─────────────────────────────────────────────────────────────────
function VisitCard({ visit, index }) {
  const [open, setOpen] = useState(index === 0)
  const note = visit.note

  return (
    <div className={styles.visitCard}>
      <button className={styles.visitHeader} onClick={() => setOpen(o => !o)}>
        <div className={styles.visitHeaderLeft}>
          <span className={styles.visitNum}>Visit {index + 1}</span>
          <span className={styles.visitDate}>{fmt(visit.created_at)}</span>
          {note?.chief_complaint && (
            <span className={styles.visitCC}>{note.chief_complaint}</span>
          )}
        </div>
        <div className={styles.visitHeaderRight}>
          {note?.is_finalized && <span className={styles.finalizedDot}>✓</span>}
          <ChevronDown size={14} className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`} />
        </div>
      </button>

      {open && (
        <div className={styles.visitBody}>
          <div className={styles.visitMeta}>
            <span>Duration: {fmtDur(visit.duration_seconds)}</span>
            <span>Status: {visit.status}</span>
          </div>

          {note ? (
            <>
              {note.assessment && (
                <div className={styles.visitSection}>
                  <span className={styles.visitSectionLabel}>Assessment</span>
                  <p className={styles.visitSectionText}>{note.assessment}</p>
                </div>
              )}
              {(note.icd_codes || []).length > 0 && (
                <div className={styles.icdRow}>
                  {note.icd_codes.map((c, i) => (
                    <span key={i} className={styles.icdChip}>{c.code || c}</span>
                  ))}
                </div>
              )}
              <Link to={`/sessions/${visit.id}/review`} className={styles.viewNoteLink}>
                View full note <ExternalLink size={10} />
              </Link>
            </>
          ) : (
            <p className={styles.noNote}>No note generated for this visit</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Detail field (view mode) ───────────────────────────────────────────────────
function DetailRow({ label, value, warn }) {
  return (
    <div className={styles.detailRow}>
      <span className={styles.detailLabel}>{label}</span>
      <span className={`${styles.detailValue} ${warn && value && value !== '—' ? styles.detailWarn : ''}`}>
        {value || '—'}
      </span>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function MobilePatientProfile() {
  const { patientId } = useParams()
  const navigate = useNavigate()

  const [patient, setPatient] = useState(null)
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [detailsOpen, setDetailsOpen] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([patientsApi.get(patientId), patientsApi.sessions(patientId)])
      .then(([p, s]) => {
        setPatient(p)
        setForm({
          blood_group: p.blood_group || '',
          known_allergies: p.known_allergies || '',
          chronic_conditions: p.chronic_conditions || '',
          address: p.address || '',
          emergency_contact: p.emergency_contact || '',
          notes: p.notes || '',
          phone: p.phone || '',
        })
        setSessions(s.items || [])
      })
      .catch(err => setError(err.message || 'Failed to load patient'))
      .finally(() => setLoading(false))
  }, [patientId])

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      const updated = await patientsApi.update(patientId, form)
      setPatient(updated)
      setEditing(false)
    } catch (err) {
      setSaveError(err.response?.data?.detail || err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className={styles.centeredState}>
        <span className={styles.spinner} />
      </div>
    )
  }

  if (error || !patient) {
    return (
      <div className={styles.centeredState}>
        <p style={{ color: 'var(--color-error)' }}>{error || 'Patient not found'}</p>
        <button className={styles.backLink} onClick={() => navigate('/patients')}>
          ← Back to patients
        </button>
      </div>
    )
  }

  const finalized = sessions.filter(s => s.note?.is_finalized).length

  return (
    <div className={styles.screen}>
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/patients')}>
          <ArrowLeft size={18} />
        </button>
        <div className={styles.headerInfo}>
          <span className={styles.headerName}>{patient.name}</span>
          <span className={styles.headerMeta}>
            {[patient.age != null && `${patient.age}y`, patient.gender, patient.blood_group]
              .filter(Boolean).join(' · ')}
          </span>
        </div>
        <button
          className={styles.editToggle}
          onClick={() => { setEditing(e => !e); setSaveError(null) }}
        >
          {editing ? <X size={16} /> : <Edit2 size={16} />}
        </button>
      </div>

      {/* Scrollable content */}
      <div className={styles.content}>
        {/* Stats row */}
        <div className={styles.statsRow}>
          {[
            { label: 'Visits', value: patient.visit_count },
            { label: 'Notes Done', value: finalized },
            { label: 'First Visit', value: fmt(sessions[sessions.length - 1]?.created_at) },
            { label: 'Last Visit', value: fmt(sessions[0]?.created_at) },
          ].map(s => (
            <div key={s.label} className={styles.statCard}>
              <span className={styles.statVal}>{s.value}</span>
              <span className={styles.statLabel}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Patient details accordion */}
        <div className={styles.card}>
          <button
            className={styles.cardHeader}
            onClick={() => !editing && setDetailsOpen(o => !o)}
          >
            <span className={styles.cardTitle}>Patient Details</span>
            {!editing && (
              <ChevronDown
                size={14}
                className={`${styles.chevron} ${detailsOpen ? styles.chevronOpen : ''}`}
              />
            )}
          </button>

          {(detailsOpen || editing) && (
            <div className={styles.cardBody}>
              {editing ? (
                <>
                  <EditField label="Blood Group">
                    <select
                      value={form.blood_group}
                      onChange={e => setForm(f => ({ ...f, blood_group: e.target.value }))}
                      className={styles.input}
                    >
                      <option value="">— Unknown —</option>
                      {BLOOD_GROUPS.map(bg => <option key={bg} value={bg}>{bg}</option>)}
                    </select>
                  </EditField>
                  <EditField label="Phone">
                    <input type="tel" value={form.phone}
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      className={styles.input} placeholder="+91 XXXXX XXXXX" />
                  </EditField>
                  <EditField label="Known Allergies">
                    <textarea value={form.known_allergies}
                      onChange={e => setForm(f => ({ ...f, known_allergies: e.target.value }))}
                      className={styles.textarea} rows={2}
                      placeholder="e.g. Penicillin, Sulfa drugs" />
                  </EditField>
                  <EditField label="Chronic Conditions">
                    <textarea value={form.chronic_conditions}
                      onChange={e => setForm(f => ({ ...f, chronic_conditions: e.target.value }))}
                      className={styles.textarea} rows={2}
                      placeholder="e.g. Type 2 Diabetes, Hypertension" />
                  </EditField>
                  <EditField label="Address">
                    <textarea value={form.address}
                      onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                      className={styles.textarea} rows={2} />
                  </EditField>
                  <EditField label="Emergency Contact">
                    <input type="text" value={form.emergency_contact}
                      onChange={e => setForm(f => ({ ...f, emergency_contact: e.target.value }))}
                      className={styles.input} placeholder="Name · Phone" />
                  </EditField>
                  <EditField label="Clinical Notes">
                    <textarea value={form.notes}
                      onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                      className={styles.textarea} rows={3}
                      placeholder="Additional notes for this patient…" />
                  </EditField>
                  {saveError && <p className={styles.saveError}>{saveError}</p>}
                  <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
                    <Save size={14} /> {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                </>
              ) : (
                <>
                  <DetailRow label="Blood Group" value={patient.blood_group} />
                  <DetailRow label="Phone" value={patient.phone} />
                  <DetailRow label="Allergies" value={patient.known_allergies} warn />
                  <DetailRow label="Chronic Conditions" value={patient.chronic_conditions} warn />
                  <DetailRow label="Address" value={patient.address} />
                  <DetailRow label="Emergency Contact" value={patient.emergency_contact} />
                  {patient.notes && (
                    <div className={styles.notesBlock}>
                      <span className={styles.detailLabel}>Clinical Notes</span>
                      <p className={styles.notesText}>{patient.notes}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Visit history */}
        <div className={styles.sectionTitle}>
          Visit History
          <span className={styles.sectionCount}>{sessions.length}</span>
        </div>

        {sessions.length === 0 ? (
          <div className={styles.emptyVisits}>No visits recorded yet</div>
        ) : (
          sessions.map((v, i) => <VisitCard key={v.id} visit={v} index={i} />)
        )}

        <div style={{ height: 88 }} />
      </div>

      {/* Fixed bottom CTA */}
      <div className={styles.actionBar}>
        <button
          className={styles.newVisitBtn}
          onClick={() => navigate('/sessions/new')}
        >
          <Plus size={16} /> New Visit
        </button>
      </div>
    </div>
  )
}

function EditField({ label, children }) {
  return (
    <div className={styles.editField}>
      <label className={styles.editLabel}>{label}</label>
      {children}
    </div>
  )
}
