// frontend/src/hooks/useSessionWs.js
// Full replacement of Sprint 5 stub.
// Handles real binary audio sending and all server message types.

import { useEffect, useRef, useCallback, useState } from 'react'
import { useSessionStore } from '../stores/sessionStore'

const WS_RECONNECT_DELAY_MS = 2000
const WS_MAX_RECONNECT_ATTEMPTS = 3

export function useSessionWs(sessionId) {
  const wsRef = useRef(null)
  const reconnectAttemptsRef = useRef(0)
  const reconnectTimerRef = useRef(null)
  const isMountedRef = useRef(true)

  const { addTranscriptChunk, setWsStatus } = useSessionStore()
  const [connectionError, setConnectionError] = useState(null)

  const getWsUrl = useCallback(() => {
    const base = import.meta.env.VITE_WS_URL || 'ws://localhost:8000'
    return `${base}/ws/session/${sessionId}`
  }, [sessionId])

  const handleServerMessage = useCallback((msg) => {
    switch (msg.type) {
      case 'connected':
        // Confirmation from server — connection handshake complete
        break

      case 'transcript_chunk':
        addTranscriptChunk({
          text: msg.text,
          speaker: msg.speaker || 'unknown',  // Sprint 1: always 'unknown'. Sprint 2: 'doctor'|'patient'
          start: msg.start,
          end: msg.end,
          confidence: msg.confidence,
          chunkIndex: msg.chunk_index,
          timestamp: new Date().toISOString(),
        })
        break

      case 'error':
        // Non-fatal server error — display in UI but keep connection open
        console.warn('WS server error:', msg.message)
        setConnectionError(msg.message)
        break

      case 'session_ended':
        setWsStatus('disconnected')
        break

      default:
        console.log('WS: unhandled message type:', msg.type)
    }
  }, [addTranscriptChunk, setWsStatus])

  const connect = useCallback(() => {
    if (!isMountedRef.current || !sessionId) return

    setWsStatus('connecting')
    setConnectionError(null)

    const ws = new WebSocket(getWsUrl())
    wsRef.current = ws

    ws.onopen = () => {
      if (!isMountedRef.current) return
      reconnectAttemptsRef.current = 0
      setWsStatus('connected')
    }

    ws.onclose = (event) => {
      if (!isMountedRef.current) return
      setWsStatus('disconnected')

      const shouldReconnect =
        event.code !== 1000        // 1000 = clean close (unmount)
        && event.code !== 1008     // 1008 = session limit rejection — do not retry
        && reconnectAttemptsRef.current < WS_MAX_RECONNECT_ATTEMPTS

      if (shouldReconnect) {
        reconnectAttemptsRef.current++
        reconnectTimerRef.current = setTimeout(() => {
          if (isMountedRef.current) connect()
        }, WS_RECONNECT_DELAY_MS)
      } else if (event.code === 1008) {
        setConnectionError(`Session limit reached: ${event.reason}`)
        setWsStatus('error')
      }
    }

    ws.onerror = () => {
      if (!isMountedRef.current) return
      setWsStatus('error')
    }

    ws.onmessage = (event) => {
      if (!isMountedRef.current) return
      if (typeof event.data === 'string') {
        try {
          handleServerMessage(JSON.parse(event.data))
        } catch (e) {
          console.warn('WS: failed to parse message:', event.data)
        }
      }
      // Binary messages from server are not expected — only client→server
    }
  }, [sessionId, getWsUrl, handleServerMessage, setWsStatus])

  // Send a binary audio blob over the WebSocket
  const sendAudioChunk = useCallback((audioBlob) => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(audioBlob)
    }
    // Silently drop if not connected — useAudioCapture also gates on isConnected
  }, [])

  useEffect(() => {
    isMountedRef.current = true
    if (sessionId) connect()

    return () => {
      isMountedRef.current = false
      clearTimeout(reconnectTimerRef.current)
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounted')
      }
    }
  }, [sessionId, connect])

  return { sendAudioChunk, connectionError }
}
