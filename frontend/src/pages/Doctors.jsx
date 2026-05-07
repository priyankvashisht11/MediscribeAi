import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { doctorsApi } from '../services/api'
import styles from './Doctors.module.css'

function initials(name) {
  return name
    .split(' ')
    .filter((w) => w.match(/^[A-Z]/))
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
}

export default function DoctorsPage() {
  const navigate = useNavigate()
  const { data: doctors = [] } = useQuery({ queryKey: ['doctors'], queryFn: doctorsApi.list })

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Doctors</h1>
      <div className={styles.grid}>
        {doctors.map((d) => (
          <div key={d.id} className={styles.card}>
            <div className={styles.avatar}>{initials(d.name)}</div>
            <div className={styles.info}>
              <p className={styles.name}>{d.name}</p>
              <span className={styles.specialty}>{d.specialty}</span>
            </div>
            <button
              className={styles.viewBtn}
              onClick={() => navigate(`/sessions/history?doctor=${d.id}`)}
            >
              View Sessions
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
