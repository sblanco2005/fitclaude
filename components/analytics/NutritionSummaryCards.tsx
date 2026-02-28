'use client';

import type { NutritionAnalytics } from '@/types';

interface Props {
  nutrition: NutritionAnalytics;
}

export function NutritionSummaryCards({ nutrition }: Props) {
  const stats = [
    { label: 'Days Logged', value: nutrition.daysLogged, unit: '' },
    { label: 'Avg Calories', value: nutrition.avgCalories, unit: 'cal' },
    { label: 'Avg Protein', value: nutrition.avgProteinG, unit: 'g' },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {stats.map((s) => (
        <div key={s.label} className="bg-card border border-border-dark rounded-xl p-2.5">
          <div className="text-muted text-[10px] uppercase tracking-wider">{s.label}</div>
          <div className="text-white font-bold text-lg leading-tight">
            {s.value.toLocaleString()}
            {s.unit && <span className="text-xs text-muted font-normal ml-0.5">{s.unit}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
