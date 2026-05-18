import { useState, useRef } from 'react'
import { FileText, Image, FlaskConical, Pill, Paperclip, Upload, Trash2, Download, AlertCircle } from 'lucide-react'
import { apiFetch } from '../utils/apiFetch'

const DOC_TYPES = [
  { value: 'xray',         label: 'X-Ray' },
  { value: 'lab_report',   label: 'Lab Report' },
  { value: 'scan',         label: 'Scan / MRI / CT' },
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
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function DocumentsPanel({ patientId, onDocumentChange }) {
  const [docs, setDocs] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [uploadForm, setUploadForm] = useState({ doc_type: 'lab_report', description: '' })
  const [uploadFile, setUploadFile] = useState(null)
  const [uploadError, setUploadError] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const fileRef = useRef()

  const load = async () => {
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch(`/api/patients/${patientId}/documents`)
      const data = await res.json()
      setDocs(data.items || [])
    } catch (e) {
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
      setShowUpload(false)
      setUploadFile(null)
      setUploadForm({ doc_type: 'lab_report', description: '' })
      await load()
      onDocumentChange?.()
    } catch (e) {
      setUploadError(e.message)
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (docId) => {
    setDeleting(docId)
    try {
      await apiFetch(`/api/patients/${patientId}/documents/${docId}`, { method: 'DELETE' })
      setDocs(d => d.filter(x => x.id !== docId))
      onDocumentChange?.()
    } catch {
    } finally {
      setDeleting(null)
    }
  }

  const handleDownload = (doc) => {
    const base = import.meta.env.VITE_API_URL || ''
    const token = localStorage.getItem('chartr_token')
    const url = `${base}/api/patients/${patientId}/documents/${doc.id}/download`
    const a = document.createElement('a')
    a.href = url
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    // attach token via fetch → blob URL since API requires auth
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob)
        a.href = blobUrl
        a.download = doc.filename
        a.click()
        URL.revokeObjectURL(blobUrl)
      })
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
                transition: 'all 0.15s',
              }}
            >
              {uploadFile ? (
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-primary)', fontWeight: 500 }}>
                  {uploadFile.name} ({formatBytes(uploadFile.size)})
                </span>
              ) : (
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                  Click to select file (PDF, JPG, PNG — max 10MB)
                </span>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.heic"
              style={{ display: 'none' }}
              onChange={e => setUploadFile(e.target.files?.[0] || null)}
            />
          </div>

          <div style={{ marginBottom: 'var(--space-3)' }}>
            <label style={labelStyle}>
              Description <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>(helps AI analysis)</span>
            </label>
            <textarea
              value={uploadForm.description}
              onChange={e => setUploadForm(f => ({ ...f, description: e.target.value }))}
              placeholder="e.g. CBC report — Hb 9.2, WBC 11.5k. Chest X-ray — mild bilateral infiltrates."
              style={{ ...inputStyle, height: 64, resize: 'vertical' }}
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
              style={{ flex: 1 }}
            >
              {uploading ? 'Uploading…' : 'Upload Document'}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => { setShowUpload(false); setUploadFile(null); setUploadError(null) }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Document list */}
      {loading && (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)',
                    textAlign: 'center', padding: 'var(--space-4)' }}>Loading…</p>
      )}
      {error && (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-error)', padding: 'var(--space-2)' }}>
          {error}
        </p>
      )}
      {docs && docs.length === 0 && !showUpload && (
        <div style={{
          textAlign: 'center', padding: 'var(--space-6)',
          color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)',
          border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-md)',
        }}>
          <Paperclip size={20} style={{ marginBottom: 8, opacity: 0.4 }} />
          <p>No documents yet.</p>
          <p style={{ fontSize: 'var(--text-xs)', marginTop: 4 }}>
            Upload X-rays, lab reports, or scans to include them in AI analysis.
          </p>
        </div>
      )}
      {docs && docs.map(doc => (
        <div key={doc.id} style={{
          display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)',
          padding: 'var(--space-3)', borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)', marginBottom: 'var(--space-2)',
          background: 'var(--color-surface-2)',
        }}>
          {/* Type icon */}
          <div style={{
            width: 32, height: 32, borderRadius: 'var(--radius-sm)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: TYPE_COLOR[doc.doc_type] + '18',
            color: TYPE_COLOR[doc.doc_type], flexShrink: 0,
          }}>
            {TYPE_ICON[doc.doc_type] || <FileText size={14} />}
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                          flexWrap: 'wrap' }}>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500,
                             overflow: 'hidden', textOverflow: 'ellipsis',
                             whiteSpace: 'nowrap', maxWidth: 180 }}>
                {doc.filename}
              </span>
              <span style={{
                fontSize: '10px', padding: '1px 6px',
                borderRadius: 'var(--radius-full)',
                background: TYPE_COLOR[doc.doc_type] + '18',
                color: TYPE_COLOR[doc.doc_type], fontWeight: 600,
              }}>
                {DOC_TYPES.find(t => t.value === doc.doc_type)?.label || doc.doc_type}
              </span>
            </div>
            {doc.description && (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)',
                           marginTop: 2, lineHeight: 1.4 }}>
                {doc.description}
              </p>
            )}
            <p style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: 2 }}>
              {formatDate(doc.uploaded_at)} · {formatBytes(doc.file_size)}
            </p>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 'var(--space-1)', flexShrink: 0 }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => handleDownload(doc)}
              title="View / Download"
              style={{ padding: '4px 6px' }}
            >
              <Download size={13} />
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => handleDelete(doc.id)}
              disabled={deleting === doc.id}
              title="Delete"
              style={{ padding: '4px 6px', color: 'var(--color-error)' }}
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
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
