import { useNavigate } from 'react-router-dom'
import { useDoctors } from '../context/DoctorsContext'
import { ArrowRight, Stethoscope } from 'lucide-react'
import styles from './Doctors.module.css'

function avatarGradient() {
  return 'linear-gradient(135deg, #01696f 0%, #1a8f95 100%)'
}

function initials(name) {
  const cleaned = name.replace(/^(dr\.?\s+|prof\.?\s+)/i, '').trim()
  const parts = cleaned.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return cleaned.slice(0, 2).toUpperCase()
}

function DoctorCardSkeleton() {
  return (
    <div className={styles.card}>
      <div className={`skeleton-box ${styles.avatarSkeleton}`} />
      <div className={styles.info}>
        <div className="skeleton-box" style={{ height: 14, width: '70%', marginBottom: 8 }} />
        <div className="skeleton-box" style={{ height: 11, width: '45%', marginBottom: 6 }} />
        <div className="skeleton-box" style={{ height: 11, width: '60%' }} />
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
        <Stethoscope size={24} style={{ color: 'var(--color-error)' }} />
        <p className="error-state-message">Failed to load doctors: {error}</p>
        <button className="btn btn-ghost btn-sm" onClick={refresh}>Try Again</button>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Doctors</h1>
        {!loading && doctors.length > 0 && (
          <span className={styles.countBadge}>{doctors.length}</span>
        )}
      </div>

      <div className={styles.grid}>
        {loading
          ? Array.from({ length: 5 }).map((_, i) => <DoctorCardSkeleton key={i} />)
          : doctors.map(d => (
              <div key={d.id} className={styles.card}>
                <div className={styles.cardTop}>
                  <div
                    className={styles.avatar}
                    style={{ background: avatarGradient(d.name) }}
                  >
                    {initials(d.name)}
                  </div>
                </div>
                <div className={styles.info}>
                  <p className={styles.name}>{d.name}</p>
                  {d.specialty && <span className={styles.specialty}>{d.specialty}</span>}
                  {d.email && <span className={styles.email}>{d.email}</span>}
                </div>
                <button
                  className={styles.viewBtn}
                  onClick={() => navigate(`/sessions/history?doctor=${d.id}`)}
                >
                  View Sessions <ArrowRight size={12} />
                </button>
              </div>
            ))
        }
      </div>
    </div>
  )
}
