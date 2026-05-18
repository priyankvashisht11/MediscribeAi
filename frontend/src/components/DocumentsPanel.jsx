import { useState, useRef } from 'react'
import {
  FileText, Image, FlaskConical, Pill, Paperclip,
  Upload, Trash2, Download, AlertCircle, Sparkles, Pencil, Check, X,
} from 'lucide-react'
import { apiFetch } from '../utils/apiFetch'

const DOC_TYPES = [
  { value: 'xray',         label: 'X-Ray / Radiograph' },
  { value: 'lab_report',   label: 'Lab Report' },
  { value: 'scan',         label: 'Scan (MRI / CT / USG)' },
  { value: 'prescription', label: 'Outside Prescription' },
  { value: 'other',        label: 'Other' },
]

const TYPE_ICON = {
  xray:         <Image size={14} />,
  lab_report:   <FlaskConical size={14} />,
  scan:         <Image size={14} />,
  prescription: <Pill size={14} />,
  other:        <FileText size={14} />,
}

const TYPE_COLOR = {
  xray:         '#6366f1',
  lab_report:   '#0891b2',
  scan:         '#7c3aed',
  prescription: '#059669',
  other:        '#64748b',
}

function formatBytes(bytes) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function DocCard({ doc, patientId, onDelete, onUpdate }) {
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(doc.description || '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const color = TYPE_COLOR[doc.doc_type] || '#64748b'

  const handleSaveEdit = async () => {
    setSaving(true)
    try {
      const res = await apiFetch(`/api/patients/${patientId}/documents/${doc.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ description: editText }),
      })
      const updated = await res.json()
      onUpdate(updated)
      setEditing(false)
    } catch {
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await apiFetch(`/api/patients/${patientId}/documents/${doc.id}`, { method: 'DELETE' })
      onDelete(doc.id)
    } catch {
      setDeleting(false)
    }
  }

  const handleDownload = () => {
    const base = import.meta.env.VITE_API_URL || ''
    const token = localStorage.getItem('chartr_token')
    fetch(`${base}/api/patients/${patientId}/documents/${doc.id}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = doc.filename
        a.click()
        URL.revokeObjectURL(url)
      })
  }

  return (
    <div style={{
      borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)',
      marginBottom: 'var(--space-2)', background: 'var(--color-surface-2)',
      overflow: 'hidden',
    }}>
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                    padding: 'var(--space-3)' }}>
        {/* Type icon */}
        <div style={{
          width: 32, height: 32, borderRadius: 'var(--radius-sm)', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: color + '18', color,
        }}>
          {TYPE_ICON[doc.doc_type] || <FileText size={14} />}
        </div>

        {/* Filename + meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 'var(--text-sm)', fontWeight: 500,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              maxWidth: 180,
            }}>
              {doc.filename}
            </span>
            <span style={{
              fontSize: '10px', padding: '1px 6px', borderRadius: 'var(--radius-full)',
              background: color + '18', color, fontWeight: 600,
            }}>
              {DOC_TYPES.find(t => t.value === doc.doc_type)?.label || doc.doc_type}
            </span>
            {doc.ai_analyzed && (
              <span style={{
                fontSize: '10px', padding: '1px 6px', borderRadius: 'var(--radius-full)',
                background: '#f0f9ff', color: '#0369a1', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 3,
              }}>
                <Sparkles size={9} /> AI
              </span>
            )}
          </div>
          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
            {formatDate(doc.uploaded_at)} · {formatBytes(doc.file_size)}
          </span>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => { setEditing(!editing); setEditText(doc.description || '') }}
            title="Edit description"
            style={{ padding: '4px 6px', color: editing ? 'var(--color-primary)' : undefined }}
          >
            <Pencil size={12} />
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleDownload}
            title="Download"
            style={{ padding: '4px 6px' }}
          >
            <Download size={12} />
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleDelete}
            disabled={deleting}
            title="Delete"
            style={{ padding: '4px 6px', color: 'var(--color-error)' }}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Description row */}
      {(doc.description || editing) && (
        <div style={{
          borderTop: '1px solid var(--color-border)',
          padding: 'var(--space-2) var(--space-3)',
          background: doc.ai_analyzed && !editing ? '#f8fafc' : undefined,
        }}>
          {editing ? (
            <div>
              <textarea
                value={editText}
                onChange={e => setEditText(e.target.value)}
                placeholder="Describe the clinical findings…"
                style={{
                  width: '100%', fontSize: 'var(--text-xs)', resize: 'vertical',
                  border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
                  padding: 'var(--space-2)', background: 'var(--color-surface)',
                  color: 'var(--color-text)', boxSizing: 'border-box', height: 72,
                }}
              />
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleSaveEdit}
                  disabled={saving}
                  style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <Check size={11} /> {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setEditing(false)}
                  style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <X size={11} /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <p style={{
              fontSize: 'var(--text-xs)', color: 'var(--color-text)', lineHeight: 1.5,
              margin: 0,
            }}>
              {doc.ai_analyzed && (
                <span style={{ color: '#0369a1', fontWeight: 600, marginRight: 4 }}>AI:</span>
              )}
              {doc.description}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default function DocumentsPanel({ patientId, onDocumentChange }) {
  const [docs, setDocs] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadStage, setUploadStage] = useState(null) // null | 'uploading' | 'analyzing'
  const [showUpload, setShowUpload] = useState(false)
  const [uploadForm, setUploadForm] = useState({ doc_type: 'lab_report', description: '' })
  const [uploadFile, setUploadFile] = useState(null)
  const [uploadError, setUploadError] = useState(null)
  const fileRef = useRef()

  const load = async () => {
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch(`/api/patients/${patientId}/documents`)
      const data = await res.json()
      setDocs(data.items || [])
    } catch {
      setError('Failed to load documents')
    } finally {
      setLoading(false)
    }
  }

  if (docs === null && !loading && !error) load()

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!uploadFile) return
    setUploading(true)
    setUploadError(null)

    const isImage = uploadFile.type.startsWith('image/')
    const isPdf = uploadFile.type === 'application/pdf' || uploadFile.name.endsWith('.pdf')
    const willAnalyze = (isImage || isPdf) && !uploadForm.description.trim()
    setUploadStage(willAnalyze ? 'analyzing' : 'uploading')

    try {
      const form = new FormData()
      form.append('file', uploadFile)
      form.append('doc_type', uploadForm.doc_type)
      form.append('description', uploadForm.description)

      const res = await apiFetch(`/api/patients/${patientId}/documents`, {
        method: 'POST',
        headers: {},
        body: form,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || 'Upload failed')
      }
      const newDoc = await res.json()
      setDocs(d => [newDoc, ...(d || [])])
      setShowUpload(false)
      setUploadFile(null)
      setUploadForm({ doc_type: 'lab_report', description: '' })
      onDocumentChange?.()
    } catch (e) {
      setUploadError(e.message)
    } finally {
      setUploading(false)
      setUploadStage(null)
    }
  }

  const handleDelete = (docId) => {
    setDocs(d => d.filter(x => x.id !== docId))
    onDocumentChange?.()
  }

  const handleUpdate = (updated) => {
    setDocs(d => d.map(x => x.id === updated.id ? updated : x))
  }

  return (
    <div style={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Paperclip size={15} color="var(--color-text-muted)" />
          <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 600 }}>Documents</h2>
          {docs && docs.length > 0 && (
            <span style={{
              fontSize: 'var(--text-xs)', background: 'var(--color-primary-light)',
              color: 'var(--color-primary)', borderRadius: 'var(--radius-full)',
              padding: '0 6px', fontWeight: 600,
            }}>{docs.length}</span>
          )}
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => { setShowUpload(true); setUploadError(null) }}
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)',
                   fontSize: 'var(--text-xs)' }}
        >
          <Upload size={12} /> Upload
        </button>
      </div>

      {/* Upload form */}
      {showUpload && (
        <form onSubmit={handleUpload} style={{
          background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)',
          padding: 'var(--space-4)', marginBottom: 'var(--space-4)',
          border: '1px solid var(--color-border)',
        }}>
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <label style={labelStyle}>Document Type</label>
            <select
              value={uploadForm.doc_type}
              onChange={e => setUploadForm(f => ({ ...f, doc_type: e.target.value }))}
              style={inputStyle}
            >
              {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 'var(--space-3)' }}>
            <label style={labelStyle}>File</label>
            <div
              onClick={() => fileRef.current?.click()}
              style={{
                border: `2px dashed ${uploadFile ? 'var(--color-primary)' : 'var(--color-border)'}`,
                borderRadius: 'var(--radius-md)', padding: 'var(--space-4)',
                textAlign: 'center', cursor: 'pointer',
                background: uploadFile ? 'var(--color-primary-light)' : 'transparent',
              }}
            >
              {uploadFile ? (
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-primary)', fontWeight: 500 }}>
                  {uploadFile.name} ({formatBytes(uploadFile.size)})
                </span>
              ) : (
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                  Click to select — PDF, JPG, PNG (max 10MB)
                </span>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.heic"
              style={{ display: 'none' }}
              onChange={e => setUploadFile(e.target.files?.[0] || null)}
            />
          </div>

          {/* AI analysis notice */}
          {uploadFile && !uploadForm.description.trim() && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: '#f0f9ff', borderRadius: 'var(--radius-sm)',
              padding: 'var(--space-2) var(--space-3)', marginBottom: 'var(--space-3)',
              border: '1px solid #bae6fd',
            }}>
              <Sparkles size={12} style={{ color: '#0369a1', flexShrink: 0 }} />
              <span style={{ fontSize: 'var(--text-xs)', color: '#0369a1' }}>
                AI will analyze this file automatically. You can add your own notes below to override.
              </span>
            </div>
          )}

          <div style={{ marginBottom: 'var(--space-3)' }}>
            <label style={labelStyle}>
              Your notes{' '}
              <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>(optional — AI auto-fills if blank)</span>
            </label>
            <textarea
              value={uploadForm.description}
              onChange={e => setUploadForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Add your own observations, or leave blank for AI analysis…"
              style={{ ...inputStyle, height: 56, resize: 'vertical' }}
            />
          </div>

          {uploadError && (
            <p style={{ color: 'var(--color-error)', fontSize: 'var(--text-xs)',
                         marginBottom: 'var(--space-2)', display: 'flex',
                         alignItems: 'center', gap: 4 }}>
              <AlertCircle size={12} /> {uploadError}
            </p>
          )}

          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={uploading || !uploadFile}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              {uploadStage === 'analyzing' ? (
                <><Sparkles size={12} className="spin" /> AI Analyzing…</>
              ) : uploading ? (
                'Uploading…'
              ) : (
                <><Upload size={12} /> Upload</>
              )}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => { setShowUpload(false); setUploadFile(null); setUploadError(null) }}
              disabled={uploading}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* List */}
      {loading && (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)',
                    textAlign: 'center', padding: 'var(--space-4)' }}>Loading…</p>
      )}
      {error && (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-error)', padding: 'var(--space-2)' }}>{error}</p>
      )}
      {docs && docs.length === 0 && !showUpload && (
        <div style={{
          textAlign: 'center', padding: 'var(--space-6)',
          color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)',
          border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-md)',
        }}>
          <Paperclip size={20} style={{ marginBottom: 8, opacity: 0.4 }} />
          <p style={{ margin: 0 }}>No documents yet.</p>
          <p style={{ fontSize: 'var(--text-xs)', marginTop: 4, margin: '4px 0 0' }}>
            Upload X-rays, lab reports, or scans — AI will analyze them automatically.
          </p>
        </div>
      )}
      {docs && docs.map(doc => (
        <DocCard
          key={doc.id}
          doc={doc}
          patientId={patientId}
          onDelete={handleDelete}
          onUpdate={handleUpdate}
        />
      ))}
    </div>
  )
}

const labelStyle = {
  display: 'block',
  fontSize: 'var(--text-xs)',
  fontWeight: 600,
  color: 'var(--color-text-muted)',
  marginBottom: 'var(--space-1)',
}

const inputStyle = {
  width: '100%',
  padding: 'var(--space-2)',
  fontSize: 'var(--text-sm)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--color-surface)',
  color: 'var(--color-text)',
  boxSizing: 'border-box',
}
