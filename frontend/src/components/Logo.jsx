// Option 2 — C Pulse: bold C arc with ECG heartbeat line in the gap
// light=false (default): white C for dark sidebar
// light=true: dark C for light backgrounds (landing page)
export default function Logo({ size = 32, light = false }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Bold C arc — center (16,16), radius 11, gap on right ~80° */}
      <path
        d="M 24 9 A 11 11 0 1 0 24 23"
        stroke={light ? '#0a0a0a' : 'white'}
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      {/* ECG heartbeat line floating in the C gap */}
      <polyline
        points="24,16 26,16 27,13.5 28.5,19 30,10 31,16"
        stroke="#3b82f6"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
