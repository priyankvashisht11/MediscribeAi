import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { patientsApi } from '../services/api'
import HealthAnalysisPanel from '../components/HealthAnalysisPanel'
import DocumentsPanel from '../components/DocumentsPanel'
import { Edit2, Save, X, ExternalLink, Plus } from 'lucide-react'
import MobilePatientProfile from './MobilePatientProfile'

const isMobile = Capacitor.isNativePlatform() || window.innerWidth <= 768

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDuration(seconds) {
  if (!seconds) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function IcdBadge({ code }) {
  return (
    <span style={{
      fontSize: 'var(--text-xs)', padding: '1px 6px',
      borderRadius: 'var(--radius-sm)',
      background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
      color: 'var(--color-text-muted)',
    }}>
      {code.code || code}
    </span>
  )
}

function VisitCard({ visit, index }) {
  const [expanded, setExpanded] = useState(index === 0)
  const note = visit.note

  return (
    <div style={{
      border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
      overflow: 'hidden', marginBottom: 'var(--space-3)',
    }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: 'var(--space-3) var(--space-4)', background: 'var(--color-surface)',
          border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <div>
          <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
            Visit {index + 1} · {formatDate(visit.created_at)}
          </span>
          {note?.chief_complaint && (
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)',
                           marginLeft: 'var(--space-3)' }}>
              {note.chief_complaint}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          {note?.is_finalized && (
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-success)',
                           fontWeight: 600 }}>✓ Finalized</span>
          )}
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            {expanded ? '▲' : '▼'}
          </span>
        </div>
      </button>

      {expanded && (
        <div style={{
          padding: 'var(--space-4)', background: 'var(--color-surface-2)',
          borderTop: '1px solid var(--color-border)',
        }}>
          <div style={{ display: 'flex', gap: 'var(--space-6)', flexWrap: 'wrap',
                        marginBottom: 'var(--space-3)', fontSize: 'var(--text-xs)',
                        color: 'var(--color-text-muted)' }}>
            <span>Duration: {formatDuration(visit.duration_seconds)}</span>
            <span>Status: {visit.status}</span>
          </div>

          {note ? (
            <>
              {note.assessment && (
                <div style={{ marginBottom: 'var(--space-3)' }}>
                  <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase',
                               letterSpacing: '0.05em', color: 'var(--color-text-muted)',
                               marginBottom: 'var(--space-1)' }}>
                    Assessment
                  </p>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text)',
                               lineHeight: 1.5 }}>
                    {note.assessment}
                  </p>
                </div>
              )}
              {note.icd_codes?.length > 0 && (
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap',
                               marginBottom: 'var(--space-3)' }}>
                  {note.icd_codes.map((c, i) => <IcdBadge key={i} code={c} />)}
                </div>
              )}
              <Link
                to={`/sessions/${visit.id}/review`}
                style={{ fontSize: 'var(--text-xs)', color: 'var(--color-primary)',
                         textDecoration: 'none', display: 'inline-flex',
                         alignItems: 'center', gap: 'var(--space-1)' }}
              >
                View full note <ExternalLink size={10} />
              </Link>
            </>
          ) : (
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)',
                        fontStyle: 'italic' }}>No note generated</p>
          )}
        </div>
      )}
    </div>
  )
}

export default function PatientProfile() {
  if (isMobile) return <MobilePatientProfile />
  return <DesktopPatientProfile />
}

