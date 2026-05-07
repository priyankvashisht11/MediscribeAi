import { useNavigate } from 'react-router-dom'
import styles from './NotFound.module.css'

export default function NotFound() {
  const navigate = useNavigate()
  return (
    <div className={styles.page}>
      <span className={styles.code}>404</span>
      <h1 className={styles.title}>Page not found</h1>
      <p className={styles.desc}>The page you're looking for doesn't exist.</p>
      <button className={styles.btn} onClick={() => navigate('/')}>Go to Dashboard</button>
    </div>
  )
}
