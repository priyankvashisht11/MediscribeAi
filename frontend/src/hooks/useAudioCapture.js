// frontend/src/hooks/useAudioCapture.js
// Manages browser microphone access, MediaRecorder, and chunked audio sending.
// Works alongside useSessionWs: this hook produces audio blobs,
// useSessionWs sends them over the WebSocket.

import { useState, useRef, useCallback, useEffect } from 'react'

// MIME types in order of preference — webm/opus is compact and widely supported
const PREFERRED_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4',
]

function getSupportedMimeType() {
  for (const mime of PREFERRED_MIME_TYPES) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime)) {
      return mime
    }
  }
  return '' // Let browser choose
}

export function useAudioCapture({ onChunk, isConnected, mode = 'webm' }) {
  /**
   * Props:
   *   onChunk(blob: Blob | ArrayBuffer): called with each audio chunk
   *   isConnected: boolean — only send chunks when WebSocket is connected
   *   mode: 'webm' (default, for Deepgram) | 'pcm' (raw s16le Int16 for Sarvam)
   *
   * Returns:
   *   micStatus:    'idle' | 'requesting' | 'granted' | 'denied' | 'recording' | 'stopped' | 'error'
   *   startCapture: () => Promise<void>
   *   stopCapture:  () => void
   *   errorMessage: string | null
   */

  const [micStatus, setMicStatus] = useState('idle')
  const [errorMessage, setErrorMessage] = useState(null)

  const streamRef = useRef(null)
  const recorderRef = useRef(null)
  const audioCtxRef = useRef(null)
  const processorRef = useRef(null)
  const isConnectedRef = useRef(isConnected)
  const intentionalStopRef = useRef(false)
  useEffect(() => { isConnectedRef.current = isConnected }, [isConnected])

  const stopCapture = useCallback(() => {
    // Stop MediaRecorder (webm mode)
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
    recorderRef.current = null

    // Stop ScriptProcessor (pcm mode)
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close()
      audioCtxRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    setMicStatus('stopped')
  }, [])

  const startCapture = useCallback(async () => {
    console.log('[AudioCapture] startCapture called — recorderRef:', !!recorderRef.current, 'streamRef:', !!streamRef.current)
    // Guard: don't start if already recording or requesting
    if (recorderRef.current || streamRef.current) {
      console.log('[AudioCapture] Guard hit — already active, skipping')
      return
    }

    setErrorMessage(null)
    setMicStatus('requesting')
    console.log('[AudioCapture] calling getUserMedia...')

    // 1. Request microphone permission
    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,          // Mono — sufficient for speech
          sampleRate: 16000,        // 16kHz = Whisper native sample rate
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      })
    } catch (err) {
      console.log('[AudioCapture] getUserMedia FAILED:', err.name, err.message)
      let msg
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Microphone access denied. Please allow microphone access in browser settings and try again.'
      } else if (err.name === 'NotFoundError') {
        msg = 'No microphone found. Please connect a microphone and try again.'
      } else {
        msg = `Microphone error: ${err.message}`
      }
      setMicStatus('denied')
      setErrorMessage(msg)
      return
    }

    console.log('[AudioCapture] getUserMedia SUCCESS — stream tracks:', stream.getTracks().length)
    streamRef.current = stream
    setMicStatus('granted')

    if (mode === 'pcm') {
      // PCM path for Sarvam — raw s16le Int16 via ScriptProcessorNode at 16kHz
      const audioCtx = new AudioContext({ sampleRate: 16000 })
      audioCtxRef.current = audioCtx
      const source = audioCtx.createMediaStreamSource(stream)
      // 4096-sample buffer → ~256ms at 16kHz, balances latency and CPU
      const processor = audioCtx.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor

      processor.onaudioprocess = (e) => {
        if (!isConnectedRef.current) return
        const float32 = e.inputBuffer.getChannelData(0)
        const int16 = new Int16Array(float32.length)
        for (let i = 0; i < float32.length; i++) {
          const s = Math.max(-1, Math.min(1, float32[i]))
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
        }
        onChunk(int16.buffer)
      }

      source.connect(processor)
      processor.connect(audioCtx.destination)
      setMicStatus('recording')
    } else {
      // WebM path for Deepgram — MediaRecorder
      const mimeType = getSupportedMimeType()
      const recorder = new MediaRecorder(stream, {
        ...(mimeType && { mimeType }),
        audioBitsPerSecond: 32000,
      })
      recorderRef.current = recorder

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0 && isConnectedRef.current) {
          onChunk(event.data)
        }
      }

      recorder.onerror = (event) => {
        setMicStatus('error')
        setErrorMessage(`Recording error: ${event.error?.message || 'Unknown recording error'}`)
        stopCapture()
      }

      recorder.onstop = () => {
        setMicStatus('stopped')
      }

      // 250ms timeslice — low latency for Deepgram streaming
      recorder.start(250)
      setMicStatus('recording')
    }

  }, [onChunk, stopCapture, mode]) // ✅ isConnected removed — we use isConnectedRef inside

  // Auto-stop if WebSocket disconnects while recording
  useEffect(() => {
    if (!isConnected && micStatus === 'recording') {
      stopCapture()
    }
  }, [isConnected, micStatus, stopCapture])

  // Cleanup all tracks on component unmount
  useEffect(() => {
    return () => { stopCapture() }
  }, [stopCapture])

  return { micStatus, startCapture, stopCapture, errorMessage }
}
