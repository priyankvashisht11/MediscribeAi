import { useUiStore } from '../stores/uiStore'

export function apiFetch(url, options = {}) {
  const activeDoctorId = useUiStore.getState().activeDoctorId
  const headers = {
    'Content-Type': 'application/json',
    ...(activeDoctorId ? { 'X-Doctor-Id': activeDoctorId } : {}),
    ...(options.headers ?? {}),
  }
  const base = import.meta.env.VITE_API_URL || ''
  return fetch(`${base}${url}`, { ...options, headers })
}
