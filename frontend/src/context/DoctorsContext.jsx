import { createContext, useContext, useState, useEffect } from 'react'

const BASE = import.meta.env.VITE_API_URL || ''

const DoctorsCtx = createContext({ doctors: [], getDoctorName: () => '—', loading: true, error: null, refresh: () => {} })

export function DoctorsProvider({ children }) {
  const [doctors, setDoctors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = () => {
    setLoading(true)
    setError(null)
    fetch(`${BASE}/api/doctors/`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(data => { setDoctors(data); setError(null) })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const getDoctorName = id => doctors.find(d => d.id === id)?.name ?? '—'

  return (
    <DoctorsCtx.Provider value={{ doctors, getDoctorName, loading, error, refresh: load }}>
      {children}
    </DoctorsCtx.Provider>
  )
}

export const useDoctors = () => useContext(DoctorsCtx)
