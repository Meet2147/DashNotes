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
      {/* Upper wing — large white face */}
      <path d="M 27,4 L 8,10 L 20,17 Z"
            fill="white" stroke="#A78BFA" strokeWidth="1.1" strokeLinejoin="round" />
      {/* Lower fold — light lavender */}
      <path d="M 27,4 L 20,17 L 13,22 Z"
            fill="#EDE9FE" stroke="#A78BFA" strokeWidth="1.1" strokeLinejoin="round" />
      {/* Rear flap */}
      <path d="M 8,10 L 20,17 L 13,22 Z"
            fill="#C4B5FD" stroke="#A78BFA" strokeWidth="1.1" strokeLinejoin="round" />
      {/* Fold crease (nose → junction) */}
      <line x1="27" y1="4" x2="20" y2="17"
            stroke="#A78BFA" strokeWidth="0.7" opacity="0.7" />
    </svg>
  );
}
