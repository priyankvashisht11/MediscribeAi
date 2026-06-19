import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || ''

const api = axios.create({
  baseURL: BASE,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,  // send httpOnly refresh cookie on every request
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem('chartr_token')
  if (token) config.headers['Authorization'] = `Bearer ${token}`
  return config
})

let _refreshing = false
let _refreshQueue = []

const _flushQueue = (token, error) => {
  _refreshQueue.forEach(cb => cb(token, error))
  _refreshQueue = []
}

api.interceptors.response.use(
  res => res,
  async err => {
    const original = err.config
    if (err.response?.status !== 401 || original._retried) {
      return Promise.reject(err)
    }
    // Skip refresh for auth endpoints themselves to avoid infinite loops
    if (original.url?.includes('/api/auth/')) {
      localStorage.removeItem('chartr_token')
      window.dispatchEvent(new Event('chartr_auth_change'))
      return Promise.reject(err)
    }

    if (_refreshing) {
      // Queue subsequent 401s while refresh is in flight
      return new Promise((resolve, reject) => {
        _refreshQueue.push((token, error) => {
          if (error) return reject(error)
          original.headers['Authorization'] = `Bearer ${token}`
          resolve(api(original))
        })
      })
    }

    _refreshing = true
    original._retried = true

    try {
      const { data } = await axios.post(
        `${BASE}/api/auth/refresh`,
        {},
        { withCredentials: true }
      )
      const newToken = data.token
      localStorage.setItem('chartr_token', newToken)
      api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`
      original.headers['Authorization'] = `Bearer ${newToken}`
      _flushQueue(newToken, null)
      return api(original)
    } catch {
      _flushQueue(null, err)
      localStorage.removeItem('chartr_token')
      window.dispatchEvent(new Event('chartr_auth_change'))
      return Promise.reject(err)
    } finally {
      _refreshing = false
    }
  }
)

export const doctorsApi = {
  list: () => api.get('/api/doctors/').then((r) => r.data),
  get: (id) => api.get(`/api/doctors/${id}`).then((r) => r.data),
}

export const sessionsApi = {
  list: () => api.get('/api/sessions/').then((r) => r.data),
  get: (id) => api.get(`/api/sessions/${id}`).then((r) => r.data),
  create: (body) => api.post('/api/sessions/', body).then((r) => r.data),
  end: (id) => api.patch(`/api/sessions/${id}/end`).then((r) => r.data),
}

export const notesApi = {
  get: (sessionId) => api.get(`/api/notes/${sessionId}`).then((r) => r.data),
  finalize: (noteId) => api.patch(`/api/notes/${noteId}/finalize`).then((r) => r.data),
}

export const patientsApi = {
  list: (params) => api.get('/api/patients/', { params }).then((r) => r.data),
  get: (id) => api.get(`/api/patients/${id}`).then((r) => r.data),
  update: (id, body) => api.patch(`/api/patients/${id}`, body).then((r) => r.data),
  sessions: (id) => api.get(`/api/patients/${id}/sessions`).then((r) => r.data),
  analysis: (id, force = false) => api.get(`/api/patients/${id}/analysis`, { params: force ? { force: 'true' } : {} }).then((r) => r.data),
  flipAll: (sessionId) => api.patch(`/api/sessions/${sessionId}/flip-all-speakers`).then((r) => r.data),
}

export const authApi = {
  login: (email, password) =>
    api.post('/api/auth/login', { email, password }).then((r) => r.data),
  me: () => api.get('/api/auth/me').then((r) => r.data),
  register: (body) => api.post('/api/auth/register', body).then((r) => r.data),
  setupPassword: (setupToken, newPassword) =>
    api.post('/api/auth/setup-password', { setup_token: setupToken, new_password: newPassword }).then((r) => r.data),
  createClinic: (body) => api.post('/api/clinics/', body).then((r) => r.data),
  forgotPassword: (email) =>
    api.post('/api/auth/forgot-password', { email }).then((r) => r.data),
  resetPassword: (resetToken, newPassword) =>
    api.post('/api/auth/reset-password', { reset_token: resetToken, new_password: newPassword }).then((r) => r.data),
  logout: () =>
    api.post('/api/auth/logout').catch(() => {}),  // best-effort cookie clear
}

export const billingApi = {
  status: () => api.get('/api/billing/status').then((r) => r.data),
  subscribe: (plan) => api.post('/api/billing/subscribe', { plan }).then((r) => r.data),
  cancel: () => api.post('/api/billing/cancel').then((r) => r.data),
}

export default api
