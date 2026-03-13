'use client';

import { formatVolume } from './chartTheme';

interface SummaryCardsProps {
  totalWorkouts: number;
  totalVolume: number;
  avgVolumePerSession: number;
}

export function SummaryCards({ totalWorkouts, totalVolume, avgVolumePerSession }: SummaryCardsProps) {
  const stats = [
    { label: 'Workouts', value: String(totalWorkouts), color: 'text-primary' },
    { label: 'Total Volume', value: `${formatVolume(totalVolume)} lb`, color: 'text-blue-400' },
    { label: 'Avg / Session', value: `${formatVolume(avgVolumePerSession)} lb`, color: 'text-amber-400' },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {stats.map((s) => (
        <div
          key={s.label}
          className="bg-card border border-border-dark rounded-xl p-3 text-center"
        >
          <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
          <div className="text-xs text-muted mt-0.5">{s.label}</div>
        </div>
      ))}
    </div>
  );
}
