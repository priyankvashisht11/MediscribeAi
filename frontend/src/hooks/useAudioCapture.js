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

export function useAudioCapture({ onChunk, isConnected }) {
  /**
   * Props:
   *   onChunk(blob: Blob): called every ~1s with one binary audio chunk
   *   isConnected: boolean — only send chunks when WebSocket is connected
   *
   * Returns:
   *   micStatus:    'idle' | 'requesting' | 'granted' | 'denied' | 'recording' | 'stopped' | 'error'
   *   startCapture: () => Promise<void>
   *   stopCapture:  () => void
   *   errorMessage: string | null
   */

  const [micStatus, setMicStatus] = useState('idle')
  const [errorMessage, setErrorMessage] = useState(null)

  const streamRef = useRef(null)    // Active MediaStream
  const recorderRef = useRef(null)  // Active MediaRecorder
  // Ref so ondataavailable always reads the latest isConnected value (avoids stale closure)
  const isConnectedRef = useRef(isConnected)
  useEffect(() => { isConnectedRef.current = isConnected }, [isConnected])

  const stopCapture = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
    if (streamRef.current) {
      // Stop all tracks — this turns off the browser microphone indicator
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    recorderRef.current = null
    setMicStatus('stopped')
  }, [])

  const startCapture = useCallback(async () => {
    setErrorMessage(null)
    setMicStatus('requesting')

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

    streamRef.current = stream
    setMicStatus('granted')

    // 2. Create MediaRecorder
    const mimeType = getSupportedMimeType()
    const recorder = new MediaRecorder(stream, {
      ...(mimeType && { mimeType }),
      audioBitsPerSecond: 32000,  // 32kbps — adequate for speech recognition
    })
    recorderRef.current = recorder

    // 3. ondataavailable fires every 1000ms (set by timeslice in recorder.start)
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        if (isConnectedRef.current) {
          onChunk(event.data)
        }
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

    // 4. Start recording — ondataavailable fires every 1000ms
    recorder.start(1000)
    setMicStatus('recording')

  }, [onChunk, stopCapture]) // ✅ isConnected removed — we use isConnectedRef inside

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
