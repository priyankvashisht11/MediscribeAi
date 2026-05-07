export default function Logo({ size = 32 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="MediScribe"
    >
      {/* Stethoscope circle head */}
      <circle cx="22" cy="22" r="5" stroke="var(--color-primary)" strokeWidth="2" fill="none" />
      {/* Stethoscope tube */}
      <path
        d="M17 22 C17 16 13 14 13 9"
        stroke="var(--color-primary)"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      {/* Earpiece left */}
      <path
        d="M10 9 C10 6 8 5 7 6"
        stroke="var(--color-primary)"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      {/* Earpiece right */}
      <path
        d="M16 9 C16 6 18 5 19 6"
        stroke="var(--color-primary)"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      {/* Pulse / waveform line */}
      <polyline
        points="2,16 5,16 7,10 9,22 11,16 14,16"
        stroke="var(--color-primary)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}
