import React from 'react';

// Placeholder for redesign screens not yet built. Keeps bottom-nav destinations live.
export function ComingSoon({ screen, accent }: { screen: string; accent: string }) {
  return (
    <div className="animate-fadeup flex min-h-[60vh] flex-col items-center justify-center text-center">
      <span
        className="font-label mb-4 rounded-full border px-3 py-1 text-[10px] tracking-[.16em]"
        style={{ borderColor: 'var(--rd-border)', color: accent }}
      >
        REDESIGN v1
      </span>
      <h1 className="font-display text-[25px] font-bold text-[var(--rd-ink)]">{screen}</h1>
      <p className="mt-2 max-w-[240px] text-[13px] text-[var(--rd-text-faint)]">
        This screen is on the build list. Foundation, nav and Dashboard are live.
      </p>
    </div>
  );
}
