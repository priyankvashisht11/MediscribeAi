import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { sessionsApi } from '../services/api'
import { useSessionStore } from '../stores/sessionStore'
import { useUiStore } from '../stores/uiStore'
import { useDoctorStore } from '../stores/doctorStore'
import { Mic, Lock, ChevronRight, ArrowLeft } from 'lucide-react'
import PatientSearchInput from '../components/PatientSearchInput'
import styles from './MobileNewSession.module.css'

export default function MobileNewSession() {
  const navigate = useNavigate()
  const setCurrentSession = useSessionStore(s => s.setCurrentSession)
  const addToast = useUiStore(s => s.addToast)
  const doctor = useDoctorStore(s => s.doctor)

  const [step, setStep] = useState(0)
  const [patientName, setPatientName] = useState('')
  const [patientAge, setPatientAge] = useState('')
  const [patientGender, setPatientGender] = useState('')
  const [patientPhone, setPatientPhone] = useState('')
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [consented, setConsented] = useState(false)
  const [consentTimestamp, setConsentTimestamp] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleConsentChange = (e) => {
    setConsented(e.target.checked)
    if (e.target.checked) setConsentTimestamp(new Date().toISOString())
    else setConsentTimestamp(null)
  }

  const handleStart = async () => {
    setLoading(true)
    try {
      const session = await sessionsApi.create({
        doctor_id: doctor?.id,
        patient_name: patientName || null,
        patient_age: patientAge ? parseInt(patientAge) : null,
      })
      setCurrentSession(session)
      navigate(`/sessions/${session.id}/live`)
    } catch {
      addToast({ type: 'error', message: 'Failed to create session. Try again.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.screen}>
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>
          <ArrowLeft size={18} />
        </button>
        <span className={styles.headerTitle}>New Session</span>
        {/* Step indicator */}
        <div className={styles.stepPills}>
          <span className={`${styles.stepPill} ${step === 0 ? styles.stepPillActive : styles.stepPillDone}`}>1</span>
          <div className={styles.stepLine} />
          <span className={`${styles.stepPill} ${step === 1 ? styles.stepPillActive : ''}`}>2</span>
        </div>
      </div>

      {/* Scrollable content */}
      <div className={styles.content}>
        {step === 0 ? (
          <>
            <p className={styles.stepTitle}>Patient Details & Consent</p>

            {doctor && (
              <div className={styles.doctorBadge}>
                Recording as <strong>{doctor.name}</strong> · {doctor.specialty}
              </div>
            )}

            {/* Patient name (with typeahead) */}
            <div className={styles.field}>
              <label className={styles.label}>Patient Name <span className={styles.req}>*</span></label>
              <PatientSearchInput
                value={patientName}
                onChange={(name, existing) => {
                  setPatientName(name)
                  if (existing) {
                    setSelectedPatient(existing)
                    if (existing.age != null) setPatientAge(String(existing.age))
                    if (existing.gender) setPatientGender(existing.gender)
                    if (existing.phone) setPatientPhone(existing.phone)
                  } else {
                    setSelectedPatient(null)
                  }
                }}
                onSelect={p => {
                  setSelectedPatient(p)
                  setPatientAge(p.age != null ? String(p.age) : '')
                  setPatientGender(p.gender || '')
                  setPatientPhone(p.phone || '')
                }}
                placeholder="Full name (type 3+ chars to search)"
              />
              {selectedPatient && (
                <p className={styles.returningHint}>
                  ✓ Returning patient · {selectedPatient.visit_count} previous visit{selectedPatient.visit_count !== 1 ? 's' : ''}
                </p>
              )}
            </div>

            {/* Age + Gender row */}
            <div className={styles.rowFields}>
              <div className={styles.field} style={{ flex: '0 0 90px' }}>
                <label className={styles.label}>Age</label>
                <input
                  type="number" min="0" max="120"
                  className={styles.input}
                  placeholder="Yrs"
                  value={patientAge}
                  onChange={e => setPatientAge(e.target.value)}
                />
              </div>
              <div className={styles.field} style={{ flex: 1 }}>
                <label className={styles.label}>Gender</label>
                <div className={styles.genderRow}>
                  {['Male', 'Female', 'Other'].map(g => (
                    <button
                      key={g}
                      type="button"
                      className={`${styles.genderBtn} ${patientGender === g.toLowerCase() ? styles.genderBtnActive : ''}`}
                      onClick={() => setPatientGender(g.toLowerCase())}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Phone */}
            <div className={styles.field}>
              <label className={styles.label}>Phone <span className={styles.opt}>(optional)</span></label>
              <input
                type="tel"
                className={styles.input}
                placeholder="+91 XXXXX XXXXX"
                value={patientPhone}
                onChange={e => setPatientPhone(e.target.value)}
              />
            </div>

            {/* Consent block */}
            <div className={styles.consentCard}>
              <div className={styles.consentHeader}>
                <Lock size={14} />
                <span>Patient Recording Consent</span>
              </div>
              <p className={styles.consentText}>
                This consultation will be audio-recorded and transcribed by AI to assist
                the doctor with clinical documentation. The recording is processed
                automatically and only used for generating clinical notes.
              </p>
              <label className={styles.consentCheck}>
                <input
                  type="checkbox"
                  checked={consented}
                  onChange={handleConsentChange}
                />
                <span>I, the patient, consent to audio recording of this consultation.</span>
              </label>
            </div>

            {/* Spacer for bottom bar */}
            <div style={{ height: 80 }} />
          </>
        ) : (
          <>
            <p className={styles.stepTitle}>Ready to Start</p>

            <div className={styles.summaryCard}>
              <div className={styles.summaryRow}>
                <span className={styles.summaryKey}>Doctor</span>
                <span className={styles.summaryVal}>{doctor?.name}</span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryKey}>Patient</span>
                <span className={styles.summaryVal}>{patientName}</span>
              </div>
              {patientAge && (
                <div className={styles.summaryRow}>
                  <span className={styles.summaryKey}>Age</span>
                  <span className={styles.summaryVal}>{patientAge} yrs {patientGender && `· ${patientGender}`}</span>
                </div>
              )}
              <div className={styles.summaryRow}>
                <span className={styles.summaryKey}>Consent</span>
                <span className={styles.summaryVal} style={{ color: 'var(--color-success)' }}>
                  ✓ {consentTimestamp ? new Date(consentTimestamp).toLocaleTimeString() : 'Given'}
                </span>
              </div>
            </div>

            <div className={styles.warningCard}>
              Ensure the device microphone is accessible and the patient is in the room.
            </div>

            <div style={{ height: 100 }} />
          </>
        )}
      </div>

      {/* Fixed bottom action */}
      <div className={styles.actionBar}>
        {step === 0 ? (
          <button
            className={styles.continueBtn}
            disabled={!patientName.trim() || !consented}
            onClick={() => setStep(1)}
          >
            I Consent — Continue <ChevronRight size={16} />
          </button>
        ) : (
          <div className={styles.startRow}>
            <button className={styles.backActionBtn} onClick={() => setStep(0)}>
              <ArrowLeft size={16} /> Back
            </button>
            <button
              className={styles.startBtn}
              onClick={handleStart}
              disabled={loading || !doctor?.id}
            >
              <Mic size={16} />
              {loading ? 'Starting…' : 'Start Recording'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
