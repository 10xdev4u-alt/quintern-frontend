// Centered spinner used as Suspense fallback for lazy routes. Keeps the
// visual identity of the rest of the app (surface tokens, brand gradient).
export default function Spinner() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3" role="status" aria-label="Loading">
      <svg className="w-10 h-10 animate-spin" viewBox="0 0 40 40" aria-hidden="true">
        <defs>
          <linearGradient id="route-spin" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgb(99 102 241)" />
            <stop offset="100%" stopColor="rgb(139 92 246)" />
          </linearGradient>
        </defs>
        <circle cx="20" cy="20" r="16" fill="none" stroke="url(#route-spin)" strokeWidth="3" strokeLinecap="round" strokeDasharray="60 40" />
      </svg>
      <p className="text-xs text-fg-muted">Loading…</p>
    </div>
  );
}
