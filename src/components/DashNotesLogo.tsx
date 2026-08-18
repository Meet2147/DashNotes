/**
 * DashNotes mark: a hand-drawn purple paper plane looping across graph paper,
 * leaving its trajectory behind it — notes that fly.
 *
 * The same geometry is rendered by scripts/logo.svg for the favicon, the PWA
 * icons, and the macOS app icon — change it in both places or they drift.
 */
export default function DashNotesLogo({ size = 32 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 128 128"
      width={size}
      height={size}
      aria-label="DashNotes"
    >
      <defs>
        <clipPath id="dn-clip">
          <rect x="6" y="6" width="116" height="116" rx="28" />
        </clipPath>
        <pattern id="dn-grid" width="10.5" height="10.5" patternUnits="userSpaceOnUse">
          <path d="M 10.5 0 L 0 0 0 10.5" fill="none" stroke="#D7E3F4" strokeWidth="0.9" />
        </pattern>
      </defs>

      <rect x="6" y="6" width="116" height="116" rx="28" fill="#FDFEFF" />
      <g clipPath="url(#dn-clip)">
        <rect x="6" y="6" width="116" height="116" fill="url(#dn-grid)" />
        <path
          d="M 6 27 H 122 M 6 69 H 122 M 6 111 H 122 M 27 6 V 122 M 69 6 V 122 M 111 6 V 122"
          fill="none"
          stroke="#C9D9EF"
          strokeWidth="1"
        />
      </g>
      <rect x="6" y="6" width="116" height="116" rx="28" fill="none" stroke="#E3E9F5" strokeWidth="2" />

      <path
        d="M 71 87 C 79 97, 90 103, 98 97 C 105 91, 104 81, 96 81 C 88 81, 86 92, 95 96 C 104 100, 112 96, 117 88"
        fill="none"
        stroke="#26232E"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M 26 40 L 58 63 L 71 87 L 48 64 Z"
        fill="#7C4DEF"
        stroke="#26232E"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M 26 40 L 88 57 L 71 87 L 58 63 Z"
        fill="#A78BFA"
        stroke="#26232E"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M 26 40 L 88 57 L 58 63 Z"
        fill="#CBB8FB"
        stroke="#26232E"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M 26 40 L 58 63" fill="none" stroke="#26232E" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
