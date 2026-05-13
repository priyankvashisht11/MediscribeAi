import { useState, useEffect, useCallback, useRef } from 'react'

const BASE = import.meta.env.VITE_API_URL || ''

export function useDashboardStats(doctorId = null) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const hasAnimated = useRef(false)

  const fetch_ = useCallback(async () => {
    try {
      const params = doctorId ? `?doctor_id=${doctorId}` : ''
      const res = await fetch(`${BASE}/api/sessions/stats/summary${params}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setStats(data)
      setError(null)
      hasAnimated.current = true
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [doctorId])

  useEffect(() => {
    fetch_()
    const id = setInterval(fetch_, 30000)
    return () => clearInterval(id)
  }, [fetch_])

  return { stats, loading, error, hasAnimated, refresh: fetch_ }
}
