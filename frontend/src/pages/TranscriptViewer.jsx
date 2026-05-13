import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { apiFetch } from '../utils/apiFetch'

const BASE = import.meta.env.VITE_API_URL || ''

export default function TranscriptViewer() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [chunks, setChunks] = useState([])
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = () => {
    setLoading(true)
    setError(null)
    Promise.all([
      fetch(`${BASE}/api/sessions/${sessionId}`).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() }),
      fetch(`${BASE}/api/sessions/${sessionId}/transcript`).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() }),
    ])
      .then(([sess, trans]) => {
        setSession(sess)
        setChunks(Array.isArray(trans) ? trans : [])
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [sessionId])

  const handleSpeakerToggle = async (chunk) => {
    const newSpeaker = chunk.speaker === 'doctor' ? 'patient' : 'doctor'
    try {
      const res = await apiFetch(`/api/sessions/${sessionId}/transcript/${chunk.id}/speaker`, {
        method: 'PATCH',
        body: JSON.stringify({ speaker: newSpeaker }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setChunks(prev => prev.map(c => c.id === chunk.id ? { ...c, speaker: newSpeaker } : c))
    } catch (err) {
      console.error('Speaker toggle failed:', err)
    }
  }

  if (loading) {
    return <div className="page-loading" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--color-text-muted)' }}>Loading transcript…</div>
  }

  if (error) {
    return (
      <div className="error-state">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-error)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <p className="error-state-message">{error}</p>
        <button className="btn btn-ghost btn-sm" onClick={load}>Try Again</button>
      </div>
    )
  }

  return (
    <div className="transcript-viewer">
      <div className="transcript-header">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Back</button>
        <div style={{ flex: 1 }}>
          <h1 className="page-title" style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>Transcript</h1>
          {session && (
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginTop: 'var(--space-1)' }}>
              {session.patient_name} · {chunks.length} chunks
              {session.duration_seconds ? ` · ${Math.floor(session.duration_seconds / 60)}m` : ''}
            </p>
          )}
        </div>
        {session?.id && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => navigate(`/sessions/${sessionId}/review`)}
            style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
          >
            View Note →
          </button>
        )}
      </div>

      {chunks.length === 0 ? (
        <div className="error-state">
          <p className="error-state-message">No transcript available for this session.</p>
        </div>
      ) : (
        <div className="transcript-feed">
          {chunks.map(chunk => (
            <div
              key={chunk.id}
              className={`transcript-chunk transcript-chunk--${chunk.speaker}`}
            >
              <div className="chunk-meta">
                <button
                  className={`speaker-badge speaker-badge--${chunk.speaker}`}
                  onClick={() => handleSpeakerToggle(chunk)}
                  title="Click to toggle speaker"
                >
                  {chunk.speaker === 'doctor' ? '🩺 Doctor' : chunk.speaker === 'patient' ? '👤 Patient' : '🎙 Unknown'}
                </button>
                <span className="chunk-time">
                  {chunk.start_time_ms != null ? `${(chunk.start_time_ms / 1000).toFixed(1)}s` : ''}
                </span>
                {chunk.confidence != null && chunk.confidence < 0.5 && (
                  <span className="chunk-low-confidence" title="Low confidence">⚠</span>
                )}
              </div>
              <p className="chunk-text">{chunk.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
