import { useUiStore } from '../stores/uiStore'

export function authHeader() {
  const token = localStorage.getItem('mediscribe_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export function apiFetch(url, options = {}) {
  const activeDoctorId = useUiStore.getState().activeDoctorId
  const headers = {
    'Content-Type': 'application/json',
    ...(activeDoctorId ? { 'X-Doctor-Id': activeDoctorId } : {}),
    ...(options.headers ?? {}),
  }
  const token = localStorage.getItem('mediscribe_token')
  if (token) headers['Authorization'] = `Bearer ${token}`
  const base = import.meta.env.VITE_API_URL || ''
  return fetch(`${base}${url}`, { ...options, headers }).then(res => {
    if (res.status === 401) {
      localStorage.removeItem('mediscribe_token')
      window.dispatchEvent(new Event('mediscribe_auth_change'))
    }
    return res
  })
}
