import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Zap, Building2, Gift } from 'lucide-react'
import { billingApi } from '../services/api'
import { useBilling } from '../hooks/useBilling'
import styles from './PricingPage.module.css'

const PLANS = [
  {
    key: 'free',
    name: 'Starter',
    price: '₹0',
    period: '',
    icon: Gift,
    tagline: 'No card required',
    features: [
      'Up to 10 sessions / month',
      'AI SOAP notes',
      'Patient profiles',
      'Session history',
    ],
    cta: 'Current Plan',
    ctaDisabled: true,
    highlight: false,
  },
  {
    key: 'solo',
    name: 'Solo',
    price: '₹999',
    period: '/month',
    icon: Zap,
    tagline: 'Less than one OPD consultation fee',
    features: [
      'Unlimited sessions',
      'AI SOAP notes + PDF export',
      'Patient profiles & history',
      'Health Intelligence reports',
    ],
    cta: 'Upgrade to Solo',
    ctaDisabled: false,
    highlight: true,
    badge: 'Most Popular',
  },
  {
    key: 'clinic',
    name: 'Clinic',
    price: '₹2,499',
    period: '/month',
    icon: Building2,
    tagline: 'Less than a single specialist consultation',
    features: [
      'Everything in Solo',
      'Up to 5 doctors',
      'Clinic-level analytics',
      'Team management',
    ],
    cta: 'Upgrade to Clinic',
    ctaDisabled: false,
    highlight: false,
  },
]

export default function PricingPage() {
  const navigate = useNavigate()
  const { billing, refresh } = useBilling()
  const [loading, setLoading] = useState(null)
  const [error, setError] = useState(null)

  const currentPlan = billing?.plan ?? 'free'
  const currentStatus = billing?.status ?? 'free'

  async function handleUpgrade(planKey) {
    if (planKey === 'free') return
    setLoading(planKey)
    setError(null)
    try {
      const result = await billingApi.subscribe(planKey)
      if (result.short_url) {
        // Razorpay hosted checkout page
        window.open(result.short_url, '_blank', 'noopener,noreferrer')
      } else if (result.status === 'active' || result.message === 'Subscription already active') {
        // Already active
        await refresh()
        navigate('/')
      }
    } catch (e) {
      const msg = e?.response?.data?.detail || 'Failed to start checkout. Please try again.'
      setError(msg)
    } finally {
      setLoading(null)
    }
  }

  function getPlanCta(plan) {
    if (plan.key === 'free') {
      return currentStatus === 'trialing' ? 'Free trial active' : 'Current plan'
    }
    if (plan.key === currentPlan && (currentStatus === 'active' || currentStatus === 'trialing')) {
      return 'Current Plan'
    }
    return plan.cta
  }

  function isPlanDisabled(plan) {
    if (plan.key === 'free') return true
    if (plan.key === currentPlan && (currentStatus === 'active')) return true
    return false
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Simple, honest pricing</h1>
        <p className={styles.subtitle}>
          Start free. Upgrade when you're ready. No setup fees, no contracts.
        </p>
        {billing?.status === 'trialing' && billing.days_left_in_trial !== null && (
          <div className={styles.trialNotice}>
            You have <strong>{billing.days_left_in_trial} days</strong> left in your free trial.
          </div>
        )}
      </div>

      {error && (
        <div className={styles.errorBox}>{error}</div>
      )}

      <div className={styles.grid}>
        {PLANS.map(plan => {
          const Icon = plan.icon
          const isCurrentPlan = plan.key === currentPlan
          const disabled = isPlanDisabled(plan)
          const ctaLabel = getPlanCta(plan)
          const isLoading = loading === plan.key

          return (
            <div
              key={plan.key}
              className={`${styles.card} ${plan.highlight ? styles.cardHighlight : ''} ${isCurrentPlan ? styles.cardCurrent : ''}`}
            >
              {plan.badge && (
                <div className={styles.badge}>{plan.badge}</div>
              )}

              <div className={styles.cardHeader}>
                <Icon size={20} className={styles.planIcon} />
                <h2 className={styles.planName}>{plan.name}</h2>
                <div className={styles.priceRow}>
                  <span className={styles.price}>{plan.price}</span>
                  {plan.period && <span className={styles.period}>{plan.period}</span>}
                </div>
                <p className={styles.tagline}>{plan.tagline}</p>
              </div>

              <ul className={styles.features}>
                {plan.features.map(f => (
                  <li key={f} className={styles.featureItem}>
                    <Check size={14} className={styles.checkIcon} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <button
                className={`${styles.ctaBtn} ${plan.highlight ? styles.ctaBtnPrimary : styles.ctaBtnSecondary} ${disabled ? styles.ctaBtnDisabled : ''}`}
                disabled={disabled || isLoading}
                onClick={() => handleUpgrade(plan.key)}
              >
                {isLoading ? 'Opening checkout…' : ctaLabel}
              </button>
            </div>
          )
        })}
      </div>

      <div className={styles.footer}>
        <p>All plans include a <strong>30-day free trial</strong> on signup. Cancel anytime.</p>
        <p>Payments via UPI AutoPay or card via Razorpay. Secure & encrypted.</p>
      </div>
    </div>
  )
}
