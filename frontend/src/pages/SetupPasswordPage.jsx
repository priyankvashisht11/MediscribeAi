import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { authApi } from '../services/api'
import { useDoctorStore } from '../stores/doctorStore'
import styles from './Auth.module.css'

export default function SetupPasswordPage({ onSuccess }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const setupToken = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (!setupToken) {
    return (
      <div className={styles.overlay}>
        <div className={styles.card}>
          <div className={styles.logo}>Chartr</div>
          <p className={styles.error}>Invalid or missing setup link.</p>
          <button className={styles.btn} onClick={() => navigate('/login')}>Go to login</button>
        </div>
      </div>
    )
  }

  const submit = async (e) => {
    e.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const { token } = await authApi.setupPassword(setupToken, password)
      localStorage.setItem('chartr_token', token)
      const doctor = await authApi.me()
      useDoctorStore.getState().setDoctor(doctor)
      onSuccess()
    } catch (err) {
      setError(err.response?.data?.detail || 'Setup failed. The link may have expired.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <div>
          <div className={styles.logo}>Chartr</div>
          <p className={styles.sub}>Set your password to activate your account</p>
        </div>

        <form onSubmit={submit} className={styles.form}>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>New password</label>
            <input
              className={styles.input}
              type="password"
              placeholder="Min 8 chars, 1 letter + 1 number"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
              required
              disabled={loading}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Confirm password</label>
            <input
              className={styles.input}
              type="password"
              placeholder="Repeat password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button className={styles.btn} type="submit" disabled={loading || !password || !confirm}>
            {loading ? 'Setting password…' : 'Set password & sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
