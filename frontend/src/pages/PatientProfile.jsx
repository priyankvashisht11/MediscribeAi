import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { patientsApi } from '../services/api'
import HealthAnalysisPanel from '../components/HealthAnalysisPanel'
import DocumentsPanel from '../components/DocumentsPanel'
import { Edit2, Save, X, ExternalLink, Plus, Brain, Paperclip, Clock, AlertTriangle, Activity } from 'lucide-react'
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
            background: note?.is_finalized ? 'var(--color-success)' : 'var(--color-border)',
          }} />
          <div>
            <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
              Visit {index + 1}
            </span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginLeft: 8 }}>
              {formatDate(visit.created_at)}
            </span>
            {note?.chief_complaint && (
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginLeft: 8 }}>
                · {note.chief_complaint}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          {note?.is_finalized && (
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-success)', fontWeight: 600 }}>
              Finalized
            </span>
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
          <div style={{
            display: 'flex', gap: 'var(--space-6)', flexWrap: 'wrap',
            marginBottom: 'var(--space-3)', fontSize: 'var(--text-xs)',
            color: 'var(--color-text-muted)',
          }}>
            <span>Duration: {formatDuration(visit.duration_seconds)}</span>
            <span style={{ textTransform: 'capitalize' }}>Status: {visit.status}</span>
          </div>

          {note ? (
            <>
              {note.assessment && (
                <div style={{ marginBottom: 'var(--space-3)' }}>
                  <p style={{
                    fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase',
                    letterSpacing: '0.05em', color: 'var(--color-text-muted)', marginBottom: 'var(--space-1)',
                  }}>
                    Assessment
                  </p>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text)', lineHeight: 1.6 }}>
                    {note.assessment}
                  </p>
                </div>
              )}
              {note.icd_codes?.length > 0 && (
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-3)' }}>
                  {note.icd_codes.map((c, i) => <IcdBadge key={i} code={c} />)}
                </div>
              )}
              <Link
                to={`/sessions/${visit.id}/review`}
                style={{
                  fontSize: 'var(--text-xs)', color: 'var(--color-primary)',
                  textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)',
                }}
              >
                View full note <ExternalLink size={10} />
              </Link>
            </>
          ) : (
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
              No note generated
            </p>
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
  const [activeTab, setActiveTab] = useState('health')

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
    return (
      <div style={{ padding: 'var(--space-12)', textAlign: 'center',
                    color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
        Loading…
      </div>
    )
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
  const initials = patient.name.trim().split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  const tabs = [
    { id: 'health',    label: 'Health Intelligence', icon: <Brain size={13} /> },
    { id: 'documents', label: 'Documents',           icon: <Paperclip size={13} /> },
    { id: 'history',   label: `Visits (${sessions.length})`, icon: <Clock size={13} /> },
  ]

  return (
    <div style={{ maxWidth: 1140, margin: '0 auto', padding: 'var(--space-6) var(--space-6) var(--space-12)' }}>

      {/* Breadcrumb */}
      <div style={{
        fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)',
        marginBottom: 'var(--space-5)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
      }}>
        <button onClick={() => navigate('/patients')}
                style={{ background: 'none', border: 'none', cursor: 'pointer',
                         color: 'var(--color-primary)', fontSize: 'var(--text-xs)', padding: 0 }}>
          Patients
        </button>
        <span style={{ opacity: 0.4 }}>›</span>
        <span>{patient.name}</span>
      </div>

      {/* ── HERO HEADER ── */}
      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-5) var(--space-6)',
        marginBottom: 'var(--space-6)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)' }}>
          {/* Avatar */}
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'var(--color-primary-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--color-primary)',
            flexShrink: 0, letterSpacing: '-0.5px',
          }}>
            {initials}
          </div>

          {/* Name + meta */}
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, marginBottom: 6, lineHeight: 1.2 }}>
              {patient.name}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
              {patient.age != null && (
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                  {patient.age} yrs
                </span>
              )}
              {patient.gender && (
                <>
                  <Dot />
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)',
                                  textTransform: 'capitalize' }}>
                    {patient.gender}
                  </span>
                </>
              )}
              {patient.blood_group && (
                <>
                  <Dot />
                  <span style={{
                    fontSize: 'var(--text-xs)', fontWeight: 700,
                    background: '#fef2f2', color: '#dc2626',
                    padding: '2px 8px', borderRadius: 'var(--radius-full)',
                    border: '1px solid #fecaca',
                  }}>
                    {patient.blood_group}
                  </span>
                </>
              )}
              {patient.phone && (
                <>
                  <Dot />
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                    {patient.phone}
                  </span>
                </>
              )}
            </div>

            {/* Clinical alert chips */}
            {(patient.known_allergies || patient.chronic_conditions) && (
              <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginTop: 10 }}>
                {patient.known_allergies && (
                  <span style={{
                    fontSize: 'var(--text-xs)', fontWeight: 600,
                    background: '#fef2f2', color: '#b91c1c',
                    padding: '3px 10px', borderRadius: 'var(--radius-full)',
                    border: '1px solid #fecaca',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    <AlertTriangle size={10} />
                    Allergy: {patient.known_allergies}
                  </span>
                )}
                {patient.chronic_conditions && (
                  <span style={{
                    fontSize: 'var(--text-xs)', fontWeight: 600,
                    background: '#fffbeb', color: '#b45309',
                    padding: '3px 10px', borderRadius: 'var(--radius-full)',
                    border: '1px solid #fde68a',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    <Activity size={10} />
                    {patient.chronic_conditions}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexShrink: 0 }}>
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

        {/* Stats strip */}
        <div style={{
          display: 'flex', gap: 0,
          marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)',
          borderTop: '1px solid var(--color-border)',
        }}>
          {[
            { label: 'Total Visits', value: patient.visit_count ?? sessions.length },
            { label: 'Finalized', value: finalized },
            { label: 'First Visit', value: formatDate(sessions[sessions.length - 1]?.created_at) },
            { label: 'Last Visit',  value: formatDate(sessions[0]?.created_at) },
          ].map((s, i) => (
            <div key={s.label} style={{
              flex: 1, paddingRight: 'var(--space-5)',
              borderRight: i < 3 ? '1px solid var(--color-border)' : 'none',
              paddingLeft: i > 0 ? 'var(--space-5)' : 0,
            }}>
              <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--color-text)' }}>
                {s.value}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── BODY: left sidebar + right tabbed panel ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 'var(--space-6)', alignItems: 'start' }}>

        {/* LEFT SIDEBAR */}
        <div style={{
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)', overflow: 'hidden',
          position: 'sticky', top: 24,
        }}>
          <div style={{
            padding: 'var(--space-4) var(--space-5)',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>Patient Details</span>
          </div>

          <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
            {editing ? (
              <div>
                <Field label="Blood Group">
                  <select
                    value={form.blood_group}
                    onChange={e => setForm(f => ({ ...f, blood_group: e.target.value }))}
                    style={inputStyle}
                  >
                    <option value="">— Unknown —</option>
                    {BLOOD_GROUPS.map(bg => <option key={bg} value={bg}>{bg}</option>)}
                  </select>
                </Field>
                <Field label="Phone">
                  <input type="tel" value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    style={inputStyle} placeholder="+91 XXXXX XXXXX"
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
                    style={inputStyle} placeholder="Name · Phone"
                  />
                </Field>
                <Field label="Clinical Notes">
                  <textarea value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    style={{ ...inputStyle, height: 72, resize: 'vertical' }}
                    placeholder="Any additional notes…"
                  />
                </Field>
                {saveError && (
                  <p style={{ color: 'var(--color-error)', fontSize: 'var(--text-xs)', marginBottom: 'var(--space-3)' }}>
                    {saveError}
                  </p>
                )}
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleSave}
                  disabled={saving}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)' }}
                >
                  <Save size={13} /> {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            ) : (
              <div>
                {/* Only show filled rows */}
                {[
                  { label: 'Phone',             value: patient.phone },
                  { label: 'Address',           value: patient.address },
                  { label: 'Emergency Contact', value: patient.emergency_contact },
                ].filter(r => r.value).map(r => (
                  <SidebarRow key={r.label} label={r.label} value={r.value} />
                ))}

                {!patient.phone && !patient.address && !patient.emergency_contact
                  && !patient.known_allergies && !patient.chronic_conditions && !patient.notes && (
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)',
                               fontStyle: 'italic', textAlign: 'center', padding: 'var(--space-4) 0' }}>
                    No details added yet.
                    <br />
                    <button
                      onClick={() => setEditing(true)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer',
                               color: 'var(--color-primary)', fontSize: 'var(--text-xs)',
                               marginTop: 4, padding: 0 }}
                    >
                      + Add patient details
                    </button>
                  </p>
                )}

                {patient.notes && (
                  <div style={{
                    marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)',
                    borderTop: '1px solid var(--color-border)',
                  }}>
                    <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-muted)',
                                 textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 'var(--space-2)' }}>
                      Clinical Notes
                    </p>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text)', lineHeight: 1.6 }}>
                      {patient.notes}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — TABBED PANEL */}
        <div>
          {/* Tab strip */}
          <div style={{
            display: 'flex', gap: 2,
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 4,
            marginBottom: 'var(--space-4)',
          }}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 6,
                  padding: 'var(--space-2) var(--space-3)',
                  border: 'none', cursor: 'pointer',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--text-sm)', fontWeight: activeTab === tab.id ? 600 : 400,
                  background: activeTab === tab.id ? 'var(--color-surface)' : 'transparent',
                  color: activeTab === tab.id ? 'var(--color-text)' : 'var(--color-text-muted)',
                  boxShadow: activeTab === tab.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{ opacity: activeTab === tab.id ? 1 : 0.6 }}>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === 'health' && (
            <HealthAnalysisPanel
              patientId={patientId}
              visitCount={patient.visit_count ?? sessions.length}
              newDocumentFlag={newDocumentUploaded}
            />
          )}

          {activeTab === 'documents' && (
            <DocumentsPanel
              patientId={patientId}
              onDocumentChange={() => {
                setNewDocumentUploaded(true)
              }}
            />
          )}

          {activeTab === 'history' && (
            <div>
              {sessions.length === 0 ? (
                <div style={{
                  padding: 'var(--space-10)', textAlign: 'center',
                  color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)',
                  background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                }}>
                  <Clock size={24} style={{ opacity: 0.3, marginBottom: 10 }} />
                  <p style={{ margin: 0 }}>No visits recorded yet.</p>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => navigate('/sessions/new')}
                    style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <Plus size={13} /> Start First Visit
                  </button>
                </div>
              ) : (
                sessions.map((visit, i) => <VisitCard key={visit.id} visit={visit} index={i} />)
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Dot() {
  return <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--color-border)', display: 'inline-block', flexShrink: 0 }} />
}

function SidebarRow({ label, value }) {
  return (
    <div style={{
      paddingBottom: 'var(--space-3)', marginBottom: 'var(--space-3)',
      borderBottom: '1px solid var(--color-border)',
    }}>
      <p style={{
        fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3,
      }}>
        {label}
      </p>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text)', lineHeight: 1.5, margin: 0 }}>
        {value}
      </p>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 'var(--space-3)' }}>
      <label style={{
        display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600,
        color: 'var(--color-text-muted)', marginBottom: 'var(--space-1)',
        textTransform: 'uppercase', letterSpacing: '0.04em',
      }}>
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
