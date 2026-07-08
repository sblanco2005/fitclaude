import React from 'react';

type RingSpec = { r: number; color: string; pct: number; glow?: boolean };

// Triple concentric progress ring — radii 56/43/30, stroke 9, round caps.
// ember (protein) / lime (carbs) / amber (fat). Source: handoff screen 01.
export function MacroRing({
  kcal,
  kcalTarget,
  protein,
  carbs,
  fat,
  size = 128,
}: {
  kcal: number;
  kcalTarget: number;
  protein: number; // 0..1
  carbs: number;
  fat: number;
  size?: number;
}) {
  const c = 64;
  const stroke = 9;
  const rings: RingSpec[] = [
    { r: 56, color: 'var(--rd-ember)', pct: protein, glow: true },
    { r: 43, color: 'var(--rd-lime)', pct: carbs },
    { r: 30, color: 'var(--rd-amber)', pct: fat },
  ];

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 128 128" width={size} height={size} className="-rotate-90">
        {rings.map(({ r, color, pct, glow }) => {
          const circ = 2 * Math.PI * r;
          const dash = Math.max(0, Math.min(1, pct)) * circ;
          return (
            <g key={r}>
              <circle cx={c} cy={c} r={r} fill="none" stroke="var(--rd-border)" strokeWidth={stroke} />
              <circle
                cx={c}
                cy={c}
                r={r}
                fill="none"
                stroke={color}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={`${dash} ${circ}`}
                style={glow ? { filter: 'drop-shadow(0 0 5px rgba(255,107,69,.55))' } : undefined}
              />
            </g>
          );
        })}
      </svg>
      {/* Dark radial backing so the number reads clearly over the colored arcs. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(circle at center, rgba(12,14,19,.92) 42%, rgba(12,14,19,0) 70%)' }}
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-num text-[30px] font-bold leading-none tracking-tight text-[var(--rd-ink)]" style={{ textShadow: '0 1px 5px rgba(0,0,0,.85)' }}>
          {kcal.toLocaleString()}
        </span>
        <span className="font-label mt-1 text-[11px] font-semibold text-[var(--rd-text-muted)]" style={{ textShadow: '0 1px 3px rgba(0,0,0,.8)' }}>
          / {kcalTarget.toLocaleString()}
        </span>
        <span className="font-label text-[9px] tracking-[.16em] text-[var(--rd-text-faint)]">KCAL</span>
      </div>
    </div>
  );
}
