export function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-surface-800/50 ${className}`} />;
}

export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-4 animate-pulse rounded bg-surface-800/50" />
      ))}
    </div>
  );
}

export function SkeletonCircle({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-full bg-surface-800/50 ${className}`} />;
}

export function SkeletonCard({ className = '', children }: { className?: string; children?: React.ReactNode }) {
  return <div className={`h-20 animate-pulse rounded-xl bg-surface-800/50 ${className}`}>{children}</div>;
}
