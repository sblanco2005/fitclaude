'use client';

const periods = [
  { value: 'week', label: 'Week' },
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
  { value: 'all', label: 'All' },
];

interface PeriodSelectorProps {
  value: string;
  onChange: (period: string) => void;
}

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  return (
    <div className="flex gap-1.5 bg-slate-800/50 rounded-xl p-1">
      {periods.map((p) => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            value === p.value
              ? 'bg-primary text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
