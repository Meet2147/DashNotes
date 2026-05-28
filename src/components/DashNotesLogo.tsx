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
        Plane geometry (matches reference image):
          N  = (27,5)   nose — upper-right
          UL = (7,4)    upper-left wing tip (slightly above nose)
          FJ = (22,16)  fold-crease junction (internal point)
          BL = (11,25)  tail — lower-left
        Faces:
          Upper wing  : N → UL → FJ   (large, white)
          Lower fold  : N → FJ → BL   (hatched / light lavender)
          Rear flap   : UL → FJ → BL  (mid lavender)
          Crease line : N → FJ
      */}

      {/* Upper wing */}
      <path d="M 27,5 L 7,4 L 22,16 Z"
            fill="white" stroke="#A78BFA" strokeWidth="1.2" strokeLinejoin="round" />
      {/* Lower fold */}
      <path d="M 27,5 L 22,16 L 11,25 Z"
            fill="#C4B5FD" opacity="0.7" stroke="#A78BFA" strokeWidth="1.2" strokeLinejoin="round" />
      {/* Rear flap */}
      <path d="M 7,4 L 22,16 L 11,25 Z"
            fill="#7C3AED" opacity="0.5" stroke="#A78BFA" strokeWidth="1.2" strokeLinejoin="round" />
      {/* Fold crease */}
      <line x1="27" y1="5" x2="22" y2="16"
            stroke="#C4B5FD" strokeWidth="0.9" opacity="0.9" />
    </svg>
  );
}
