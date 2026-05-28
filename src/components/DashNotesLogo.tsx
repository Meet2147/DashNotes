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
      {/* Paper plane body */}
      <path d="M 28,13 L 3,3 L 9,13 L 3,23 Z" fill="white" />
      {/* Lower fold flap */}
      <path d="M 9,13 L 11,19 L 3,23 Z" fill="#C4B5FD" opacity="0.85" />
    </svg>
  );
}
