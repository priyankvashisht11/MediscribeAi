import { useState } from 'react'
import { patientsApi } from '../services/api'
import { Brain, RefreshCw, AlertTriangle, TrendingUp, TrendingDown, Minus, FileText, Sparkles } from 'lucide-react'

function TrendIcon({ trend }) {
  if (trend === 'improving') return <TrendingUp size={14} style={{ color: 'var(--color-success)' }} />
  if (trend === 'worsening') return <TrendingDown size={14} style={{ color: 'var(--color-error)' }} />
  return <Minus size={14} style={{ color: 'var(--color-text-muted)' }} />
}

function ConfidenceBadge({ level }) {
  const colors = {
    high:   { bg: 'var(--color-success-light)', text: 'var(--color-success)' },
    medium: { bg: 'var(--color-warning-light)', text: 'var(--color-warning)' },
    low:    { bg: 'var(--color-error-light)',   text: 'var(--color-error)' },
  }
  const c = colors[level] || colors.low
  return (
    <span style={{
      fontSize: 'var(--text-xs)', fontWeight: 600, padding: '2px 8px',
      borderRadius: 'var(--radius-sm)', background: c.bg, color: c.text,
    }}>
      {level?.toUpperCase() || 'LOW'} CONFIDENCE
    </span>
  )
}

function Section({ title, items, emptyText }) {
  if (!items || items.length === 0) {
    return (
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-muted)',
                    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-1)' }}>
          {title}
        </p>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-faint)', fontStyle: 'italic' }}>
          {emptyText || 'None identified'}
        </p>
      </div>
    )
  }
  return (
    <div style={{ marginBottom: 'var(--space-4)' }}>
      <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-2)' }}>
        {title}
      </p>
      <ul style={{ margin: 0, paddingLeft: 'var(--space-4)' }}>
        {items.map((item, i) => (
          <li key={i} style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text)',
                               marginBottom: 'var(--space-1)', lineHeight: 1.5 }}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function HealthAnalysisPanel({ patientId, visitCount, newDocumentFlag }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [triggered, setTriggered] = useState(false)

  const load = async (force = false) => {
    setLoading(true)
    setError(null)
    setTriggered(true)
    try {
      const url = force ? `${patientId}?force=true` : patientId
      const result = await patientsApi.analysis(url)
      setData(result)
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }

  const hasNewDocs = data?.new_documents_since_analysis || newDocumentFlag

  if (visitCount === 0) {
    return (
      <div style={panelStyle}>
        <PanelHeader />
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
          No visits yet. Complete at least one session to generate a health analysis.
        </p>
      </div>
    )
  }

  if (!triggered) {
    return (
      <div style={panelStyle}>
        <PanelHeader />
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)',
                    marginBottom: 'var(--space-4)' }}>
          AI-powered longitudinal analysis across all {visitCount} finalized visit{visitCount !== 1 ? 's' : ''}.
        </p>
        <button className="btn btn-primary btn-sm" onClick={() => load()}
                style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Brain size={13} /> Generate Analysis
        </button>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={panelStyle}>
        <PanelHeader />
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                      color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
          <RefreshCw size={14} className="spin" />
          Analysing visits &amp; documents… this may take up to 30 seconds
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ ...panelStyle, border: '1px solid var(--color-error)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                      marginBottom: 'var(--space-3)' }}>
          <AlertTriangle size={16} style={{ color: 'var(--color-error)' }} />
          <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>Analysis Unavailable</span>
        </div>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)',
                    marginBottom: 'var(--space-3)' }}>{error}</p>
        <button className="btn btn-ghost btn-sm" onClick={() => load()}>Try Again</button>
      </div>
    )
  }

  if (data?.status === 'no_data') {
    return (
      <div style={panelStyle}>
        <PanelHeader />
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
          No finalized notes found. Finalize a session note to enable analysis.
        </p>
      </div>
    )
  }

  const a = data?.analysis || {}

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <Brain size={16} style={{ color: 'var(--color-primary)' }} />
          <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>Health Intelligence</span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            · {data.visit_count} visit{data.visit_count !== 1 ? 's' : ''}
            {data.document_count > 0 && ` · ${data.document_count} document${data.document_count !== 1 ? 's' : ''}`}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <ConfidenceBadge level={a.data_confidence} />
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => load(true)}
            title="Re-run analysis"
            style={{ padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {/* New documents banner */}
      {hasNewDocs && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: '#fff7ed', border: '1px solid #fed7aa',
          borderRadius: 'var(--radius-md)', padding: 'var(--space-3)',
          marginBottom: 'var(--space-4)', gap: 'var(--space-3)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <FileText size={14} style={{ color: '#c2410c', flexShrink: 0 }} />
            <span style={{ fontSize: 'var(--text-xs)', color: '#9a3412', fontWeight: 500 }}>
              New documents uploaded since last analysis
            </span>
          </div>
          <button
            className="btn btn-sm"
            onClick={() => load(true)}
            style={{
              background: '#c2410c', color: 'white', border: 'none',
              display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
              fontSize: 'var(--text-xs)',
            }}
          >
            <Sparkles size={11} /> Re-run Analysis
          </button>
        </div>
      )}

      {/* Summary */}
      {a.summary && (
        <div style={{
          background: 'var(--color-primary-light)', borderRadius: 'var(--radius-md)',
          padding: 'var(--space-3)', marginBottom: 'var(--space-4)',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
            <TrendIcon trend={a.trend} />
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text)', lineHeight: 1.6, margin: 0 }}>
              {a.summary}
            </p>
          </div>
        </div>
      )}

      {/* Last vitals */}
      {(a.last_vitals_summary || data.last_vitals) && (
        <div style={{
          fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)',
          background: 'var(--color-surface-2)', borderRadius: 'var(--radius-sm)',
          padding: 'var(--space-2) var(--space-3)', marginBottom: 'var(--space-4)',
          borderLeft: '3px solid var(--color-border)',
        }}>
          <strong>Last vitals:</strong> {a.last_vitals_summary || data.last_vitals}
        </div>
      )}

      {/* Document insights — only shown when documents contributed */}
      {a.document_insights?.length > 0 && (
        <div style={{
          background: '#f0f9ff', border: '1px solid #bae6fd',
          borderRadius: 'var(--radius-md)', padding: 'var(--space-3)',
          marginBottom: 'var(--space-4)',
        }}>
          <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: '#0369a1',
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                      marginBottom: 'var(--space-2)' }}>
            Document Insights
          </p>
          <ul style={{ margin: 0, paddingLeft: 'var(--space-4)' }}>
            {a.document_insights.map((item, i) => (
              <li key={i} style={{ fontSize: 'var(--text-sm)', color: '#0c4a6e',
                                   marginBottom: 'var(--space-1)', lineHeight: 1.5 }}>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Section title="Recurring Issues" items={a.recurring_issues} />
      <Section title="Risk Flags" items={a.risk_flags} emptyText="No risk flags identified" />
      <Section title="Recommended Screenings" items={a.recommended_screenings} emptyText="None at this time" />
      <Section title="Medication Patterns" items={a.medication_patterns} emptyText="Insufficient data" />

      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-faint)', marginTop: 'var(--space-2)' }}>
        Generated {data.generated_at ? new Date(data.generated_at).toLocaleString() : ''}
        {' · '}AI-generated — always review with clinical judgment
      </p>
    </div>
  )
}

function PanelHeader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                  marginBottom: 'var(--space-3)' }}>
      <Brain size={16} style={{ color: 'var(--color-primary)' }} />
      <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>Health Intelligence</span>
    </div>
  )
}

const panelStyle = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)',
  padding: 'var(--space-6)',
}
