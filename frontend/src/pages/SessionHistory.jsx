import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { sessionsApi, doctorsApi } from '../services/api'
import { Eye, ClipboardList } from 'lucide-react'
import styles from './SessionHistory.module.css'

function StatusChip({ status }) {
  return (
    <span className={`${styles.chip} ${styles[`chip_${status}`]}`}>
      {status}
    </span>
  )
}

export default function SessionHistory({ filter }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const { data: sessions = [] } = useQuery({ queryKey: ['sessions'], queryFn: sessionsApi.list })
  const { data: doctors = [] } = useQuery({ queryKey: ['doctors'], queryFn: doctorsApi.list })

  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [doctorFilter, setDoctorFilter] = useState(searchParams.get('doctor') || '')
  const [statusFilter, setStatusFilter] = useState(filter === 'active' ? 'recording' : '')
  const [search, setSearch] = useState('')

  const filtered = sessions.filter((s) => {
    if (statusFilter && s.status !== statusFilter) return false
    if (doctorFilter && s.doctor_id !== doctorFilter) return false
    if (search && !s.patient_name?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>
        {filter === 'active' ? 'Active Sessions' : 'Session History'}
      </h1>

      {/* Filters */}
      <div className={styles.filters}>
        <input
          className={styles.input}
          type="text"
          placeholder="Search patient…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <input
          className={styles.input}
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          aria-label="From date"
        />
        <input
          className={styles.input}
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          aria-label="To date"
        />
        <select
          className={styles.input}
          value={doctorFilter}
          onChange={(e) => setDoctorFilter(e.target.value)}
        >
          <option value="">All Doctors</option>
          {doctors.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <select
          className={styles.input}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="recording">Recording</option>
          <option value="completed">Completed</option>
          <option value="idle">Idle</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className={styles.empty}>
          <ClipboardList size={40} strokeWidth={1} />
          <p>No sessions found</p>
          <button className={styles.newBtn} onClick={() => navigate('/sessions/new')}>
            Start your first session
          </button>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date / Time</th>
                <th>Doctor</th>
                <th>Patient</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const doc = doctors.find((d) => d.id === s.doctor_id)
                return (
                  <tr key={s.id}>
                    <td>{new Date(s.created_at).toLocaleString()}</td>
                    <td>{doc?.name ?? '—'}</td>
                    <td>{s.patient_name ?? '—'}</td>
                    <td><StatusChip status={s.status} /></td>
                    <td>
                      <button
                        className={styles.viewBtn}
                        onClick={() => navigate(`/sessions/${s.id}/review`)}
                      >
                        <Eye size={13} /> View Note
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
