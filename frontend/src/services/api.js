import axios from 'axios'
import { useUiStore } from '../stores/uiStore'

const api = axios.create({
  baseURL: '',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use(config => {
  const doctorId = useUiStore.getState().activeDoctorId
  if (doctorId) config.headers['X-Doctor-Id'] = doctorId
  return config
})

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

export default api
