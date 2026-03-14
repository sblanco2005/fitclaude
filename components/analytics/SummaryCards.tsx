'use client';

import { useRouter } from 'next/navigation';
import { formatVolume } from './chartTheme';

interface SummaryCardsProps {
  totalWorkouts: number;
  totalVolume: number;
  avgVolumePerSession: number;
}

export function SummaryCards({ totalWorkouts, totalVolume, avgVolumePerSession }: SummaryCardsProps) {
  const router = useRouter();
  const stats = [
    { label: 'Workouts', value: String(totalWorkouts), color: 'text-primary', href: '/workouts?tab=history' },
    { label: 'Total Volume', value: `${formatVolume(totalVolume)} lb`, color: 'text-blue-400' },
    { label: 'Avg / Session', value: `${formatVolume(avgVolumePerSession)} lb`, color: 'text-amber-400' },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {stats.map((s) => (
        <div
          key={s.label}
          className={`bg-card border border-border-dark rounded-xl p-3 text-center ${s.href ? 'cursor-pointer active:scale-95 transition-transform' : ''}`}
          onClick={s.href ? () => router.push(s.href) : undefined}
        >
          <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
          <div className="text-xs text-muted mt-0.5">{s.label}</div>
        </div>
      ))}
    </div>
  );
}
