import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export function useKeyboardShortcuts() {
  const navigate = useNavigate()

  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return

      switch (e.key) {
        case 'n':
        case 'N':
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault()
            navigate('/sessions/new')
          }
          break
        case 'h':
        case 'H':
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault()
            navigate('/sessions/history')
          }
          break
        case 'd':
        case 'D':
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault()
            navigate('/')
          }
          break
        case 'Escape':
          window.dispatchEvent(new CustomEvent('mediscribe:escape'))
          break
        case '?':
          window.dispatchEvent(new CustomEvent('mediscribe:show-shortcuts'))
          break
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate])
}
