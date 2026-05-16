import { getToken, removeToken } from './storage'

export async function authHeader() {
  const token = await getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function apiFetch(url, options = {}) {
  const token = await getToken()
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers ?? {}),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const base = import.meta.env.VITE_API_URL || ''
  return fetch(`${base}${url}`, { ...options, headers }).then(async res => {
    if (res.status === 401) {
      await removeToken()
      window.dispatchEvent(new Event('chartr_auth_change'))
    }
    return res
  })
}
