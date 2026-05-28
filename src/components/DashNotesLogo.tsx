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
      <path d="M 7,5 L 19,5 L 25,11 L 25,27 Q 25,28 24,28 L 8,28 Q 7,28 7,27 Z"
            fill="white" />
      <path d="M 19,5 L 25,11 L 19,11 Z" fill="#C4B5FD" />
      <rect x="10" y="14" width="11" height="2" rx="1" fill="#7C3AED" opacity="0.3" />
      <rect x="10" y="18" width="9"  height="2" rx="1" fill="#7C3AED" opacity="0.2" />
      <rect x="10" y="22" width="10" height="2" rx="1" fill="#7C3AED" opacity="0.2" />
      <path d="M 22,22 C 22.5,19.5 23,19 25.5,18.5 C 23,18 22.5,17.5 22,15
               C 21.5,17.5 21,18 18.5,18.5 C 21,19 21.5,19.5 22,22 Z"
            fill="#22D3EE" />
    </svg>
  );
}
