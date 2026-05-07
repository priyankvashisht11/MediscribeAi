import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { notesApi, sessionsApi } from '../services/api'
import { useSessionStore } from '../stores/sessionStore'
import { useSessionWs } from '../hooks/useSessionWs'
import { useUiStore } from '../stores/uiStore'
import { Square, RefreshCw, Stethoscope, User } from 'lucide-react'
import styles from './ActiveSession.module.css'

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

export default function ActiveSession() {
  const { id } = useParams()
  const navigate = useNavigate()
  const addToast = useUiStore((s) => s.addToast)
  const { transcriptChunks, wsStatus, clearTranscript } = useSessionStore()
  const { sendAudioChunk } = useSessionWs(id)

  const feedRef = useRef(null)
  const [elapsed, setElapsed] = useState(0)
  const [note, setNote] = useState(null)
  const [noteFields, setNoteFields] = useState({})
  const [ending, setEnding] = useState(false)

  // Session timer
  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(t)
  }, [])

  // Clear transcript on mount
  useEffect(() => { clearTranscript() }, [clearTranscript])

  // Auto-scroll transcript feed
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight
    }
  }, [transcriptChunks])

  // Simulate sending audio chunks to trigger mock transcript
  useEffect(() => {
    if (wsStatus !== 'connected') return
    const t = setInterval(() => {
      sendAudioChunk(new Uint8Array([0]).buffer)
    }, 2000)
    return () => clearInterval(t)
  }, [wsStatus, sendAudioChunk])

  // Fetch note after first transcript chunk arrives
  useEffect(() => {
    if (transcriptChunks.length === 3 && !note) {
      notesApi.get(id).then((n) => {
        setNote(n)
        setNoteFields({
          chief_complaint: n.chief_complaint,
          history_of_present_illness: n.history_of_present_illness,
          assessment: n.assessment,
          plan: n.plan,
        })
      })
    }
  }, [transcriptChunks.length, id, note])

  const fmt = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  const handleEnd = async () => {
    setEnding(true)
    try {
      await sessionsApi.end(id)
      navigate(`/sessions/${id}/review`)
    } catch {
      addToast({ type: 'error', message: 'Failed to end session.' })
      setEnding(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.layout}>
        {/* Left — Transcript feed */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div className={styles.timerRow}>
              <span className={styles.timer}>{fmt(elapsed)}</span>
              {wsStatus === 'connected' && (
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

          <div className={styles.feed} ref={feedRef}>
            {transcriptChunks.length === 0 && wsStatus === 'connecting' && (
              <div className={styles.skeleton}>
                <div className={styles.skeletonLine} style={{ width: '70%' }} />
                <div className={styles.skeletonLine} style={{ width: '50%' }} />
                <div className={styles.skeletonLine} style={{ width: '80%' }} />
              </div>
            )}
            {transcriptChunks.map((chunk, i) => (
              <div
                key={i}
                className={`${styles.bubble} ${chunk.speaker === 'doctor' ? styles.bubbleDoctor : styles.bubblePatient}`}
              >
                <span className={styles.bubbleSpeaker}>
                  {chunk.speaker === 'doctor'
                    ? <><Stethoscope size={11} /> Doctor</>
                    : <><User size={11} /> Patient</>
                  }
                </span>
                <p className={styles.bubbleText}>{chunk.text}</p>
              </div>
            ))}
          </div>

          <div className={styles.panelFooter}>
            <button
              className={styles.endBtn}
              onClick={handleEnd}
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
              onClick={() => notesApi.get(id).then((n) => {
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
