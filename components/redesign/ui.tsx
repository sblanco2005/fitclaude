import React from 'react';

// Shared redesign primitives (scoped by .redesign-root in globals.css)

export function ScreenHeader({
  eyebrow,
  title,
  right,
}: {
  eyebrow?: string;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <header className="flex items-end justify-between pt-1">
      <div>
        {eyebrow && (
          <p className="font-label text-[10px] tracking-[.14em] text-[var(--rd-text-faint)]">{eyebrow}</p>
        )}
        <h1 className="font-display mt-1 text-[25px] font-bold leading-[1.1] text-[var(--rd-ink)]">{title}</h1>
      </div>
      {right}
    </header>
  );
}

export function Eyebrow({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <p className="font-label text-[10px] tracking-[.16em]" style={{ color: color ?? 'var(--rd-text-faint)' }}>
      {children}
    </p>
  );
}

export function Pill({
  children,
  color = 'var(--rd-lime)',
  tint = 'rgba(200,255,77,.12)',
}: {
  children: React.ReactNode;
  color?: string;
  tint?: string;
}) {
  return (
    <span
      className="font-label rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={{ color, background: tint }}
    >
      {children}
    </span>
  );
}

// Horizontally-scrolling filter chips
export function FilterChips({
  options,
  value,
  onChange,
  accent = 'var(--rd-ink)',
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  accent?: string;
}) {
  return (
    <div className="scrollbar-hide -mx-5 flex gap-2 overflow-x-auto px-5">
      {options.map((opt) => {
        const active = opt === value;
        return (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className="font-body shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors"
            style={{
              borderColor: active ? 'transparent' : 'var(--rd-border)',
              background: active ? accent : 'var(--rd-card-glass)',
              color: active ? '#0A0C10' : 'var(--rd-text-muted)',
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// Thumbnail placeholder for tutorial videos (gradient + play glyph)
export function VideoThumb({
  className = '',
  children,
  rounded = 'rounded-[14px]',
}: {
  className?: string;
  children?: React.ReactNode;
  rounded?: string;
}) {
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden ${rounded} ${className}`}
      style={{ background: 'linear-gradient(135deg,#26282f,#15171c)' }}
    >
      {children}
    </div>
  );
}
