import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../services/api'
import { useDoctorStore } from '../stores/doctorStore'
import styles from './Auth.module.css'

export default function LoginPage({ onSuccess }) {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [shake, setShake] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { token } = await authApi.login(email.trim(), password)
      localStorage.setItem('chartr_token', token)
      // Hydrate doctor store immediately
      const doctor = await authApi.me()
      useDoctorStore.getState().setDoctor(doctor)
      onSuccess()
    } catch (err) {
      const msg = err.response?.data?.detail || 'Could not sign in. Check your credentials.'
      setError(msg)
      setShake(true)
      setTimeout(() => setShake(false), 500)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.overlay}>
      <div className={`${styles.card} ${shake ? styles.shake : ''}`}>
        <div>
          <div className={styles.logo}>Chartr</div>
          <p className={styles.sub}>Sign in to your account</p>
        </div>

        <form onSubmit={submit} className={styles.form}>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Email</label>
            <input
              className={styles.input}
              type="email"
              placeholder="doctor@clinic.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoFocus
              required
              disabled={loading}
            />
          </div>

          <div className={styles.fieldGroup}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <label className={styles.label}>Password</label>
              <button
                type="button"
                className={styles.link}
                style={{ fontSize: 'var(--text-xs)' }}
                onClick={() => navigate('/forgot-password')}
              >
                Forgot password?
              </button>
            </div>
            <input
              className={styles.input}
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button className={styles.btn} type="submit" disabled={loading || !email || !password}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className={styles.divider}>or</div>

        <div className={styles.links}>
          <p className={styles.linkText}>
            New here?{' '}
            <button className={styles.link} onClick={() => navigate('/signup')} type="button">
              Create account
            </button>
          </p>
          <p className={styles.linkText}>
            Got an invite?{' '}
            <button className={styles.link} onClick={() => navigate('/join')} type="button">
              Join clinic
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
