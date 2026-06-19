import { useState, useEffect, useCallback } from 'react'
import { billingApi } from '../services/api'

export function useBilling() {
  const [billing, setBilling] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    try {
      const data = await billingApi.status()
      setBilling(data)
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { billing, loading, error, refresh }
}
