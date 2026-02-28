'use client';

import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { Card } from '@/components/ui/Card';
import { CHART_THEME, formatDate } from './chartTheme';
import type { ProgressiveOverloadSeries } from '@/types';

interface ProgressChartProps {
  data: ProgressiveOverloadSeries[];
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs shadow-lg border max-w-[200px]"
      style={{ backgroundColor: CHART_THEME.tooltipBg, borderColor: CHART_THEME.tooltipBorder }}
    >
      <div className="text-slate-400 mb-1">{label ? formatDate(label) : ''}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
          <span className="text-slate-300 truncate">{p.name}</span>
          <span className="text-white font-semibold ml-auto">{p.value} lb</span>
        </div>
      ))}
    </div>
  );
}

export function ProgressChart({ data }: ProgressChartProps) {
  const [enabled, setEnabled] = useState<Set<string>>(() => {
    // Enable top 3 by default
    return new Set(data.slice(0, 3).map((d) => d.exerciseName));
  });

  if (data.length === 0) {
    return (
      <Card>
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">Progressive Overload</h3>
        <div className="h-[250px] flex items-center justify-center text-muted text-sm">
          Need 2+ sessions of a compound exercise to track progress
        </div>
      </Card>
    );
  }

  const toggleExercise = (name: string) => {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  // Merge all enabled series into unified date-based data
  const activeSeries = data.filter((d) => enabled.has(d.exerciseName));
  const allDates = new Set<string>();
  for (const series of activeSeries) {
    for (const point of series.data) {
      allDates.add(point.date);
    }
  }
  const sortedDates = Array.from(allDates).sort();

  const chartData = sortedDates.map((date) => {
    const point: Record<string, string | number> = { date };
    for (const series of activeSeries) {
      const match = series.data.find((d) => d.date === date);
      if (match) point[series.exerciseName] = match.maxWeight;
    }
    return point;
  });

  return (
    <Card>
      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">Progressive Overload</h3>

      {/* Toggle chips */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {data.map((series, i) => {
          const color = CHART_THEME.colors[i % CHART_THEME.colors.length];
          const active = enabled.has(series.exerciseName);
          return (
            <button
              key={series.exerciseName}
              onClick={() => toggleExercise(series.exerciseName)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all border ${
                active
                  ? 'text-white border-transparent'
                  : 'text-slate-500 border-slate-700 bg-transparent'
              }`}
              style={active ? { backgroundColor: color, borderColor: color } : {}}
            >
              {series.exerciseName}
            </button>
          );
        })}
      </div>

      {activeSeries.length === 0 ? (
        <div className="h-[250px] flex items-center justify-center text-muted text-xs">
          Select exercises to view progress
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
            <CartesianGrid stroke={CHART_THEME.gridColor} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              tick={{ fill: CHART_THEME.axisColor, fontSize: 10 }}
              axisLine={{ stroke: CHART_THEME.gridColor }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: CHART_THEME.axisColor, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              unit=" lb"
            />
            <Tooltip content={<CustomTooltip />} />
            {activeSeries.map((series, i) => {
              const idx = data.findIndex((d) => d.exerciseName === series.exerciseName);
              const color = CHART_THEME.colors[idx % CHART_THEME.colors.length];
              return (
                <Line
                  key={series.exerciseName}
                  type="monotone"
                  dataKey={series.exerciseName}
                  stroke={color}
                  strokeWidth={2}
                  dot={{ r: 3, fill: color }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
