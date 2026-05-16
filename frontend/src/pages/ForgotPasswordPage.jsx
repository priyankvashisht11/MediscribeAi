import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../services/api'
import styles from './Auth.module.css'

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await authApi.forgotPassword(email.trim())
      setSent(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className={styles.overlay}>
        <div className={styles.card}>
          <div className={styles.logo}>Chartr</div>
          <div style={{ textAlign: 'center', padding: 'var(--space-4) 0' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-3)' }}>📬</div>
            <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
              Check your email
            </h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', lineHeight: 1.6 }}>
              If <strong>{email}</strong> is registered, we've sent a password reset link.
              It expires in 1 hour.
            </p>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', marginTop: 'var(--space-3)' }}>
              Didn't get it? Check your spam folder or contact your clinic admin.
            </p>
          </div>
          <button
            className={styles.btn}
            style={{ marginTop: 'var(--space-4)' }}
            onClick={() => navigate('/login')}
            type="button"
          >
            Back to sign in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <div>
          <div className={styles.logo}>Chartr</div>
          <p className={styles.sub}>Reset your password</p>
        </div>

        <form onSubmit={submit} className={styles.form}>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Email address</label>
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
            <p className={styles.hint}>
              We'll send a reset link to this address if it's registered.
            </p>
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button
            className={styles.btn}
            type="submit"
            disabled={loading || !email}
          >
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
        </form>

        <div className={styles.links}>
          <p className={styles.linkText}>
            Remember your password?{' '}
            <button className={styles.link} onClick={() => navigate('/login')} type="button">
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
