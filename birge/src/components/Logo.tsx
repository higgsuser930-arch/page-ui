export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="logo">
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
        <defs>
          <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#c084fc" />
            <stop offset="1" stopColor="#7c3aed" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="9" fill="url(#lg)" />
        <circle cx="12" cy="16" r="6.5" fill="none" stroke="#fff" strokeWidth="2.2" />
        <circle cx="20" cy="16" r="6.5" fill="none" stroke="#fff" strokeWidth="2.2" />
        <path d="M14.6 13.2l4 2.8-4 2.8z" fill="#fff" />
      </svg>
      <b>Birge</b>
    </span>
  );
}
