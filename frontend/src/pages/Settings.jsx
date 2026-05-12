import { useState, useEffect } from 'react'
import { useDoctors } from '../context/DoctorsContext'
import { useUiStore } from '../stores/uiStore'

function getInitials(name) {
  return name
    .split(' ')
    .filter(w => w.match(/^[A-Z]/))
    .slice(0, 2)
    .map(w => w[0])
    .join('')
}

export default function Settings() {
  const { doctors } = useDoctors()
  const { activeDoctorId, setActiveDoctorId } = useUiStore()
  const [health, setHealth] = useState(null)

  useEffect(() => {
    fetch('/health')
      .then(r => r.json())
      .then(setHealth)
      .catch(() => setHealth({ status: 'error' }))
  }, [])

  const STATUS_ITEMS = [
    { label: 'API Server', ok: health?.status === 'ok' },
    { label: 'Database',   ok: health?.db    === 'ok' },
    { label: 'Redis',      ok: health?.redis  === 'ok' },
    { label: 'Deepgram',   ok: health?.deepgram === 'configured' },
  ]

  return (
    <div className="settings-page">
      <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, marginBottom: 'var(--space-8)' }}>
        Settings
      </h1>

      {/* Section 1 — Active Doctor */}
      <div className="settings-section">
        <h2 className="settings-section-title">Active Doctor</h2>
        <p className="settings-section-desc text-muted">
          Select which doctor is using this terminal. This is used for audit attribution.
        </p>
        <div className="doctor-selector">
          {doctors.map(doc => (
            <button
              key={doc.id}
              className={`doctor-chip${activeDoctorId === doc.id ? ' doctor-chip--active' : ''}`}
              onClick={() => setActiveDoctorId(doc.id)}
            >
              <span className="doctor-chip-avatar">{getInitials(doc.name)}</span>
              <div className="doctor-chip-info">
                <span className="doctor-chip-name">{doc.name}</span>
                <span className="doctor-chip-specialty">{doc.specialty}</span>
              </div>
              {activeDoctorId === doc.id && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              )}
            </button>
          ))}
          {doctors.length === 0 && (
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
              Loading doctors…
            </p>
          )}
        </div>
      </div>

      {/* Section 2 — System Status */}
      <div className="settings-section">
        <h2 className="settings-section-title">System Status</h2>
        {health === null ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Checking…</p>
        ) : (
          STATUS_ITEMS.map(item => (
            <div key={item.label} className="status-row">
              <span className={`status-dot ${item.ok ? 'status-dot--ok' : 'status-dot--error'}`} />
              <span>{item.label}</span>
              <span style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)', color: item.ok ? 'var(--color-success)' : 'var(--color-error)', fontWeight: 600 }}>
                {item.ok ? 'OK' : 'Error'}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Section 3 — About */}
      <div className="settings-section">
        <h2 className="settings-section-title">About</h2>
        <table className="settings-table">
          <tbody>
            <tr><td>Version</td><td>0.1.0-poc</td></tr>
            <tr><td>Build</td><td>Sprint 7</td></tr>
            <tr><td>LLM Provider</td><td>Perplexity sonar-reasoning-pro</td></tr>
            <tr><td>ASR Model</td><td>Deepgram Nova-3 (en-IN)</td></tr>
            <tr><td>Diarization</td><td>Deepgram Nova-3 (built-in)</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
