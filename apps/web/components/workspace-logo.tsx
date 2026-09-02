export function WorkspaceLogo({ className = 'h-7 w-7', name }: { className?: string; name?: string }) {
  const initial = name?.charAt(0)?.toUpperCase() ?? 'W';
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="ws-grad" x1="0" y1="0" x2="40" y2="40">
          <stop offset="0%" stopColor="#b9b0c8" />
          <stop offset="100%" stopColor="#2e2e2e" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="10" fill="url(#ws-grad)" />
      {/* Three overlapping diamond layers — workspace metaphor */}
      <rect x="9" y="14" width="10" height="10" rx="2" fill="#d6cfe1" opacity="0.5" transform="rotate(-8 14 19)" />
      <rect x="15" y="11" width="10" height="10" rx="2" fill="#e4e0ec" opacity="0.6" transform="rotate(-8 20 16)" />
      <rect x="21" y="14" width="10" height="10" rx="2" fill="#f0edf6" opacity="0.7" transform="rotate(-8 26 19)" />
      {/* Bottom bar — OS foundation */}
      <rect x="10" y="29" width="20" height="2" rx="1" fill="#e4e0ec" opacity="0.5" />
      {name && (
        <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle" fontFamily="Geist, ui-sans-serif, system-ui, sans-serif" fontSize="16" fontWeight="600" fill="#1a1a1a" opacity="0.8">
          {initial}
        </text>
      )}
    </svg>
  );
}
