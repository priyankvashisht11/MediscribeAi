export default function Help() {
  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, marginBottom: 'var(--space-6)' }}>
        Help &amp; Shortcuts
      </h1>

      <div className="settings-section">
        <h2 className="settings-section-title">Keyboard Shortcuts</h2>
        <table className="settings-table">
          <tbody>
            <tr><td><kbd>?</kbd></td><td>Show shortcuts</td></tr>
            <tr><td><kbd>N</kbd></td><td>New session</td></tr>
            <tr><td><kbd>D</kbd></td><td>Go to Dashboard</td></tr>
          </tbody>
        </table>
      </div>

      <div className="settings-section">
        <h2 className="settings-section-title">Quick Guide</h2>
        <ol style={{ paddingLeft: 'var(--space-5)', lineHeight: 2, fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
          <li>Go to <strong>New Session</strong> — enter patient name, select doctor.</li>
          <li>Click <strong>Start Recording</strong> — speak naturally during consultation.</li>
          <li>Click <strong>Stop &amp; Generate Note</strong> — AI produces SOAP note + ICD-10 codes.</li>
          <li>Review and edit the note, then click <strong>Finalize</strong>.</li>
          <li>Download <strong>Prescription PDF</strong> or <strong>Patient Instructions PDF</strong> from the note review page.</li>
        </ol>
      </div>

      <div className="settings-section">
        <h2 className="settings-section-title">Support</h2>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
          For issues or feedback, contact the Chartr team.
        </p>
      </div>
    </div>
  )
}
