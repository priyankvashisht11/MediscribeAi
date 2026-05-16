import { setToken } from '../utils/storage'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { authApi } from '../services/api'
import { useDoctorStore } from '../stores/doctorStore'
import styles from './Auth.module.css'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!token) {
    return (
      <div className={styles.overlay}>
        <div className={styles.card}>
          <div className={styles.logo}>MediScribe</div>
          <p className={styles.error} style={{ textAlign: 'center' }}>
            Invalid reset link. Please request a new one.
          </p>
          <button className={styles.btn} onClick={() => navigate('/forgot-password')} type="button">
            Request reset link
          </button>
        </div>
      </div>
    )
  }

  const submit = async (e) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    setError('')
    try {
      const { token: authToken } = await authApi.resetPassword(token, newPassword)
      await setToken(authToken)
      const doctor = await authApi.me()
      useDoctorStore.getState().setDoctor(doctor)
      window.dispatchEvent(new Event('mediscribe_auth_change'))
    } catch (err) {
      const msg = err.response?.data?.detail || 'Reset failed. The link may have expired.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <div>
          <div className={styles.logo}>MediScribe</div>
          <p className={styles.sub}>Set a new password</p>
        </div>

        <form onSubmit={submit} className={styles.form}>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>New password</label>
            <input
              className={styles.input}
              type="password"
              placeholder="Min 8 chars, 1 letter + 1 number"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              autoFocus
              required
              disabled={loading}
            />
            <p className={styles.hint}>At least 8 characters with one letter and one number</p>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Confirm new password</label>
            <input
              className={styles.input}
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button
            className={styles.btn}
            type="submit"
            disabled={loading || !newPassword || !confirmPassword}
          >
            {loading ? 'Saving…' : 'Set new password'}
          </button>
        </form>
      </div>
    </div>
  )
}
