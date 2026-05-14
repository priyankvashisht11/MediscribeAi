import axios from 'axios'
import { useUiStore } from '../stores/uiStore'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use(config => {
  const doctorId = useUiStore.getState().activeDoctorId
  if (doctorId) config.headers['X-Doctor-Id'] = doctorId
  const token = localStorage.getItem('mediscribe_token')
  if (token) config.headers['Authorization'] = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('mediscribe_token')
      window.dispatchEvent(new Event('mediscribe_auth_change'))
    }
    return Promise.reject(err)
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
  analysis: (id) => api.get(`/api/patients/${id}/analysis`).then((r) => r.data),
  flipAll: (sessionId) => api.patch(`/api/sessions/${sessionId}/flip-all-speakers`).then((r) => r.data),
}

export default api
