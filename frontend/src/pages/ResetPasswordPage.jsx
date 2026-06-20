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
      localStorage.setItem('chartr_token', authToken)
      const doctor = await authApi.me()
      useDoctorStore.getState().setDoctor(doctor)
      window.dispatchEvent(new Event('chartr_auth_change'))
    } catch (err) {
      const msg = err.response?.data?.detail || 'Reset failed. The link may have expired.'
      setError(msg)
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

          {!token ? (
            <>
              <div className={styles.formHeader}>
                <h1 className={styles.formTitle}>Invalid link</h1>
                <p className={styles.formSub}>This reset link is missing or broken. Request a new one.</p>
              </div>
              <button className={styles.btn} onClick={() => navigate('/forgot-password')} type="button">
                Request a new reset link
              </button>
            </>
          ) : (
            <>
              <div className={styles.formHeader}>
                <h1 className={styles.formTitle}>Set a new password</h1>
                <p className={styles.formSub}>Almost there — choose something memorable.</p>
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
                  <p className={styles.hint}>At least 8 characters with one letter and one number.</p>
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
                  {loading ? 'Saving…' : 'Set new password →'}
                </button>
              </form>

              <div className={styles.links}>
                <p className={styles.linkText}>
                  Remembered it?{' '}
                  <button className={styles.link} onClick={() => navigate('/login')} type="button">
                    Sign in instead
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
