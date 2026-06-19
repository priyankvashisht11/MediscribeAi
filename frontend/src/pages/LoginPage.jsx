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
    <div className={styles.page}>

      {/* ── Left: brand panel ── */}
      <div className={styles.left}>
        <div className={styles.leftBrand} onClick={() => navigate('/')}>Chartr</div>

        <div className={styles.leftBody}>
          <h2 className={styles.leftTagline}>
            Every consultation,<br />perfectly documented.
          </h2>

          <div className={styles.leftImgWrap}>
            <img
              src="https://images.pexels.com/photos/12599544/pexels-photo-12599544.jpeg?auto=compress&cs=tinysrgb&w=800"
              alt="Doctor in hospital"
              className={styles.leftImg}
            />
            <div className={styles.leftSOAPCard}>
              <span className={styles.leftSOAPTag}>SOAP · Generated in 24s</span>
              <p className={styles.leftSOAPText}>S: Fever 101.2°F × 3 days, body ache, mild cough</p>
              <p className={styles.leftSOAPText} style={{ opacity: 0.45 }}>A: Viral URTI (J06.9) — symptomatic management...</p>
            </div>
          </div>

          <div className={styles.leftStats}>
            <div className={styles.leftStat}>
              <span>&lt; 30s</span><span>avg. note</span>
            </div>
            <div className={styles.leftStat}>
              <span>3</span><span>documents</span>
            </div>
            <div className={styles.leftStat}>
              <span>Free</span><span>to start</span>
            </div>
          </div>
        </div>

        <div className={styles.leftFooter}>
          <p className={styles.leftQuote}>
            "Chartr saves me 45 minutes every OPD day. The Hindi recognition is surprisingly accurate."
          </p>
          <p className={styles.leftQuoteAuthor}>— Dr. Rajesh Sharma, General Physician · New Delhi</p>
        </div>
      </div>

      {/* ── Right: form panel ── */}
      <div className={styles.right}>
        <div className={`${styles.formBox} ${shake ? styles.shake : ''}`}>

          <div className={styles.formHeader}>
            <h1 className={styles.formTitle}>Welcome back</h1>
            <p className={styles.formSub}>Sign in to your clinic account</p>
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
              <div className={styles.labelRow}>
                <label className={styles.label}>Password</label>
                <button
                  type="button"
                  className={styles.forgotLink}
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
              {loading ? 'Signing in…' : 'Sign in →'}
            </button>
          </form>

          <div className={styles.divider}>or</div>

          <div className={styles.links}>
            <p className={styles.linkText}>
              New here?{' '}
              <button className={styles.link} onClick={() => navigate('/signup')} type="button">
                Create your clinic
              </button>
            </p>
            <p className={styles.linkText}>
              Got an invite?{' '}
              <button className={styles.link} onClick={() => navigate('/join')} type="button">
                Join a clinic
              </button>
            </p>
          </div>

        </div>
      </div>

    </div>
  )
}
