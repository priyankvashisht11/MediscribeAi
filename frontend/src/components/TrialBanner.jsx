import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Zap, X, Clock } from 'lucide-react'
import { useBilling } from '../hooks/useBilling'
import styles from './TrialBanner.module.css'

export default function TrialBanner() {
  const { billing, loading } = useBilling()
  const navigate = useNavigate()
  const [dismissed, setDismissed] = useState(false)

  if (loading || dismissed || !billing) return null

  const { status, days_left_in_trial } = billing

  // Show during last 14 days of trial
  const showTrialWarning = status === 'trialing' && days_left_in_trial !== null && days_left_in_trial <= 14
  // Show when trial has expired (free with no paid sub)
  const showExpired = status === 'free'
  // Show when payment is past due
  const showPastDue = status === 'past_due'

  if (!showTrialWarning && !showExpired && !showPastDue) return null

  const urgent = showExpired || showPastDue || days_left_in_trial <= 3

  return (
    <div className={`${styles.banner} ${urgent ? styles.urgent : styles.warning}`}>
      <div className={styles.inner}>
        <Clock size={14} className={styles.icon} />
        {showExpired && (
          <span className={styles.text}>
            Your free trial has ended. Upgrade to keep your data and continue using Chartr.
          </span>
        )}
        {showPastDue && (
          <span className={styles.text}>
            Your payment failed. Please update your billing to avoid service interruption.
          </span>
        )}
        {showTrialWarning && (
          <span className={styles.text}>
            {days_left_in_trial === 0
              ? 'Your free trial expires today.'
              : `${days_left_in_trial} day${days_left_in_trial === 1 ? '' : 's'} left in your free trial.`}
          </span>
        )}
        <button
          className={styles.upgradeBtn}
          onClick={() => navigate('/pricing')}
        >
          <Zap size={12} />
          Upgrade Now
        </button>
      </div>
      <button
        className={styles.dismissBtn}
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  )
}
