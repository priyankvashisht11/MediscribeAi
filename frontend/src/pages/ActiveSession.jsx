import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { notesApi, sessionsApi } from '../services/api'
import { useSessionStore } from '../stores/sessionStore'
import { useSessionWs } from '../hooks/useSessionWs'
import { useAudioCapture } from '../hooks/useAudioCapture'
import { useUiStore } from '../stores/uiStore'
import { Square, RefreshCw } from 'lucide-react'
import styles from './ActiveSession.module.css'

// Helper: format seconds as MM:SS
function formatDuration(seconds) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

// Transcript message component
function TranscriptMessage({ chunk }) {
  const isDoctor  = chunk.speaker === 'doctor'
  const isUnknown = chunk.speaker === 'unknown'
  const isLowConf = typeof chunk.confidence === 'number' && chunk.confidence < 0.5

  return (
    <div className="transcript-msg" style={{ marginBottom: 'var(--space-3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                    marginBottom: 'var(--space-1)' }}>
        <span style={{
          fontSize: 'var(--text-xs)', fontWeight: 600, letterSpacing: '0.05em',
          color: isDoctor ? 'var(--color-primary)' : 'var(--color-text-muted)',
          textTransform: 'uppercase',
        }}>
          {isDoctor ? '🩺 Doctor' : isUnknown ? '🎙 Speaking' : '👤 Patient'}
        </span>
        {chunk.start !== undefined && (
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            {formatDuration(chunk.start)}
          </span>
        )}
        {isLowConf && (
          <span title="Low confidence — may contain errors"
                style={{ fontSize: 'var(--text-xs)', color: 'var(--color-warning)' }}>⚠</span>
        )}
      </div>
      <div style={{
        background: isDoctor ? 'var(--color-primary-light)' : 'var(--color-surface-2)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-2) var(--space-3)',
        fontSize: 'var(--text-sm)',
        lineHeight: 1.5,
        opacity: isLowConf ? 0.7 : 1,
      }}>
        {chunk.text}
      </div>
    </div>
  )
}

// Empty state component
function TranscriptEmptyState({ wsStatus, micStatus, micError }) {
  const state = {
    connecting:   { icon: '⏳', text: 'Connecting to session...' },
    connected:    { icon: '🎙', text: micStatus === 'requesting' ? 'Requesting microphone access...' : 'Listening... speak now.' },
    disconnected: { icon: '⚠️', text: 'Connection lost. Attempting to reconnect...' },
    error:        { icon: '❌', text: 'Connection error. Please end this session and start a new one.' },
  }
  const s = state[wsStatus] || state.connecting

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', height: '200px', gap: 'var(--space-3)',
                  color: 'var(--color-text-muted)', padding: 'var(--space-8)',
                  textAlign: 'center' }}>
      <span style={{ fontSize: '2rem' }}>{s.icon}</span>
      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>{s.text}</span>
      {micError && (
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-error)',
                       maxWidth: '30ch', lineHeight: 1.4 }}>
          {micError}
        </span>
      )}
    </div>
  )
}

// Confidence bar component
function ConfidenceBar({ score }) {
  const pct = Math.round((score ?? 0) * 100)
  const color = score >= 0.8 ? 'var(--color-primary)' : score >= 0.6 ? 'var(--color-warning)' : 'var(--color-error)'
  return (
    <div className={styles.confBar}>
      <span className={styles.confLabel}>Confidence</span>
      <div className={styles.confTrack}>
        <div className={styles.confFill} style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className={styles.confPct} style={{ color }}>{pct}%</span>
    </div>
  )
}

