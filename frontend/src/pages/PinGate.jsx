import { setToken } from '../utils/storage'
import { useState } from 'react'
import styles from './PinGate.module.css'

const BASE = import.meta.env.VITE_API_URL || ''

export default function PinGate({ onSuccess }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [shake, setShake] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${BASE}/api/auth/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      if (!res.ok) {
        setShake(true)
        setTimeout(() => setShake(false), 500)
        setError('Incorrect PIN')
        setPin('')
        return
      }
      const { token } = await res.json()
      await setToken(token)
      onSuccess()
    } catch {
      setError('Could not reach server. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.overlay}>
      <div className={`${styles.card} ${shake ? styles.shake : ''}`}>
        <div className={styles.logo}>Chartr</div>
        <p className={styles.sub}>Enter your access PIN to continue</p>
        <form onSubmit={submit} className={styles.form}>
          <input
            className={styles.input}
            type="password"
            inputMode="numeric"
            maxLength={8}
            placeholder="PIN"
            value={pin}
            onChange={e => setPin(e.target.value)}
            autoFocus
            disabled={loading}
          />
          {error && <p className={styles.error}>{error}</p>}
          <button className={styles.btn} type="submit" disabled={loading || !pin}>
            {loading ? 'Checking…' : 'Enter'}
          </button>
        </form>
      </div>
    </div>
  )
}
