'use client';

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { CHART_THEME, formatDate } from './chartTheme';
import type { MacroDayPoint } from '@/types';

interface Props {
  data: MacroDayPoint[];
  targets: { proteinG: number; carbsG: number; fatG: number };
}

const MACRO_COLORS = {
  protein: '#3b82f6',
  carbs: '#f59e0b',
  fat: '#ef4444',
};

export function MacroChart({ data, targets }: Props) {
  if (data.length === 0) {
    return (
      <div className="bg-card border border-border-dark rounded-xl p-4">
        <h3 className="text-sm font-semibold text-white mb-2">Macros by Day</h3>
        <div className="text-muted text-sm text-center py-8">No nutrition data logged yet</div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border-dark rounded-xl p-4">
      <h3 className="text-sm font-semibold text-white mb-1">Macros by Day</h3>
      {(targets.proteinG > 0 || targets.carbsG > 0 || targets.fatG > 0) && (
        <div className="text-xs text-muted mb-2">
          Targets: {targets.proteinG}g P / {targets.carbsG}g C / {targets.fatG}g F
        </div>
      )}
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="proteinGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={MACRO_COLORS.protein} stopOpacity={0.2} />
              <stop offset="95%" stopColor={MACRO_COLORS.protein} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="carbsGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={MACRO_COLORS.carbs} stopOpacity={0.2} />
              <stop offset="95%" stopColor={MACRO_COLORS.carbs} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="fatGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={MACRO_COLORS.fat} stopOpacity={0.2} />
              <stop offset="95%" stopColor={MACRO_COLORS.fat} stopOpacity={0} />
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
            unit="g"
          />
          <Tooltip
            contentStyle={{
              background: CHART_THEME.tooltipBg,
              border: `1px solid ${CHART_THEME.tooltipBorder}`,
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={(label) => formatDate(String(label))}
            formatter={(value, name) => [`${Number(value)}g`, String(name).charAt(0).toUpperCase() + String(name).slice(1)]}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
          />
          <Area
            type="monotone"
            dataKey="protein"
            stroke={MACRO_COLORS.protein}
            fill="url(#proteinGrad)"
            strokeWidth={2}
            dot={false}
          />
          <Area
            type="monotone"
            dataKey="carbs"
            stroke={MACRO_COLORS.carbs}
            fill="url(#carbsGrad)"
            strokeWidth={2}
            dot={false}
          />
          <Area
            type="monotone"
            dataKey="fat"
            stroke={MACRO_COLORS.fat}
            fill="url(#fatGrad)"
            strokeWidth={2}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
