'use client';

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import { CHART_THEME, formatDate } from './chartTheme';
import type { CalorieDayPoint } from '@/types';

interface Props {
  data: CalorieDayPoint[];
  target: number;
}

export function CalorieTrendChart({ data, target }: Props) {
  if (data.length === 0) {
    return (
      <div className="bg-card border border-border-dark rounded-xl p-4">
        <h3 className="text-sm font-semibold text-white mb-2">Calorie Trend</h3>
        <div className="text-muted text-sm text-center py-8">No nutrition data logged yet</div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border-dark rounded-xl p-4">
      <h3 className="text-sm font-semibold text-white mb-1">Calorie Trend</h3>
      {target > 0 && (
        <div className="flex items-center gap-3 text-xs text-muted mb-2">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            Daily
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-0.5 bg-amber-400 inline-block" style={{ borderBottom: '1px dashed' }} />
            Target ({target.toLocaleString()})
          </span>
        </div>
      )}
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="calorieGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART_THEME.primaryColor} stopOpacity={0.3} />
              <stop offset="95%" stopColor={CHART_THEME.primaryColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.gridColor} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fontSize: 10, fill: CHART_THEME.axisColor }}
            axisLine={{ stroke: CHART_THEME.gridColor }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: CHART_THEME.axisColor }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: CHART_THEME.tooltipBg,
              border: `1px solid ${CHART_THEME.tooltipBorder}`,
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={(label) => formatDate(String(label))}
            formatter={(value) => [`${Number(value).toLocaleString()} cal`, 'Calories']}
          />
          {target > 0 && (
            <ReferenceLine
              y={target}
              stroke="#f59e0b"
              strokeDasharray="4 4"
              strokeWidth={1}
            />
          )}
          <Area
            type="monotone"
            dataKey="calories"
            stroke={CHART_THEME.primaryColor}
            fill="url(#calorieGrad)"
            strokeWidth={2}
            dot={data.length <= 14}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
