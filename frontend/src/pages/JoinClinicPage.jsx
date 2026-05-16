import { setToken } from '../utils/storage'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { authApi } from '../services/api'
import { useDoctorStore } from '../stores/doctorStore'
import styles from './Auth.module.css'

export default function JoinClinicPage({ onSuccess }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [form, setForm] = useState({
    invite_code: (searchParams.get('code') || '').toUpperCase(),
    name: '',
    specialty: '',
    email: '',
    password: '',
    confirm_password: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (form.password !== form.confirm_password) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const { token } = await authApi.register(form)
      await setToken(token)
      const doctor = await authApi.me()
      useDoctorStore.getState().setDoctor(doctor)
      onSuccess()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not join clinic. Check your invite code.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <div>
          <div className={styles.logo}>Chartr</div>
          <p className={styles.sub}>Join your clinic with an invite code</p>
        </div>

        <form onSubmit={submit} className={styles.form}>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Invite code</label>
            <input
              className={styles.input}
              type="text"
              placeholder="XXXXXXXX"
              value={form.invite_code}
              onChange={(e) => setForm(f => ({ ...f, invite_code: e.target.value.toUpperCase() }))}
              maxLength={8}
              style={{ textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 600 }}
              required
              disabled={loading}
            />
          </div>

          <div className={styles.row}>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Your name</label>
              <input
                className={styles.input}
                type="text"
                placeholder="Dr. Rajesh Kumar"
                value={form.name}
                onChange={set('name')}
                required
                disabled={loading}
              />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Specialty</label>
              <input
                className={styles.input}
                type="text"
                placeholder="Pediatrics"
                value={form.specialty}
                onChange={set('specialty')}
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Email</label>
            <input
              className={styles.input}
              type="email"
              placeholder="doctor@clinic.com"
              value={form.email}
              onChange={set('email')}
              required
              disabled={loading}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Password</label>
            <input
              className={styles.input}
              type="password"
              placeholder="Min 8 chars, 1 letter + 1 number"
              value={form.password}
              onChange={set('password')}
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
              value={form.confirm_password}
              onChange={set('confirm_password')}
              required
              disabled={loading}
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button
            className={styles.btn}
            type="submit"
            disabled={loading || !form.invite_code || !form.name || !form.email || !form.password}
          >
            {loading ? 'Joining…' : 'Join clinic'}
          </button>
        </form>

        <div className={styles.links}>
          <p className={styles.linkText}>
            Have an account?{' '}
            <button className={styles.link} onClick={() => navigate('/login')} type="button">
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
