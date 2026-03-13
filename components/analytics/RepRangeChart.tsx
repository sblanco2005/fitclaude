'use client';

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Card } from '@/components/ui/Card';
import type { RepRangeData } from '@/types';

interface RepRangeChartProps {
  data: RepRangeData[];
}

const RANGE_COLORS: Record<string, string> = {
  '1-5': '#ef4444',    // red — strength
  '6-8': '#3b82f6',    // blue — strength-hypertrophy
  '8-12': '#10b981',   // emerald — hypertrophy
  '12+': '#f59e0b',    // amber — endurance
};

const RANGE_LABELS: Record<string, string> = {
  '1-5': 'Strength',
  '6-8': 'Str-Hyp',
  '8-12': 'Hypertrophy',
  '12+': 'Endurance',
};

export function RepRangeChart({ data }: RepRangeChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">Rep Range Distribution</h3>
        <div className="h-[180px] flex items-center justify-center text-muted text-sm">
          No set data yet
        </div>
      </Card>
    );
  }

  // Find dominant range
  const dominant = data.reduce((max, d) => (d.totalSets > max.totalSets ? d : max), data[0]);

  return (
    <Card>
      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">Rep Range Distribution</h3>
      <div className="flex items-center gap-4">
        <div className="relative" style={{ width: 140, height: 140 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="totalSets"
                nameKey="range"
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={65}
                strokeWidth={0}
              >
                {data.map((entry) => (
                  <Cell key={entry.range} fill={RANGE_COLORS[entry.range] || '#6B7280'} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          {/* Center label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xs text-muted">{RANGE_LABELS[dominant.range]}</span>
            <span className="text-lg font-bold text-white">{dominant.percentage}%</span>
          </div>
        </div>
        {/* Legend */}
        <div className="flex-1 space-y-2">
          {data.map((d) => (
            <div key={d.range} className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: RANGE_COLORS[d.range] || '#6B7280' }}
              />
              <span className="text-xs text-slate-300 flex-1">
                {d.range} reps
              </span>
              <span className="text-xs font-medium text-white">{d.totalSets} sets</span>
              <span className="text-xs text-muted w-8 text-right">{d.percentage}%</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