function DesktopPatientProfile() {
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
  const [newDocumentUploaded, setNewDocumentUploaded] = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      patientsApi.get(patientId),
      patientsApi.sessions(patientId),
    ])
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
    return <div style={{ padding: 'var(--space-12)', textAlign: 'center',
                          color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
      Loading…
    </div>
  }

  if (error || !patient) {
    return (
      <div className="error-state">
        <p className="error-state-message">{error || 'Patient not found'}</p>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/patients')}>← Back</button>
      </div>
    )
  }

  const finalized = sessions.filter(s => s.note?.is_finalized).length

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 'var(--space-6)' }}>
      {/* Breadcrumb */}
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)',
                    marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center',
                    gap: 'var(--space-2)' }}>
        <button onClick={() => navigate('/patients')}
                style={{ background: 'none', border: 'none', cursor: 'pointer',
                         color: 'var(--color-primary)', fontSize: 'var(--text-xs)' }}>
          Patients
        </button>
        <span>›</span>
        <span>{patient.name}</span>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)',
                    marginBottom: 'var(--space-6)' }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'var(--color-primary-light)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--color-primary)',
          flexShrink: 0,
        }}>
          {patient.name.trim().charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, marginBottom: 4 }}>
            {patient.name}
          </h1>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)',
                        display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
            {patient.age != null && <span>{patient.age} years</span>}
            {patient.gender && <span style={{ textTransform: 'capitalize' }}>{patient.gender}</span>}
            {patient.blood_group && <span>Blood: {patient.blood_group}</span>}
            {patient.phone && <span>{patient.phone}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => navigate('/sessions/new')}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}
          >
            <Plus size={13} /> New Visit
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => { setEditing(!editing); setSaveError(null) }}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}
          >
            {editing ? <><X size={13} /> Cancel</> : <><Edit2 size={13} /> Edit</>}
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-6)',
                    flexWrap: 'wrap' }}>
        {[
          { label: 'Total Visits', value: patient.visit_count },
          { label: 'Finalized Notes', value: finalized },
          { label: 'First Visit', value: formatDate(sessions[sessions.length - 1]?.created_at) },
          { label: 'Last Visit', value: formatDate(sessions[0]?.created_at) },
        ].map(s => (
          <div key={s.label} style={{
            flex: '1 1 120px', background: 'var(--color-surface)',
            border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
            padding: 'var(--space-3) var(--space-4)',
          }}>
            <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--color-primary)' }}>
              {s.value}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 'var(--space-6)',
                    alignItems: 'start' }}>

        {/* LEFT — Profile card */}
        <div style={{
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        marginBottom: 'var(--space-4)' }}>
            <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 600 }}>Patient Details</h2>
          </div>

          {editing ? (
            <div>
              <Field label="Blood Group">
                <select
                  value={form.blood_group}
                  onChange={e => setForm(f => ({ ...f, blood_group: e.target.value }))}
                  style={{ width: '100%', padding: 'var(--space-2)', fontSize: 'var(--text-sm)',
                           border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
                           background: 'var(--color-surface)' }}
                >
                  <option value="">— Unknown —</option>
                  {BLOOD_GROUPS.map(bg => <option key={bg} value={bg}>{bg}</option>)}
                </select>
              </Field>
              <Field label="Phone">
                <input type="tel" value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  style={inputStyle}
                  placeholder="+91 XXXXX XXXXX"
                />
              </Field>
              <Field label="Known Allergies">
                <textarea value={form.known_allergies}
                  onChange={e => setForm(f => ({ ...f, known_allergies: e.target.value }))}
                  style={{ ...inputStyle, height: 60, resize: 'vertical' }}
                  placeholder="e.g. Penicillin, Sulfa drugs"
                />
              </Field>
              <Field label="Chronic Conditions">
                <textarea value={form.chronic_conditions}
                  onChange={e => setForm(f => ({ ...f, chronic_conditions: e.target.value }))}
                  style={{ ...inputStyle, height: 60, resize: 'vertical' }}
                  placeholder="e.g. Type 2 Diabetes, Hypertension"
                />
              </Field>
              <Field label="Address">
                <textarea value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  style={{ ...inputStyle, height: 60, resize: 'vertical' }}
                />
              </Field>
              <Field label="Emergency Contact">
                <input type="text" value={form.emergency_contact}
                  onChange={e => setForm(f => ({ ...f, emergency_contact: e.target.value }))}
                  style={inputStyle}
                  placeholder="Name · Phone"
                />
              </Field>
              <Field label="Clinical Notes">
                <textarea value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  style={{ ...inputStyle, height: 80, resize: 'vertical' }}
                  placeholder="Any additional notes for this patient…"
                />
              </Field>
              {saveError && (
                <p style={{ color: 'var(--color-error)', fontSize: 'var(--text-xs)',
                             marginBottom: 'var(--space-3)' }}>
                  {saveError}
                </p>
              )}
              <button
                className="btn btn-primary btn-sm"
                onClick={handleSave}
                disabled={saving}
                style={{ width: '100%', display: 'flex', alignItems: 'center',
                         justifyContent: 'center', gap: 'var(--space-2)' }}
              >
                <Save size={13} /> {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          ) : (
            <div>
              <InfoRow label="Blood Group" value={patient.blood_group || '—'} />
              <InfoRow label="Phone" value={patient.phone || '—'} />
              <InfoRow label="Known Allergies"
                value={patient.known_allergies || '—'}
                highlight={!!patient.known_allergies}
                highlightColor="var(--color-error)"
              />
              <InfoRow label="Chronic Conditions"
                value={patient.chronic_conditions || '—'}
                highlight={!!patient.chronic_conditions}
                highlightColor="var(--color-warning)"
              />
              <InfoRow label="Address" value={patient.address || '—'} />
              <InfoRow label="Emergency Contact" value={patient.emergency_contact || '—'} />
              {patient.notes && (
                <div style={{ marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)',
                               borderTop: '1px solid var(--color-border)' }}>
                  <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-muted)',
                               marginBottom: 'var(--space-1)' }}>NOTES</p>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text)', lineHeight: 1.5 }}>
                    {patient.notes}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT — Visit timeline + Health analysis + Documents */}
        <div>
          {/* Health analysis */}
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <HealthAnalysisPanel
              patientId={patientId}
              visitCount={patient.visit_count}
              newDocumentFlag={newDocumentUploaded}
            />
          </div>

          {/* Documents */}
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <DocumentsPanel
              patientId={patientId}
              onDocumentChange={() => setNewDocumentUploaded(true)}
            />
          </div>

          {/* Visit timeline */}
          <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 600,
                       marginBottom: 'var(--space-3)' }}>
            Visit History
          </h2>
          {sessions.length === 0 ? (
            <div style={{ padding: 'var(--space-6)', textAlign: 'center',
                          color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)',
                          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                          borderRadius: 'var(--radius-md)' }}>
              No visits yet
            </div>
          ) : (
            sessions.map((visit, i) => <VisitCard key={visit.id} visit={visit} index={i} />)
          )}
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value, highlight, highlightColor }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                  paddingBottom: 'var(--space-2)', marginBottom: 'var(--space-2)',
                  borderBottom: '1px solid var(--color-border)' }}>
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)',
                     fontWeight: 600, flexShrink: 0, marginRight: 'var(--space-3)' }}>
        {label}
      </span>
      <span style={{ fontSize: 'var(--text-sm)', textAlign: 'right',
                     color: highlight ? highlightColor : 'var(--color-text)',
                     fontWeight: highlight ? 600 : 400 }}>
        {value}
      </span>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 'var(--space-3)' }}>
      <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600,
                      color: 'var(--color-text-muted)', marginBottom: 'var(--space-1)' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inputStyle = {
  width: '100%',
  padding: 'var(--space-2)',
  fontSize: 'var(--text-sm)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--color-surface)',
  color: 'var(--color-text)',
  boxSizing: 'border-box',
}
