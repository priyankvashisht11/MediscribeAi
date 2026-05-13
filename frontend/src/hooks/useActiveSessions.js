import { useState, useEffect } from 'react'

const BASE = import.meta.env.VITE_API_URL || ''

export function useActiveSessions(pollMs = 10000) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch(`${BASE}/api/sessions/active`)
        if (res.ok) setSessions(await res.json())
      } catch (_) {}
      finally { setLoading(false) }
    }
    fetch_()
    const id = setInterval(fetch_, pollMs)
    return () => clearInterval(id)
  }, [pollMs])

  return { sessions, loading }
}
