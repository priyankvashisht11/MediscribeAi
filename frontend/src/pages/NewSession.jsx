import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { sessionsApi } from '../services/api'
import { useDoctors } from '../context/DoctorsContext'
import { useSessionStore } from '../stores/sessionStore'
import { useUiStore } from '../stores/uiStore'
import { Lock, Mic } from 'lucide-react'
import PatientSearchInput from '../components/PatientSearchInput'
import styles from './NewSession.module.css'

const STEPS = ['Doctor', 'Patient & Consent', 'Start']

export default function NewSession() {
  const navigate = useNavigate()
  const setCurrentSession = useSessionStore((s) => s.setCurrentSession)
  const addToast = useUiStore((s) => s.addToast)

  const { doctors } = useDoctors()

  const [step, setStep] = useState(0)
  const [doctorId, setDoctorId] = useState('')
  const [patientName, setPatientName] = useState('')
  const [patientAge, setPatientAge] = useState('')
  const [patientGender, setPatientGender] = useState('')
  const [patientPhone, setPatientPhone] = useState('')
  const [selectedPatient, setSelectedPatient] = useState(null) // existing patient picked from search
  const [consented, setConsented] = useState(false)
  const [consentTimestamp, setConsentTimestamp] = useState(null)
  const [loading, setLoading] = useState(false)

  const selectedDoctor = doctors.find((d) => d.id === doctorId)

  const handleConsentChange = (e) => {
    setConsented(e.target.checked)
    if (e.target.checked) setConsentTimestamp(new Date().toISOString())
    else setConsentTimestamp(null)
  }

  const handleStart = async () => {
    setLoading(true)
    try {
      const session = await sessionsApi.create({
        doctor_id: doctorId,
        patient_name: patientName || null,
        patient_age: patientAge ? parseInt(patientAge) : null,
      })
      setCurrentSession(session)
      navigate(`/sessions/${session.id}/live`)
    } catch {
      addToast({ type: 'error', message: 'Failed to create session. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>New Session</h1>

      {/* Step indicator */}
      <div className={styles.stepper} aria-label="Progress">
        {STEPS.map((label, i) => (
          <div key={label} className={styles.stepItem}>
            <div className={`${styles.stepDot} ${i === step ? styles.stepActive : i < step ? styles.stepDone : ''}`}>
              {i < step ? '✓' : i + 1}
            </div>
            <span className={`${styles.stepLabel} ${i === step ? styles.stepLabelActive : ''}`}>{label}</span>
            {i < STEPS.length - 1 && <div className={`${styles.stepLine} ${i < step ? styles.stepLineDone : ''}`} />}
          </div>
        ))}
      </div>

      <div className={styles.card}>
        {/* Step 0 — Select Doctor */}
        {step === 0 && (
          <div className={styles.stepContent}>
            <h2 className={styles.stepTitle}>Select Doctor</h2>
            <p className={styles.stepDesc}>Choose the doctor conducting this consultation.</p>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="doctor-select">Doctor</label>
              <select
                id="doctor-select"
                className={styles.select}
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
              >
                <option value="">— Select a doctor —</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>{d.name} · {d.specialty}</option>
                ))}
              </select>
            </div>
            <div className={styles.actions}>
              <button
                className={styles.btnPrimary}
                disabled={!doctorId}
                onClick={() => setStep(1)}
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step 1 — Patient + Consent */}
        {step === 1 && (
          <div className={styles.stepContent}>
            <h2 className={styles.stepTitle}>Patient Details & Consent</h2>

            <div className={styles.fieldGrid}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="patient-name">
                  Patient Name <span className={styles.required}>*</span>
                </label>
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
                  onSelect={(patient) => {
                    setSelectedPatient(patient)
                    setPatientAge(patient.age != null ? String(patient.age) : '')
                    setPatientGender(patient.gender || '')
                    setPatientPhone(patient.phone || '')
                  }}
                  placeholder="Full name (type 3+ chars to search)"
                />
                {selectedPatient && (
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-primary)',
                               marginTop: 4 }}>
                    ✓ Returning patient — record found ({selectedPatient.visit_count} previous visit{selectedPatient.visit_count !== 1 ? 's' : ''})
                  </p>
                )}
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="patient-age">Age</label>
                <input
                  id="patient-age"
                  className={styles.input}
                  type="number"
                  placeholder="Years"
                  min="0"
                  max="120"
                  value={patientAge}
                  onChange={(e) => setPatientAge(e.target.value)}
                />
              </div>
            </div>

            <div className={styles.field}>
              <span className={styles.label}>Gender</span>
              <div className={styles.radioGroup}>
                {['Male', 'Female', 'Other'].map((g) => (
                  <label key={g} className={styles.radioLabel}>
                    <input
                      type="radio"
                      name="gender"
                      value={g.toLowerCase()}
                      checked={patientGender === g.toLowerCase()}
                      onChange={(e) => setPatientGender(e.target.value)}
                    />
                    {g}
                  </label>
                ))}
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="patient-phone">Phone (optional)</label>
              <input
                id="patient-phone"
                className={styles.input}
                type="tel"
                placeholder="+91 XXXXX XXXXX"
                value={patientPhone}
                onChange={(e) => setPatientPhone(e.target.value)}
              />
            </div>

            {/* Consent block — mandatory */}
            <div className={styles.consentBlock} role="group" aria-labelledby="consent-heading">
              <div className={styles.consentHeader}>
                <Lock size={15} />
                <span id="consent-heading">Patient Recording Consent</span>
              </div>
              <div className={styles.consentBody}>
                <p>
                  This consultation will be audio-recorded and transcribed by AI to assist
                  the doctor with clinical documentation.
                </p>
                <ul className={styles.consentList}>
                  <li>The recording is processed automatically and deleted after transcription.</li>
                  <li>The transcript is used only for generating clinical notes.</li>
                  <li>Your data is stored securely within India.</li>
                  <li>You may opt out at any time by informing the doctor.</li>
                </ul>
                <label className={styles.consentCheck}>
                  <input
                    type="checkbox"
                    checked={consented}
                    onChange={handleConsentChange}
                    aria-required="true"
                  />
                  <span>
                    I, the patient, consent to audio recording of this consultation for the
                    purpose of clinical documentation.
                  </span>
                </label>
              </div>
            </div>

            <div className={styles.actions}>
              <button className={styles.btnSecondary} onClick={() => setStep(0)}>← Back</button>
              <button
                className={styles.btnPrimary}
                disabled={!patientName.trim() || !consented}
                onClick={() => setStep(2)}
              >
                I Consent — Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step 2 — Summary + Start */}
        {step === 2 && (
          <div className={styles.stepContent}>
            <h2 className={styles.stepTitle}>Ready to Start</h2>

            <div className={styles.summary}>
              <div className={styles.summaryRow}>
                <span className={styles.summaryKey}>Doctor</span>
                <span className={styles.summaryVal}>{selectedDoctor?.name}</span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryKey}>Patient</span>
                <span className={styles.summaryVal}>{patientName}</span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryKey}>Consent given</span>
                <span className={styles.summaryVal}>
                  ✓ {consentTimestamp ? new Date(consentTimestamp).toLocaleTimeString() : ''}
                </span>
              </div>
            </div>

            <p className={styles.warning}>
              ⚠ Ensure the device microphone is accessible and the patient is in the room.
            </p>

            <div className={styles.actions}>
              <button className={styles.btnSecondary} onClick={() => setStep(1)}>← Back</button>
              <button
                className={styles.btnStart}
                onClick={handleStart}
                disabled={loading}
              >
                <Mic size={16} />
                {loading ? 'Starting…' : 'Start Recording'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