// Main component
export default function ActiveSession() {
  const { id: sessionId } = useParams()
  const navigate = useNavigate()
  const addToast = useUiStore((s) => s.addToast)
  const { transcriptChunks, wsStatus, clearTranscript } = useSessionStore()

  const feedRef = useRef(null)
  const [elapsed, setElapsed] = useState(0)
  const [note, setNote] = useState(null)
  const [noteFields, setNoteFields] = useState({})
  const [ending, setEnding] = useState(false)

  // Clear any transcript from a previous session on mount
  useEffect(() => {
    clearTranscript()
  }, [sessionId, clearTranscript])

  // Real WebSocket connection
  const { sendAudioChunk, connectionError } = useSessionWs(sessionId)

  // Real microphone capture — sends each chunk directly to WebSocket
  const { micStatus, startCapture, stopCapture, errorMessage: micError } = useAudioCapture({
    onChunk: sendAudioChunk,
    isConnected: wsStatus === 'connected',
  })

  // Auto-start mic once WebSocket confirms connection
  useEffect(() => {
    if (wsStatus === 'connected' && micStatus === 'idle') {
      startCapture()
    }
  }, [wsStatus, micStatus, startCapture])

  // Session timer
  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(t)
  }, [])

  // Auto-scroll transcript feed
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight
    }
  }, [transcriptChunks])

  // Fetch note after first transcript chunk arrives
  useEffect(() => {
    if (transcriptChunks.length === 3 && !note) {
      notesApi.get(sessionId).then((n) => {
        setNote(n)
        setNoteFields({
          chief_complaint: n.chief_complaint,
          history_of_present_illness: n.history_of_present_illness,
          assessment: n.assessment,
          plan: n.plan,
        })
      })
    }
  }, [transcriptChunks.length, sessionId, note])

  const fmt = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  const handleEndSession = () => {
    stopCapture()                              // Stop microphone first
    navigate(`/sessions/${sessionId}/review`) // WS closes automatically on unmount
  }

  return (
    <div className={styles.page}>
      <div className={styles.layout}>
        {/* Left — Transcript feed */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div className={styles.timerRow}>
              <span className={styles.timer}>{fmt(elapsed)}</span>
              {wsStatus === 'connected' && micStatus === 'recording' && (
                <span className={styles.recBadge}>
                  <span className={styles.recDot} /> REC
                </span>
              )}
              {wsStatus === 'connecting' && (
                <span className={styles.connectingBadge}>Connecting…</span>
              )}
              {(wsStatus === 'disconnected' || wsStatus === 'error') && (
                <span className={styles.errorBadge}>
                  Connection lost — attempting to reconnect…
                </span>
              )}
            </div>
          </div>

          {/* Connection error banner */}
          {connectionError && (
            <div style={{
              fontSize: 'var(--text-xs)', color: 'var(--color-error)',
              padding: 'var(--space-2) var(--space-4)',
              background: 'var(--color-error-light)',
              borderBottom: '1px solid var(--color-border)',
            }}>
              ⚠ {connectionError}
            </div>
          )}

          <div className={styles.feed} ref={feedRef}>
            {transcriptChunks.length === 0 ? (
              <TranscriptEmptyState wsStatus={wsStatus} micStatus={micStatus} micError={micError} />
            ) : (
              <div className="transcript-feed">
                {transcriptChunks.map((chunk, i) => (
                  <TranscriptMessage key={chunk.chunkIndex ?? i} chunk={chunk} />
                ))}
              </div>
            )}
          </div>

          <div className={styles.panelFooter}>
            <button
              className={styles.endBtn}
              onClick={handleEndSession}
              disabled={ending}
            >
              <Square size={14} fill="currentColor" />
              {ending ? 'Ending…' : 'End Session'}
            </button>
          </div>
        </div>

        {/* Right — Draft note */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Draft Note</span>
            <button
              className={styles.generateBtn}
              onClick={() => notesApi.get(sessionId).then((n) => {
                setNote(n)
                setNoteFields({
                  chief_complaint: n.chief_complaint,
                  history_of_present_illness: n.history_of_present_illness,
                  assessment: n.assessment,
                  plan: n.plan,
                })
              })}
            >
              <RefreshCw size={13} /> Generate Note
            </button>
          </div>

          <div className={styles.noteBody}>
            {!note ? (
              <div className={styles.skeleton}>
                {[80, 60, 90, 70, 55].map((w, i) => (
                  <div key={i} className={styles.skeletonLine} style={{ width: `${w}%` }} />
                ))}
                <p className={styles.noteHint}>Note will appear after transcription begins…</p>
              </div>
            ) : (
              <>
                {[
                  { key: 'chief_complaint', label: 'Chief Complaint' },
                  { key: 'history_of_present_illness', label: 'History' },
                  { key: 'assessment', label: 'Assessment' },
                  { key: 'plan', label: 'Plan' },
                ].map(({ key, label }) => (
                  <div key={key} className={styles.noteSection}>
                    <span className={styles.noteSectionLabel}>{label}</span>
                    <textarea
                      className={styles.noteTextarea}
                      value={noteFields[key] ?? ''}
                      onChange={(e) => setNoteFields((f) => ({ ...f, [key]: e.target.value }))}
                      rows={3}
                    />
                  </div>
                ))}
                <ConfidenceBar score={note.confidence_score} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
