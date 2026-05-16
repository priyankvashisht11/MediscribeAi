import { setToken } from '../utils/storage'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../services/api'
import { useDoctorStore } from '../stores/doctorStore'
import styles from './Auth.module.css'

export default function SignupPage({ onSuccess }) {
  const navigate = useNavigate()
  const [plan, setPlan] = useState('solo')
  const [form, setForm] = useState({
    clinic_name: '', admin_name: '', admin_specialty: '', admin_email: '', admin_password: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { token } = await authApi.createClinic({ ...form, plan_type: plan })
      await setToken(token)
      const doctor = await authApi.me()
      useDoctorStore.getState().setDoctor(doctor)
      onSuccess()
    } catch (err) {
      setError(err.response?.data?.detail || 'Signup failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <div>
          <div className={styles.logo}>Chartr</div>
          <p className={styles.sub}>Create your clinic account</p>
        </div>

        <form onSubmit={submit} className={styles.form}>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Account type</label>
            <div className={styles.planGrid}>
              <button
                type="button"
                className={`${styles.planCard} ${plan === 'solo' ? styles.planCardActive : ''}`}
                onClick={() => setPlan('solo')}
              >
                <p className={styles.planTitle}>Solo Practice</p>
                <p className={styles.planDesc}>Just you, one doctor</p>
              </button>
              <button
                type="button"
                className={`${styles.planCard} ${plan === 'clinic' ? styles.planCardActive : ''}`}
                onClick={() => setPlan('clinic')}
              >
                <p className={styles.planTitle}>Clinic</p>
                <p className={styles.planDesc}>Multiple doctors</p>
              </button>
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>{plan === 'solo' ? 'Practice name' : 'Clinic name'}</label>
            <input
              className={styles.input}
              type="text"
              placeholder={plan === 'solo' ? "Dr. Sharma's Practice" : 'City Clinic'}
              value={form.clinic_name}
              onChange={set('clinic_name')}
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
                placeholder="Dr. Ananya Sharma"
                value={form.admin_name}
                onChange={set('admin_name')}
                required
                disabled={loading}
              />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Specialty</label>
              <input
                className={styles.input}
                type="text"
                placeholder="General Physician"
                value={form.admin_specialty}
                onChange={set('admin_specialty')}
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
              value={form.admin_email}
              onChange={set('admin_email')}
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
              value={form.admin_password}
              onChange={set('admin_password')}
              required
              disabled={loading}
            />
            <p className={styles.hint}>At least 8 characters with one letter and one number</p>
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button
            className={styles.btn}
            type="submit"
            disabled={loading || !form.clinic_name || !form.admin_name || !form.admin_email || !form.admin_password}
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <div className={styles.links}>
          <p className={styles.linkText}>
            Already have an account?{' '}
            <button className={styles.link} onClick={() => navigate('/login')} type="button">
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
