/**
 * DashNotes mark: a fountain-pen nib pressed into a soft (neumorphic) tile.
 *
 * The nib replaces the old paper plane — with the handwriting studio the pen is
 * the product. Neumorphism is baked into the SVG as a light-from-top-left pair
 * of shadows on the tile and an inset well behind the nib, so the mark carries
 * the style anywhere it is dropped, including places with no CSS.
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
        <linearGradient id="dn-tile" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F1F3FA" />
          <stop offset="100%" stopColor="#DDE1EF" />
        </linearGradient>
        <linearGradient id="dn-nib" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#8B5CF6" />
          <stop offset="100%" stopColor="#5B21B6" />
        </linearGradient>
        <radialGradient id="dn-well" cx="0.35" cy="0.3" r="1">
          <stop offset="0%" stopColor="#D3D8E8" />
          <stop offset="100%" stopColor="#C4CADD" />
        </radialGradient>
        {/* Soft-UI double shadow: light above-left, shade below-right. */}
        <filter id="dn-soft" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="-4" dy="-4" stdDeviation="5" floodColor="#FFFFFF" floodOpacity="0.9" />
          <feDropShadow dx="5" dy="6" stdDeviation="6" floodColor="#AEB6CC" floodOpacity="0.55" />
        </filter>
        <filter id="dn-nib-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="2" dy="3" stdDeviation="3" floodColor="#3B1D7A" floodOpacity="0.35" />
        </filter>
      </defs>

      {/* Tile */}
      <rect x="8" y="8" width="112" height="112" rx="30" fill="url(#dn-tile)" filter="url(#dn-soft)" />
      {/* Inset well the nib sits in */}
      <circle cx="64" cy="64" r="40" fill="url(#dn-well)" />
      <circle cx="64" cy="64" r="40" fill="none" stroke="#FFFFFF" strokeOpacity="0.55" strokeWidth="1.5" />

      {/* Nib */}
      <g filter="url(#dn-nib-shadow)">
        <path
          d="M64 104 C 70 96 86 82 86 60 C 86 44 80 34 76 30 L 52 30 C 48 34 42 44 42 60 C 42 82 58 96 64 104 Z"
          fill="url(#dn-nib)"
        />
        {/* Breather hole */}
        <circle cx="64" cy="54" r="7" fill="#EDEFF7" />
        {/* Slit from hole to tip */}
        <line x1="64" y1="62" x2="64" y2="99" stroke="#EDEFF7" strokeWidth="3" strokeLinecap="round" />
      </g>
    </svg>
  );
}
