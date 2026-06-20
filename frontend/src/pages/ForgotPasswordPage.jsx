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
        <div className={styles.formBox}>

          {sent ? (
            <>
              <div className={styles.formHeader}>
                <div style={{ fontSize: '32px', marginBottom: '4px' }}>📬</div>
                <h1 className={styles.formTitle}>Check your email</h1>
                <p className={styles.formSub}>
                  We sent a reset link to <strong style={{ color: '#0a0a0a' }}>{email}</strong>.
                  It expires in 1 hour.
                </p>
              </div>

              <p className={styles.hint} style={{ textAlign: 'center' }}>
                Didn't get it? Check your spam folder, or contact your clinic admin.
              </p>

              <button className={styles.btn} onClick={() => navigate('/login')} type="button">
                Back to sign in
              </button>

              <div className={styles.links}>
                <p className={styles.linkText}>
                  Wrong email?{' '}
                  <button className={styles.link} onClick={() => { setSent(false); setEmail('') }} type="button">
                    Try again
                  </button>
                </p>
              </div>
            </>
          ) : (
            <>
              <div className={styles.formHeader}>
                <h1 className={styles.formTitle}>Forgot password?</h1>
                <p className={styles.formSub}>Enter your email and we'll send a reset link.</p>
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
                  <p className={styles.hint}>We'll only send a link if this email is registered.</p>
                </div>

                {error && <p className={styles.error}>{error}</p>}

                <button className={styles.btn} type="submit" disabled={loading || !email}>
                  {loading ? 'Sending…' : 'Send reset link →'}
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
            </>
          )}

        </div>
      </div>

    </div>
  )
}
