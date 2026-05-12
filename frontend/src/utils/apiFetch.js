import { useUiStore } from '../stores/uiStore'

export function apiFetch(url, options = {}) {
  const activeDoctorId = useUiStore.getState().activeDoctorId
  const headers = {
    'Content-Type': 'application/json',
    ...(activeDoctorId ? { 'X-Doctor-Id': activeDoctorId } : {}),
    ...(options.headers ?? {}),
  }
  return fetch(url, { ...options, headers })
}
