import React from 'react';

// Segmented macro bar — protein/carbs/fat by calorie share (ember/lime/amber).
// Source: handoff screen 04.
export function MacroBar({
  proteinG,
  carbsG,
  fatG,
}: {
  proteinG: number;
  carbsG: number;
  fatG: number;
}) {
  const pKcal = proteinG * 4;
  const cKcal = carbsG * 4;
  const fKcal = fatG * 9;
  const total = Math.max(1, pKcal + cKcal + fKcal);
  const seg = [
    { kcal: pKcal, color: 'var(--rd-macro-protein)' },
    { kcal: cKcal, color: 'var(--rd-macro-carbs)' },
    { kcal: fKcal, color: 'var(--rd-macro-fat)' },
  ];

  return (
    <div>
      <div className="flex h-2 w-full gap-1 overflow-hidden rounded-full">
        {seg.map((s, i) => (
          <div key={i} className="h-full rounded-full transition-[width] duration-500" style={{ width: `${(s.kcal / total) * 100}%`, background: s.color }} />
        ))}
      </div>
      <div className="mt-2.5 flex items-center justify-between">
        <Legend label="P" grams={proteinG} color="var(--rd-macro-protein)" />
        <Legend label="C" grams={carbsG} color="var(--rd-macro-carbs)" />
        <Legend label="F" grams={fatG} color="var(--rd-macro-fat)" />
      </div>
    </div>
  );
}

function Legend({ label, grams, color }: { label: string; grams: number; color: string }) {
  return (
    <span className="font-label text-[11px] text-[var(--rd-text-faint)]">
      <span style={{ color }}>{label}</span> {Math.round(grams)}g
    </span>
  );
}
