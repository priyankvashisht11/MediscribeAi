import { useState, useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { LogOut } from 'lucide-react'
import { useDoctorStore } from '../stores/doctorStore'
import { authHeader } from '../utils/apiFetch'
import { authApi } from '../services/api'
import { removeToken } from '../utils/storage'

const isNative = Capacitor.isNativePlatform()

const BASE = import.meta.env.VITE_API_URL || ''

function getInitials(name = '') {
  return name
    .split(' ')
    .filter(w => w.match(/^[A-Z]/))
    .slice(0, 2)
    .map(w => w[0])
    .join('')
}

async function logout() {
  await authApi.logout()
  await removeToken()
  useDoctorStore.getState().clearDoctor()
  window.dispatchEvent(new Event('mediscribe_auth_change'))
}

export default function Settings() {
  const doctor = useDoctorStore(s => s.doctor)
  const [health, setHealth] = useState(null)

  useEffect(() => {
    authHeader().then(headers =>
      fetch(`${BASE}/health`, { headers })
        .then(r => r.json())
        .then(setHealth)
        .catch(() => setHealth({ status: 'error' }))
    )
  }, [])

  const STATUS_ITEMS = [
    { label: 'API Server',    ok: health?.status   === 'ok' },
    { label: 'Database',      ok: health?.db        === 'ok' },
    { label: 'Session Cache', ok: health?.redis     === 'ok' },
    { label: 'Voice Engine',  ok: health?.deepgram  === 'configured' },
  ]

  return (
    <div className="settings-page">
      <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, marginBottom: 'var(--space-8)' }}>
        Settings
      </h1>

      {/* Section 1 — Signed-in doctor */}
      {doctor && (
        <div className="settings-section">
          <h2 className="settings-section-title">Account</h2>
          <div style={{ display: 'flex', flexDirection: isNative ? 'column' : 'row', alignItems: isNative ? 'stretch' : 'center', gap: 'var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <span className="doctor-chip-avatar" style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: 'var(--color-primary)', color: '#fff', fontWeight: 700, fontSize: 'var(--text-base)', flexShrink: 0 }}>
                {getInitials(doctor.name)}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 600 }}>{doctor.name}</p>
                <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                  {doctor.specialty} · {doctor.email}
                </p>
                <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                  Role: {doctor.role} · Clinic: {doctor.clinic_name || '—'}
                </p>
              </div>
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={logout}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, flexShrink: 0, minHeight: isNative ? 44 : undefined }}
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </div>
      )}

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
            <tr><td>Version</td><td>0.3.0</td></tr>
            <tr><td>Build</td><td>Sprint 10</td></tr>
            <tr><td>AI Engine</td><td>MediScribe Clinical AI</td></tr>
            <tr><td>Speech Recognition</td><td>MediScribe Voice Engine (en-IN)</td></tr>
            <tr><td>Speaker Detection</td><td>MediScribe Voice Engine (built-in)</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
