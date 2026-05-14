import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, UserPlus, Copy, Check, Trash2, Link } from 'lucide-react'
import api from '../services/api'

async function fetchClinic() {
  return api.get('/api/clinics/me').then(r => r.data)
}
async function fetchDoctors() {
  return api.get('/api/clinics/me/doctors').then(r => r.data)
}
async function generateInvite() {
  return api.post('/api/clinics/me/invites', {}).then(r => r.data)
}
async function deactivateDoctor(doctorId) {
  return api.delete(`/api/clinics/me/doctors/${doctorId}`).then(r => r.data)
}
async function generateSetupLink(doctorId) {
  return api.post(`/api/clinics/me/setup-link/${doctorId}`).then(r => r.data)
}

export default function ClinicAdmin() {
  const qc = useQueryClient()
  const [copiedInvite, setCopiedInvite] = useState(false)
  const [inviteResult, setInviteResult] = useState(null)
  const [updateName, setUpdateName] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [setupLinks, setSetupLinks] = useState({})

  const { data: clinic, isLoading: clinicLoading } = useQuery({
    queryKey: ['clinic'],
    queryFn: fetchClinic,
  })

  const { data: doctors = [], isLoading: doctorsLoading } = useQuery({
    queryKey: ['clinic-doctors'],
    queryFn: fetchDoctors,
  })

  const inviteMutation = useMutation({
    mutationFn: generateInvite,
    onSuccess: (data) => setInviteResult(data),
  })

  const deactivateMutation = useMutation({
    mutationFn: deactivateDoctor,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clinic-doctors'] }),
  })

  const updateNameMutation = useMutation({
    mutationFn: (name) => api.patch('/api/clinics/me', { name }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clinic'] })
      setEditingName(false)
    },
  })

  const copyToClipboard = async (text) => {
    await navigator.clipboard.writeText(text)
    setCopiedInvite(true)
    setTimeout(() => setCopiedInvite(false), 2000)
  }

  const getSetupLink = async (doctorId) => {
    try {
      const data = await generateSetupLink(doctorId)
      setSetupLinks(prev => ({ ...prev, [doctorId]: data.setup_url }))
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not generate setup link')
    }
  }

  if (clinicLoading) return <div style={{ padding: 'var(--space-6)', color: 'var(--color-text-muted)' }}>Loading…</div>

  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: 800, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
        <Building2 size={22} color="var(--color-primary)" />
        <h1 style={{ margin: 0, fontSize: 'var(--text-xl)', fontWeight: 700 }}>Clinic Admin</h1>
      </div>

      {/* Clinic info card */}
      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
          <h2 style={{ margin: 0, fontSize: 'var(--text-base)', fontWeight: 600 }}>Clinic Details</h2>
          <button className="btn btn-ghost btn-sm" onClick={() => { setEditingName(true); setUpdateName(clinic?.name || '') }}>
            Edit name
          </button>
        </div>

        {editingName ? (
          <form
            onSubmit={e => { e.preventDefault(); updateNameMutation.mutate(updateName) }}
            style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}
          >
            <input
              className="input"
              value={updateName}
              onChange={e => setUpdateName(e.target.value)}
              autoFocus
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary btn-sm" type="submit" disabled={updateNameMutation.isPending}>
              {updateNameMutation.isPending ? 'Saving…' : 'Save'}
            </button>
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setEditingName(false)}>
              Cancel
            </button>
          </form>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <p style={{ margin: 0 }}><strong>{clinic?.name}</strong></p>
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
              Plan: {clinic?.plan_type} · {clinic?.doctor_count} active doctor{clinic?.doctor_count !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>

      {/* Invite section */}
      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
          <h2 style={{ margin: 0, fontSize: 'var(--text-base)', fontWeight: 600 }}>Invite a Doctor</h2>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => inviteMutation.mutate()}
            disabled={inviteMutation.isPending}
          >
            <UserPlus size={14} />
            {inviteMutation.isPending ? 'Generating…' : 'Generate invite'}
          </button>
        </div>

        {inviteResult && (
          <div style={{
            background: 'color-mix(in srgb, var(--color-primary) 8%, transparent)',
            border: '1px solid var(--color-primary)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-4)',
          }}>
            <p style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
              Invite code: <span style={{ fontFamily: 'monospace', letterSpacing: '0.1em', fontSize: 'var(--text-base)' }}>{inviteResult.invite_code}</span>
            </p>
            <p style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              Expires: {new Date(inviteResult.expires_at).toLocaleString()}
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
              <code style={{ flex: 1, padding: 'var(--space-2)', background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-xs)', wordBreak: 'break-all' }}>
                {inviteResult.invite_url}
              </code>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => copyToClipboard(inviteResult.invite_url)}
                title="Copy invite URL"
              >
                {copiedInvite ? <Check size={14} color="var(--color-success, #38a169)" /> : <Copy size={14} />}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Doctors list */}
      <div className="card">
        <h2 style={{ margin: '0 0 var(--space-4)', fontSize: 'var(--text-base)', fontWeight: 600 }}>
          Doctors ({doctors.length})
        </h2>

        {doctorsLoading ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Loading…</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {doctors.map(doc => (
              <div
                key={doc.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                  padding: 'var(--space-3)',
                  background: 'var(--color-bg)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  opacity: doc.is_active ? 1 : 0.5,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                    {doc.name}
                    <span style={{
                      marginLeft: 'var(--space-2)',
                      fontSize: 'var(--text-xs)',
                      padding: '2px 6px',
                      background: doc.role === 'admin' ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)' : 'var(--color-border)',
                      color: doc.role === 'admin' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      borderRadius: 'var(--radius-sm)',
                    }}>
                      {doc.role}
                    </span>
                    {!doc.is_active && (
                      <span style={{ marginLeft: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-error, #e53e3e)' }}>
                        deactivated
                      </span>
                    )}
                  </p>
                  <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                    {doc.specialty} · {doc.email}
                  </p>
                  {setupLinks[doc.id] && (
                    <p style={{ margin: 'var(--space-1) 0 0', fontSize: 'var(--text-xs)', wordBreak: 'break-all' }}>
                      <a href={setupLinks[doc.id]} style={{ color: 'var(--color-primary)' }}>{setupLinks[doc.id]}</a>
                    </p>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-2)', flexShrink: 0 }}>
                  {doc.is_active && !doc.hashed_password_set && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => getSetupLink(doc.id)}
                      title="Generate password setup link"
                    >
                      <Link size={13} />
                    </button>
                  )}
                  {doc.is_active && doc.role !== 'admin' && (
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--color-error, #e53e3e)' }}
                      onClick={() => {
                        if (confirm(`Deactivate ${doc.name}? They will no longer be able to sign in.`)) {
                          deactivateMutation.mutate(doc.id)
                        }
                      }}
                      disabled={deactivateMutation.isPending}
                      title="Deactivate doctor"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
