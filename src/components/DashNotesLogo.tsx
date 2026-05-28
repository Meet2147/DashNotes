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
      {/* Upper wing — white face */}
      <path d="M 27,5 L 4,13 L 16,20 Z"
            fill="white" stroke="#A78BFA" strokeWidth="0.8" strokeLinejoin="round" />
      {/* Lower fold — light lavender face */}
      <path d="M 27,5 L 16,20 L 7,27 Z"
            fill="#DDD6FE" stroke="#A78BFA" strokeWidth="0.8" strokeLinejoin="round" />
      {/* Rear flap — mid lavender */}
      <path d="M 4,13 L 16,20 L 7,27 Z"
            fill="#C4B5FD" opacity="0.85" stroke="#A78BFA" strokeWidth="0.8" strokeLinejoin="round" />
    </svg>
  );
}
