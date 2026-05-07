import { useEffect, useRef, useCallback } from 'react'
import { useSessionStore } from '../stores/sessionStore'

export function useSessionWs(sessionId) {
  const wsRef = useRef(null)
  const { addTranscriptChunk, setWsStatus } = useSessionStore()

  const connect = useCallback(() => {
    const wsUrl = `${import.meta.env.VITE_WS_URL || 'ws://localhost:8000'}/ws/session/${sessionId}`
    setWsStatus('connecting')
    wsRef.current = new WebSocket(wsUrl)

    wsRef.current.onopen = () => setWsStatus('connected')
    wsRef.current.onclose = () => setWsStatus('disconnected')
    wsRef.current.onerror = () => setWsStatus('error')
    wsRef.current.onmessage = (e) => {
      const data = JSON.parse(e.data)
      if (data.type === 'transcript_chunk') {
        addTranscriptChunk(data)
      }
    }
  }, [sessionId, addTranscriptChunk, setWsStatus])

  const sendAudioChunk = useCallback((chunk) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(chunk)
    }
  }, [])

  useEffect(() => {
    if (sessionId) connect()
    return () => wsRef.current?.close()
  }, [sessionId, connect])

  return { sendAudioChunk }
}
