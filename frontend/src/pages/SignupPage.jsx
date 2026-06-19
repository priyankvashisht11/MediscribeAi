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
      localStorage.setItem('chartr_token', token)
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
    <div className={styles.page}>

      {/* ── Left: brand panel ── */}
      <div className={styles.left}>
        <div className={styles.leftBrand} onClick={() => navigate('/')}>Chartr</div>

        <div className={styles.leftBody}>
          <h2 className={styles.leftTagline}>
            Your clinic's AI scribe,<br />ready in 5 minutes.
          </h2>

          <div className={styles.leftImgWrap}>
            <img
              src="https://images.pexels.com/photos/7722917/pexels-photo-7722917.jpeg?auto=compress&cs=tinysrgb&w=800"
              alt="Doctor consulting with patient in modern office"
              className={styles.leftImg}
            />
            <div className={styles.leftSOAPCard}>
              <span className={styles.leftSOAPTag}>Setup · No credit card required</span>
              <p className={styles.leftSOAPText}>Hindi + English · SOAP notes · Prescription PDFs</p>
              <p className={styles.leftSOAPText} style={{ opacity: 0.45 }}>Branded with your clinic details...</p>
            </div>
          </div>

          <div className={styles.leftStats}>
            <div className={styles.leftStat}>
              <span>5 min</span><span>to set up</span>
            </div>
            <div className={styles.leftStat}>
              <span>Free</span><span>forever</span>
            </div>
            <div className={styles.leftStat}>
              <span>ICD-10</span><span>auto-coded</span>
            </div>
          </div>
        </div>

        <div className={styles.leftFooter}>
          <p className={styles.leftQuote}>
            "The prescription PDF with my clinic letterhead looks more professional than what I had before."
          </p>
          <p className={styles.leftQuoteAuthor}>— Dr. Arun Krishnamurthy, Cardiologist · Bangalore</p>
        </div>
      </div>

      {/* ── Right: form panel ── */}
      <div className={styles.right}>
        <div className={styles.formBox}>

          <div className={styles.formHeader}>
            <h1 className={styles.formTitle}>Create your clinic</h1>
            <p className={styles.formSub}>Get started free — no card needed</p>
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
              {loading ? 'Creating account…' : 'Create clinic →'}
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

    </div>
  )
}
