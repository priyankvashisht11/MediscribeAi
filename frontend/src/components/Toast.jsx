import { useEffect } from 'react'
import { X } from 'lucide-react'
import { useUiStore } from '../stores/uiStore'
import styles from './Toast.module.css'

function ToastItem({ toast }) {
  const removeToast = useUiStore((s) => s.removeToast)

  useEffect(() => {
    const timer = setTimeout(() => removeToast(toast.id), 4000)
    return () => clearTimeout(timer)
  }, [toast.id, removeToast])

  return (
    <div className={`${styles.toast} ${styles[toast.type || 'info']}`} role="alert">
      <span className={styles.message}>{toast.message}</span>
      <button
        className={styles.close}
        onClick={() => removeToast(toast.id)}
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  )
}

export default function ToastContainer() {
  const toasts = useUiStore((s) => s.toasts)

  return (
    <div className={styles.container} aria-live="polite">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  )
}
