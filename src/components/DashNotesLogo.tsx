export default function DashNotesLogo({ size = 32 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      aria-label="DashNotes"
    >
      <defs>
        <linearGradient id="dnbg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2E1065" />
          <stop offset="100%" stopColor="#7C3AED" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="7" fill="url(#dnbg)" />

      {/*
        Paper plane pointing upper-right (matches reference image).
        Vertices:
          N  = (27, 4)  — nose (upper-right)
          TL = (3, 15)  — top-left wing tip (far left)
          B  = (17, 18) — fold junction (internal crease endpoint)
          T  = (9, 27)  — tail (lower-left)
      */}

      {/* Upper wing — large white face */}
      <path d="M 27,4 L 3,15 L 17,18 Z"
            fill="white" stroke="#A78BFA" strokeWidth="1.2" strokeLinejoin="round" />

      {/* Lower fold — light lavender */}
      <path d="M 27,4 L 17,18 L 9,27 Z"
            fill="#DDD6FE" stroke="#A78BFA" strokeWidth="1.2" strokeLinejoin="round" />

      {/* Rear flap — mid lavender */}
      <path d="M 3,15 L 17,18 L 9,27 Z"
            fill="#A78BFA" opacity="0.55" stroke="#A78BFA" strokeWidth="1.2" strokeLinejoin="round" />

      {/* Fold crease line — nose to junction */}
      <line x1="27" y1="4" x2="17" y2="18"
            stroke="#C4B5FD" strokeWidth="0.8" opacity="0.8" />
    </svg>
  );
}
