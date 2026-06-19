import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { notesApi, sessionsApi } from '../services/api'
import { useSessionStore } from '../stores/sessionStore'
import { useSessionWs } from '../hooks/useSessionWs'
import { useAudioCapture } from '../hooks/useAudioCapture'
import { useUiStore } from '../stores/uiStore'
import { apiFetch } from '../utils/apiFetch'
import { Square, RefreshCw, ArrowLeftRight } from 'lucide-react'
import styles from './ActiveSession.module.css'

// Helper: format seconds as MM:SS
function formatDuration(seconds) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

// Transcript message component
function TranscriptMessage({ chunk, onToggleSpeaker }) {
  const isDoctor  = chunk.speaker === 'doctor'
  const isPatient = chunk.speaker === 'patient'
  const isUnknown = !isDoctor && !isPatient
  const isLowConf = typeof chunk.confidence === 'number' && chunk.confidence < 0.5

  function cycleSpeaker() {
    const next = isDoctor ? 'patient' : isPatient ? 'doctor' : 'doctor'
    onToggleSpeaker(chunk.chunkIndex, next)
  }

  const speakerLabel = isDoctor ? 'Doctor' : isPatient ? 'Patient' : 'Speaking'
  const speakerIcon  = isDoctor ? '🩺' : isPatient ? '👤' : '🎙'
  const speakerColor = isDoctor ? 'var(--color-primary)' : 'var(--color-text-muted)'

  return (
    <div className="transcript-msg" style={{ marginBottom: 'var(--space-3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                    marginBottom: 'var(--space-1)' }}>
        <span
          title="Click to reassign speaker"
          onClick={cycleSpeaker}
          style={{
            fontSize: 'var(--text-xs)', fontWeight: 600, letterSpacing: '0.05em',
            color: speakerColor, textTransform: 'uppercase',
            cursor: 'pointer', userSelect: 'none',
            padding: '1px 6px', borderRadius: 'var(--radius-sm)',
            border: `1px solid ${isUnknown ? 'transparent' : speakerColor}`,
          }}>
          {speakerIcon} {speakerLabel}
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

// Speaker diarization warm-up hint — shown while all chunks are still "unknown"
function DiarizationWarmupHint({ transcriptChunks, wsStatus, micStatus }) {
  if (
    wsStatus !== 'connected' ||
    micStatus !== 'recording' ||
    transcriptChunks.length === 0 ||
    !transcriptChunks.every(c => c.speaker === 'unknown')
  ) return null

  return (
    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)',
                  textAlign: 'center', padding: 'var(--space-2) var(--space-4)' }}>
      Identifying speakers... labels appear after ~30s of audio
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
  const [searchParams] = useSearchParams()
  const provider = searchParams.get('provider') || 'deepgram'
  const addToast = useUiStore((s) => s.addToast)
  const { transcriptChunks, wsStatus, clearTranscript, updateChunkSpeaker } = useSessionStore()

  const feedRef = useRef(null)
  const [elapsed, setElapsed] = useState(0)
  const [note, setNote] = useState(null)
  const [noteFields, setNoteFields] = useState({})
  const [ending, setEnding] = useState(false)
  const [killing, setKilling] = useState(false)
  const [showEndModal, setShowEndModal] = useState(false)

  const speakerMapEstablished = transcriptChunks.some(
    c => c.speaker === 'doctor' || c.speaker === 'patient'
  )

  // Clear any transcript from a previous session on mount
  useEffect(() => {
    clearTranscript()
  }, [sessionId, clearTranscript])

  // Real WebSocket connection — pass provider so backend routes to correct ASR
  const { sendAudioChunk, connectionError } = useSessionWs(sessionId, provider)

  // Real microphone capture — PCM for Sarvam, WebM for Deepgram
  const { micStatus, startCapture, stopCapture, errorMessage: micError } = useAudioCapture({
    onChunk: sendAudioChunk,
    isConnected: wsStatus === 'connected',
    mode: (provider === 'sarvam' || provider === 'sarvam_en') ? 'pcm' : 'webm',
  })

  // Auto-start mic once WebSocket confirms connection.
  // Covers 'idle' (fresh mount), 'stopped' (StrictMode reconnect killed mic),
  // and 'error' (recorder crashed — retry). Never retries 'denied' (user blocked permission).
  useEffect(() => {
    if (wsStatus === 'connected' && ['idle', 'stopped', 'error'].includes(micStatus)) {
      console.log('[ActiveSession] auto-start: wsStatus=connected micStatus=' + micStatus)
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

  const handleEndSession = async () => {
    setEnding(true)
    setShowEndModal(false)
    try {
      // PATCH /end first — reads transcript from Redis while WebSocket is still open.
      // stopCapture() second — closing the WS triggers Redis cleanup in ws.py.
      const res = await apiFetch(`/api/sessions/${sessionId}/end`, { method: 'PATCH' })
      if (!res.ok) addToast({ type: 'warning', message: `Session ended but note trigger failed (${res.status})` })
    } catch (e) {
      console.warn('[ActiveSession] end session call failed:', e)
      addToast({ type: 'warning', message: 'Could not trigger note generation — transcript may be missing' })
    }
    try { stopCapture() } catch (_) {}
    navigate(`/sessions/${sessionId}/review`)
  }

  const handleKillSession = async (andNew = false) => {
    setKilling(true)
    setShowEndModal(false)
    try { stopCapture() } catch (_) {}
    try {
      await apiFetch(`/api/sessions/${sessionId}`, { method: 'DELETE' })
      clearTranscript()
      addToast({ type: 'success', message: 'Session deleted.' })
    } catch (e) {
      addToast({ type: 'warning', message: 'Could not delete session from server.' })
    }
    if (andNew) {
      navigate('/sessions/new')
    } else {
      navigate('/')
    }
  }

  // Flip all speaker labels live (in-memory only — DB flip happens post-session via TranscriptViewer)
  const handleFlipSpeakers = () => {
    transcriptChunks.forEach(chunk => {
      const flipped = chunk.speaker === 'doctor' ? 'patient' : chunk.speaker === 'patient' ? 'doctor' : chunk.speaker
      if (flipped !== chunk.speaker) updateChunkSpeaker(chunk.chunkIndex, flipped)
    })
    addToast({ type: 'success', message: 'Speaker labels flipped. Review and confirm after session.' })
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
              <span style={{
                fontSize: 'var(--text-xs)', padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
                background: provider === 'sarvam' ? '#fff3e0' : 'var(--color-primary-light)',
                color: provider === 'sarvam' ? '#e65100' : 'var(--color-primary)',
                border: `1px solid ${provider === 'sarvam' ? '#ffb74d' : 'var(--color-primary)'}`,
                fontWeight: 600, letterSpacing: '0.03em',
              }}>
                {provider === 'sarvam' ? 'Chartr Hindi' : provider === 'sarvam_en' ? 'Chartr Indian English' : 'Chartr Standard'}
              </span>
              {wsStatus === 'connecting' && (
                <span className={styles.connectingBadge}>Connecting…</span>
              )}
              {(wsStatus === 'disconnected' || wsStatus === 'error') && (
                <span className={styles.errorBadge}>
                  Connection lost — attempting to reconnect…
                </span>
              )}
            </div>
            {speakerMapEstablished && (
              <div style={{ display: 'flex', gap: 'var(--space-4)', fontSize: 'var(--text-xs)',
                            color: 'var(--color-text-muted)', paddingTop: 'var(--space-2)' }}>
                <span>🩺 <strong>Doctor</strong></span>
                <span>👤 <strong>Patient</strong></span>
                <span style={{ color: 'var(--color-text-faint)' }}>🎙 Speaker being identified...</span>
              </div>
            )}
          </div>

          {/* Mic denied banner */}
          {micStatus === 'denied' && (
            <div style={{
              fontSize: 'var(--text-xs)', color: 'var(--color-error)',
              padding: 'var(--space-2) var(--space-4)',
              background: 'var(--color-error-light)',
              borderBottom: '1px solid var(--color-border)',
              display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
            }}>
              🔒 Microphone blocked — click the lock icon in your address bar and allow microphone access, then refresh.
            </div>
          )}
          {wsStatus === 'connected' && micStatus !== 'recording' && micStatus !== 'requesting' && micStatus !== 'denied' && (
            <div style={{
              fontSize: 'var(--text-xs)', padding: 'var(--space-2) var(--space-4)',
              background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)',
              display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
            }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Microphone not active.</span>
              <button
                onClick={() => startCapture()}
                style={{
                  fontSize: 'var(--text-xs)', padding: '3px 12px',
                  background: 'var(--color-primary)', color: '#fff',
                  border: 'none', borderRadius: 'var(--radius-full)', cursor: 'pointer', fontWeight: 600,
                }}
              >
                Start Recording
              </button>
            </div>
          )}

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
                  <TranscriptMessage key={chunk.chunkIndex ?? i} chunk={chunk} onToggleSpeaker={updateChunkSpeaker} />
                ))}
                <DiarizationWarmupHint
                  transcriptChunks={transcriptChunks}
                  wsStatus={wsStatus}
                  micStatus={micStatus}
                />
              </div>
            )}
          </div>

          <div className={styles.panelFooter}>
            {speakerMapEstablished && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={handleFlipSpeakers}
                title="Flip all doctor↔patient labels"
                style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                         fontSize: 'var(--text-xs)', marginRight: 'auto' }}
              >
                <ArrowLeftRight size={13} /> Flip speakers
              </button>
            )}
            <button
              className={styles.endBtn}
              onClick={() => setShowEndModal(true)}
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

      {/* End-session confirmation modal */}
      {showEndModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 200,
          }}
          onClick={() => !ending && setShowEndModal(false)}
        >
          <div
            style={{
              background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-8)', width: 360, maxWidth: '90vw',
              boxShadow: 'var(--shadow-xl)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
              End Session?
            </h2>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)',
                         marginBottom: 'var(--space-2)', lineHeight: 1.6 }}>
              The session will end and the AI will generate a SOAP note from the transcript.
            </p>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)',
                         marginBottom: 'var(--space-6)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--color-text)' }}>
                {transcriptChunks.length} chunks
              </strong>{' '}
              recorded ·{' '}
              <strong style={{ color: 'var(--color-text)' }}>
                {Math.floor(elapsed / 60)}m {elapsed % 60}s
              </strong>
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShowEndModal(false)}
                style={{ flex: 1 }}
              >
                Continue Recording
              </button>
              <button
                className={styles.endBtn}
                onClick={handleEndSession}
                disabled={ending || killing}
                style={{ flex: 1 }}
              >
                <Square size={13} fill="currentColor" />
                {ending ? 'Ending…' : 'End & Generate Note'}
              </button>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-3)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-3)' }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => handleKillSession(false)}
                disabled={ending || killing}
                style={{ flex: 1, color: 'var(--color-error, #dc2626)', opacity: killing ? 0.6 : 1 }}
              >
                {killing ? 'Terminating…' : 'Terminate Session'}
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => handleKillSession(true)}
                disabled={ending || killing}
                style={{ flex: 1, color: 'var(--color-error, #dc2626)', opacity: killing ? 0.6 : 1 }}
              >
                Terminate & Start New
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
