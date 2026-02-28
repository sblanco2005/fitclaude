'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { Card } from '@/components/ui/Card';
import { CHART_THEME, formatVolume, formatDate } from './chartTheme';
import type { WeeklyVolume } from '@/types';

interface VolumeChartProps {
  data: WeeklyVolume[];
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs shadow-lg border"
      style={{ backgroundColor: CHART_THEME.tooltipBg, borderColor: CHART_THEME.tooltipBorder }}
    >
      <div className="text-slate-400 mb-1">{label ? formatDate(label) : ''}</div>
      <div className="text-white font-semibold">{formatVolume(payload[0].value)} lb</div>
    </div>
  );
}

export function VolumeChart({ data }: VolumeChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">Weekly Volume</h3>
        <div className="h-[200px] flex items-center justify-center text-muted text-sm">
          No volume data yet
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">Weekly Volume</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
          <CartesianGrid stroke={CHART_THEME.gridColor} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="weekStart"
            tickFormatter={formatDate}
            tick={{ fill: CHART_THEME.axisColor, fontSize: 10 }}
            axisLine={{ stroke: CHART_THEME.gridColor }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={formatVolume}
            tick={{ fill: CHART_THEME.axisColor, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(16, 185, 129, 0.08)' }} />
          <Bar dataKey="volume" fill={CHART_THEME.primaryColor} radius={[4, 4, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
