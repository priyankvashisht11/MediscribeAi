import { useState, useEffect, useCallback } from 'react'
import { useDebounce } from './useDebounce'

export function useSessionHistory() {
  const [filters, setFilters] = useState({
    search: '', status: '', doctorId: '',
    dateFrom: '', dateTo: '', page: 1, pageSize: 20,
  })
  const [data, setData] = useState({ items: [], total: 0, total_pages: 1, page: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const debouncedSearch = useDebounce(filters.search, 300)

  const fetchHistory = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams()
      if (debouncedSearch)  p.set('search', debouncedSearch)
      if (filters.status)   p.set('status', filters.status)
      if (filters.doctorId) p.set('doctor_id', filters.doctorId)
      if (filters.dateFrom) p.set('date_from', new Date(filters.dateFrom).toISOString())
      if (filters.dateTo)   p.set('date_to', new Date(filters.dateTo + 'T23:59:59').toISOString())
      p.set('page', filters.page)
      p.set('page_size', filters.pageSize)
      const res = await fetch(`/api/sessions/?${p}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, filters.status, filters.doctorId, filters.dateFrom, filters.dateTo, filters.page, filters.pageSize])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  const updateFilter = (key, value) =>
    setFilters(f => ({ ...f, [key]: value, page: key === 'page' ? value : 1 }))

  return { data, loading, error, filters, updateFilter, refresh: fetchHistory }
}
