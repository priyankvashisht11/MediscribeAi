import { useRef, useEffect } from 'react'
import { Mic, Square, MicOff } from 'lucide-react'
import styles from './MobileSessionView.module.css'

function fmt(s) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
}

// Waveform — 5 CSS bars, only animate while recording
function Waveform({ active }) {
  return (
    <div className={`${styles.waveform} ${active ? styles.waveformActive : ''}`}>
      {[1,2,3,4,5].map(i => (
        <div key={i} className={`${styles.bar} ${styles[`bar${i}`]}`} />
      ))}
    </div>
  )
}

// Large central record button with state machine
function RecordButton({ micStatus, wsStatus, onStart, onRetry }) {
  const isRecording = micStatus === 'recording'
  const isConnecting = wsStatus === 'connecting' || micStatus === 'requesting'
  const isStopping = wsStatus === 'disconnected' && micStatus === 'stopped'
  const isDenied = micStatus === 'denied'
  const isIdle = !isRecording && !isConnecting && !isDenied

  if (isRecording) {
    return (
      <div className={`${styles.recordBtn} ${styles.recordBtnActive}`}>
        <span className={styles.recordDot} />
        <Mic size={32} />
      </div>
    )
  }

  if (isConnecting) {
    return (
      <div className={`${styles.recordBtn} ${styles.recordBtnConnecting}`}>
        <span className={styles.spinner} />
      </div>
    )
  }

  if (isDenied) {
    return (
      <div className={`${styles.recordBtn} ${styles.recordBtnDenied}`} onClick={onRetry}>
        <MicOff size={28} />
      </div>
    )
  }

  if (isIdle) {
    return (
      <div className={`${styles.recordBtn} ${styles.recordBtnIdle}`} onClick={onStart}>
        <Mic size={32} />
      </div>
    )
  }

  return (
    <div className={`${styles.recordBtn} ${styles.recordBtnConnecting}`}>
      <span className={styles.spinner} />
    </div>
  )
}

// Individual transcript bubble — doctor right teal, patient left grey
function Bubble({ chunk, onToggleSpeaker }) {
  const isDoctor = chunk.speaker === 'doctor'
  const isPatient = chunk.speaker === 'patient'

  return (
    <div className={`${styles.bubble} ${isDoctor ? styles.bubbleDoctor : isPatient ? styles.bubblePatient : styles.bubbleUnknown}`}>
      <div className={styles.bubbleMeta}>
        <span className={styles.bubbleLabel}>
          {isDoctor ? '🩺 Doctor' : isPatient ? '👤 Patient' : '🎙 Speaking'}
        </span>
      </div>
      <div className={styles.bubbleText}>{chunk.text}</div>
    </div>
  )
}

export default function MobileSessionView({
  patientName,
  elapsed,
  transcriptChunks,
  wsStatus,
  micStatus,
  micError,
  connectionError,
  ending,
  onEndSession,
  onStartCapture,
  onToggleSpeaker,
}) {
  const feedRef = useRef(null)
  const isRecording = micStatus === 'recording'

  // Auto-scroll transcript to latest
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight
    }
  }, [transcriptChunks])

  return (
    <div className={styles.screen}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.patientName}>{patientName || 'Session'}</span>
          {connectionError && (
            <span className={styles.connError}>⚠ Connection lost</span>
          )}
        </div>
        <div className={styles.headerRight}>
          <span className={styles.timer}>{fmt(elapsed)}</span>
          {isRecording && (
            <span className={styles.recPill}>
              <span className={styles.recDot} /> REC
            </span>
          )}
        </div>
      </div>

      {/* ── Transcript Feed ────────────────────────────────────────── */}
      <div className={styles.feed} ref={feedRef}>
        {transcriptChunks.length === 0 ? (
          <div className={styles.emptyState}>
            {wsStatus === 'connecting' && <p>Connecting…</p>}
            {wsStatus === 'connected' && micStatus !== 'recording' && (
              <p>{micStatus === 'requesting' ? 'Requesting microphone…' : 'Waiting to start…'}</p>
            )}
            {wsStatus === 'connected' && isRecording && (
              <p className={styles.listeningHint}>🎙 Listening… speak now</p>
            )}
            {micError && <p className={styles.errorHint}>{micError}</p>}
          </div>
        ) : (
          transcriptChunks.map((chunk, i) => (
            <Bubble key={chunk.chunkIndex ?? i} chunk={chunk} onToggleSpeaker={onToggleSpeaker} />
          ))
        )}
      </div>

      {/* ── Recording Controls ─────────────────────────────────────── */}
      <div className={styles.controls}>
        <Waveform active={isRecording} />

        <div className={styles.recordRow}>
          <div className={styles.chunkCount}>
            {transcriptChunks.length > 0 && (
              <span>{transcriptChunks.length} utterance{transcriptChunks.length !== 1 ? 's' : ''}</span>
            )}
          </div>

          <RecordButton
            micStatus={micStatus}
            wsStatus={wsStatus}
            onStart={onStartCapture}
            onRetry={onStartCapture}
          />

          <div className={styles.recordHint}>
            {isRecording ? 'Recording' : wsStatus === 'connecting' ? 'Connecting…' : 'Ready'}
          </div>
        </div>

        <button
          className={styles.endBtn}
          onClick={onEndSession}
          disabled={ending}
        >
          <Square size={15} fill="currentColor" />
          {ending ? 'Generating note…' : 'End Session'}
        </button>
      </div>
    </div>
  )
}
