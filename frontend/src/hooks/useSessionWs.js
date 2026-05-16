// frontend/src/hooks/useSessionWs.js

import { useEffect, useRef, useCallback, useState } from 'react'
import { useSessionStore } from '../stores/sessionStore'
import { getToken } from '../utils/storage'

const WS_RECONNECT_DELAY_MS = 2000
const WS_MAX_RECONNECT_ATTEMPTS = 3

export function useSessionWs(sessionId) {
  const wsRef = useRef(null)
  const isMountedRef = useRef(true)
  const reconnectTimerRef = useRef(null)
  const reconnectCountRef = useRef(0)
  const connectRef = useRef(null)

  const [connectionError, setConnectionError] = useState(null)

  const connect = useCallback(async (cancelled) => {
    if (!isMountedRef.current || !sessionId || cancelled?.value) return

    // Guard: don't open a new connection if one is already live
    if (
      wsRef.current?.readyState === WebSocket.OPEN ||
      wsRef.current?.readyState === WebSocket.CONNECTING
    ) return

    useSessionStore.getState().setWsStatus('connecting')
    setConnectionError(null)

    const apiUrl = import.meta.env.VITE_API_URL
    const base = apiUrl
      ? apiUrl.replace(/^https/, 'wss').replace(/^http/, 'ws')
      : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`
    // Browsers cannot send custom headers on WebSocket upgrades — pass JWT as query param
    const token = await getToken()
    const wsUrl = token
      ? `${base}/ws/session/${sessionId}?token=${encodeURIComponent(token)}`
      : `${base}/ws/session/${sessionId}`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      if (!isMountedRef.current) return
      reconnectCountRef.current = 0
      useSessionStore.getState().setWsStatus('connected')
    }

    ws.onclose = (event) => {
      // cancelled.value is true when StrictMode cleanup already ran for this mount.
      // Without this check, WS1's onclose fires after WS2 has connected and
      // overwrites wsStatus back to 'disconnected', killing the mic.
      if (!isMountedRef.current || cancelled?.value) return
      useSessionStore.getState().setWsStatus('disconnected')

      const shouldReconnect =
        event.code !== 1000
        && event.code !== 1008
        && reconnectCountRef.current < WS_MAX_RECONNECT_ATTEMPTS
        && !cancelled?.value  // Don't reconnect if cleanup already ran

      if (shouldReconnect) {
        reconnectCountRef.current++
        reconnectTimerRef.current = setTimeout(() => {
          if (isMountedRef.current && !cancelled?.value) {
            connectRef.current?.()
          }
        }, WS_RECONNECT_DELAY_MS)
      } else if (event.code === 1008) {
        setConnectionError(`Session limit reached: ${event.reason}`)
        useSessionStore.getState().setWsStatus('error')
      }
    }

    ws.onerror = () => {
      if (!isMountedRef.current || cancelled?.value) return
      useSessionStore.getState().setWsStatus('error')
    }

    ws.onmessage = (event) => {
      if (!isMountedRef.current || typeof event.data !== 'string') return
      try {
        const msg = JSON.parse(event.data)
        switch (msg.type) {
          case 'connected':
            break

          case 'transcript_chunk':
            useSessionStore.getState().addTranscriptChunk({
              text: msg.text,
              speaker: msg.speaker || 'unknown',
              start: msg.start,
              end: msg.end,
              confidence: msg.confidence,
              chunkIndex: msg.chunk_index,
              timestamp: new Date().toISOString(),
            })
            break

          case 'error':
            console.warn('WS server error:', msg.message)
            setConnectionError(msg.message)
            break

          case 'session_ended':
            useSessionStore.getState().setWsStatus('disconnected')
            break

          default:
            console.log('WS unhandled message type:', msg.type)
        }
      } catch (e) {
        console.warn('WS: failed to parse message:', event.data)
      }
    }
  }, [sessionId])

  connectRef.current = connect

  const sendAudioChunk = useCallback((audioBlob) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(audioBlob)
    }
  }, [])

  useEffect(() => {
    // cancelled is a mutable object so the closure inside connect() always
    // sees the latest value — this is the correct StrictMode-safe pattern.
    // React StrictMode mounts → cleans up → remounts in dev.
    // The cancelled flag prevents the first (immediately cleaned-up) mount
    // from leaving a dangling reconnect timer or open socket.
    const cancelled = { value: false }
    isMountedRef.current = true
    reconnectCountRef.current = 0

    if (sessionId) connect(cancelled)

    return () => {
      cancelled.value = true
      isMountedRef.current = false
      clearTimeout(reconnectTimerRef.current)
      wsRef.current?.close(1000, 'Component unmounted')
    }
  }, [sessionId]) // ✅ connect intentionally excluded — stable via connectRef

  return { sendAudioChunk, connectionError }
}
