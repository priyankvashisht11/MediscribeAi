// Option 4 — Stethoscope Period: "Chartr" followed by a stethoscope bell as the terminal mark
export default function ChartrWordmark({ className }) {
  return (
    <span
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '1px' }}
    >
      Chartr
      {/* Stethoscope diaphragm — three concentric circles, sized like a period */}
      <svg
        width="7"
        height="7"
        viewBox="0 0 7 7"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        style={{ display: 'inline-block', verticalAlign: '0px', flexShrink: 0 }}
      >
        <circle cx="3.5" cy="3.5" r="2.8" stroke="currentColor" strokeWidth="0.9" />
        <circle cx="3.5" cy="3.5" r="1.3" stroke="currentColor" strokeWidth="0.7" />
        <circle cx="3.5" cy="3.5" r="0.45" fill="currentColor" />
      </svg>
    </span>
  )
}
