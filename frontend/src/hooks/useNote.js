// frontend/src/hooks/useNote.js
// Polls GET /api/notes/{sessionId} until status is 'ready', 'edited', 'finalized', or 'error'.

import { useState, useEffect, useRef, useCallback } from 'react'

const POLL_INTERVAL_MS = 2000
const MAX_POLL_ATTEMPTS = 30  // 60s max (30 × 2s)

export function useNote(sessionId) {
  const [note, setNote] = useState(null)
  const [status, setStatus] = useState('idle')
  const [errorMessage, setErrorMessage] = useState(null)
  const pollTimerRef = useRef(null)
  const pollCountRef = useRef(0)
  const isMountedRef = useRef(true)

  const fetchNote = useCallback(async () => {
    if (!sessionId || !isMountedRef.current) return

    try {
      const res = await fetch(`/api/notes/${sessionId}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()

      if (!isMountedRef.current) return

      if (data.status === 'ready' || data.status === 'edited' || data.status === 'finalized') {
        setNote(data)
        setStatus(data.status)
        clearTimeout(pollTimerRef.current)
        return
      }

      if (data.status === 'error') {
        setStatus('error')
        setErrorMessage(data.missing_information?.[0] || 'Note generation failed')
        return
      }

      if (data.status === 'generating') {
        setStatus('generating')
        pollCountRef.current++
        if (pollCountRef.current >= MAX_POLL_ATTEMPTS) {
          setStatus('error')
          setErrorMessage('Note generation timed out. Please try regenerating.')
          return
        }
        pollTimerRef.current = setTimeout(fetchNote, POLL_INTERVAL_MS)
        return
      }

      if (data.status === 'not_started') {
        setStatus('generating')
        await fetch(`/api/notes/${sessionId}/generate`, { method: 'POST' })
        pollTimerRef.current = setTimeout(fetchNote, POLL_INTERVAL_MS)
        return
      }

    } catch (err) {
      if (!isMountedRef.current) return
      setStatus('error')
      setErrorMessage(`Failed to load note: ${err.message}`)
    }
  }, [sessionId])

  const refetch = useCallback(() => {
    clearTimeout(pollTimerRef.current)
    pollCountRef.current = 0
    setStatus('loading')
    fetchNote()
  }, [fetchNote])

  useEffect(() => {
    isMountedRef.current = true
    if (sessionId) {
      setStatus('loading')
      fetchNote()
    }
    return () => {
      isMountedRef.current = false
      clearTimeout(pollTimerRef.current)
    }
  }, [sessionId, fetchNote])

  return { note, status, errorMessage, refetch }
}
