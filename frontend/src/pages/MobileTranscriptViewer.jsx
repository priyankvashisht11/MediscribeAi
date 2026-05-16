import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { apiFetch, authHeader } from '../utils/apiFetch'
import { patientsApi } from '../services/api'
import { ArrowLeft, ArrowLeftRight, FileText } from 'lucide-react'
import styles from './MobileTranscriptViewer.module.css'

const BASE = import.meta.env.VITE_API_URL || ''

function SpeakerBadge({ speaker, onClick }) {
  const map = {
    doctor:  { label: '🩺 Doctor',  cls: styles.badgeDoctor },
    patient: { label: '👤 Patient', cls: styles.badgePatient },
  }
  const { label, cls } = map[speaker] ?? { label: '🎙 Unknown', cls: styles.badgeUnknown }
  return (
    <button className={`${styles.badge} ${cls}`} onClick={onClick} title="Tap to toggle speaker">
      {label}
    </button>
  )
}

export default function MobileTranscriptViewer() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [chunks, setChunks] = useState([])
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [flipping, setFlipping] = useState(false)

  const load = () => {
    setLoading(true)
    setError(null)
    Promise.all([
      fetch(`${BASE}/api/sessions/${sessionId}`, { headers: authHeader() })
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() }),
      fetch(`${BASE}/api/sessions/${sessionId}/transcript`, { headers: authHeader() })
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() }),
    ])
      .then(([sess, trans]) => {
        setSession(sess)
        setChunks(Array.isArray(trans) ? trans : [])
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [sessionId])

  const handleFlipAll = async () => {
    setFlipping(true)
    try {
      await patientsApi.flipAll(sessionId)
      setChunks(prev => prev.map(c => ({
        ...c,
        speaker: c.speaker === 'doctor' ? 'patient'
               : c.speaker === 'patient' ? 'doctor'
               : c.speaker,
      })))
    } finally {
      setFlipping(false)
    }
  }

  const handleToggleSpeaker = async (chunk) => {
    const next = chunk.speaker === 'doctor' ? 'patient' : 'doctor'
    try {
      const res = await apiFetch(`/api/sessions/${sessionId}/transcript/${chunk.id}/speaker`, {
        method: 'PATCH',
        body: JSON.stringify({ speaker: next }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setChunks(prev => prev.map(c => c.id === chunk.id ? { ...c, speaker: next } : c))
    } catch (err) {
      console.error('Speaker toggle failed:', err)
    }
  }

  if (loading) {
    return (
      <div className={styles.centeredState}>
        <span className={styles.spinner} />
        <p>Loading transcript…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.centeredState}>
        <p style={{ color: 'var(--color-error)' }}>{error}</p>
        <button className={styles.retryBtn} onClick={load}>Try Again</button>
      </div>
    )
  }

  return (
    <div className={styles.screen}>
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>
          <ArrowLeft size={18} />
        </button>
        <div className={styles.headerInfo}>
          <span className={styles.headerTitle}>Transcript</span>
          {session && (
            <span className={styles.headerMeta}>
              {session.patient_name ?? 'Unknown patient'} · {chunks.length} chunks
            </span>
          )}
        </div>
        {chunks.length > 0 && (
          <button
            className={styles.flipBtn}
            onClick={handleFlipAll}
            disabled={flipping}
            title="Flip all doctor ↔ patient"
          >
            <ArrowLeftRight size={15} />
          </button>
        )}
      </div>

      {/* Chunk list */}
      {chunks.length === 0 ? (
        <div className={styles.emptyState}>
          <p>No transcript available for this session.</p>
        </div>
      ) : (
        <div className={styles.feed}>
          {chunks.map(chunk => (
            <div key={chunk.id} className={`${styles.chunk} ${styles[`chunk_${chunk.speaker}`]}`}>
              <div className={styles.chunkMeta}>
                <SpeakerBadge
                  speaker={chunk.speaker}
                  onClick={() => handleToggleSpeaker(chunk)}
                />
                {chunk.start_time_ms != null && (
                  <span className={styles.timestamp}>
                    {(chunk.start_time_ms / 1000).toFixed(1)}s
                  </span>
                )}
                {chunk.confidence != null && chunk.confidence < 0.5 && (
                  <span className={styles.lowConf} title="Low confidence">⚠</span>
                )}
              </div>
              <p className={styles.chunkText}>{chunk.text}</p>
            </div>
          ))}
          <div style={{ height: 80 }} />
        </div>
      )}

      {/* View Note CTA */}
      {session?.id && (
        <div className={styles.actionBar}>
          <button
            className={styles.viewNoteBtn}
            onClick={() => navigate(`/sessions/${sessionId}/review`)}
          >
            <FileText size={15} /> View SOAP Note
          </button>
        </div>
      )}
    </div>
  )
}
