import { useNavigate } from 'react-router-dom'
import { useDoctors } from '../context/DoctorsContext'
import styles from './Doctors.module.css'

function initials(name) {
  return name
    .split(' ')
    .filter(w => w.match(/^[A-Z]/))
    .slice(0, 2)
    .map(w => w[0])
    .join('')
}

function DoctorCardSkeleton() {
  return (
    <div className={styles.card}>
      <div className={`skeleton-box ${styles.avatarSkeleton}`} />
      <div className={styles.info}>
        <div className="skeleton-box" style={{ height: 14, width: '70%', marginBottom: 8 }} />
        <div className="skeleton-box" style={{ height: 12, width: '50%' }} />
      </div>
    </div>
  )
}

export default function DoctorsPage() {
  const navigate = useNavigate()
  const { doctors, loading, error, refresh } = useDoctors()

  if (error) {
    return (
      <div className="error-state">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-error)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <p className="error-state-message">Failed to load doctors: {error}</p>
        <button className="btn btn-ghost btn-sm" onClick={refresh}>Try Again</button>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Doctors</h1>
      <div className={styles.grid}>
        {loading
          ? Array.from({ length: 5 }).map((_, i) => <DoctorCardSkeleton key={i} />)
          : doctors.map(d => (
              <div key={d.id} className={styles.card}>
                <div className={styles.avatar}>{initials(d.name)}</div>
                <div className={styles.info}>
                  <p className={styles.name}>{d.name}</p>
                  <span className={styles.specialty}>{d.specialty}</span>
                  <span className={styles.email}>{d.email}</span>
                </div>
                <button
                  className={styles.viewBtn}
                  onClick={() => navigate(`/sessions/history?doctor=${d.id}`)}
                >
                  View Sessions
                </button>
              </div>
            ))
        }
      </div>
    </div>
  )
}
