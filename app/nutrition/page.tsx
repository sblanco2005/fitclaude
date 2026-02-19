'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import type { DailyNutrition, NutritionLog } from '@/types';

function ProgressBar({ current, target, label, color }: {
  current: number;
  target: number;
  label: string;
  color: string;
}) {
  const percentage = target > 0 ? Math.min((current / target) * 100, 100) : 0;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-slate-300">{label}</span>
        <span className="text-muted">{Math.round(current)} / {target}</span>
      </div>
      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export default function NutritionPage() {
  const [today, setToday] = useState<DailyNutrition | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/nutrition/today')
      .then((res) => res.json())
      .then((data) => {
        setToday(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-muted">Loading nutrition...</div>
      </div>
    );
  }

  const totals = today?.totals || { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 };

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      <h2 className="text-xl font-bold text-white">Nutrition</h2>

      {/* Daily Totals */}
      <Card>
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">
          Today&apos;s Macros
        </h3>
        <div className="space-y-3">
          <ProgressBar current={totals.calories} target={2400} label="Calories" color="bg-primary" />
          <ProgressBar current={totals.proteinG} target={180} label="Protein (g)" color="bg-blue-500" />
          <ProgressBar current={totals.carbsG} target={300} label="Carbs (g)" color="bg-amber-500" />
          <ProgressBar current={totals.fatG} target={80} label="Fat (g)" color="bg-red-500" />
        </div>
      </Card>

      {/* Meal Log */}
      <Card>
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
          Meals Today
        </h3>
        {(!today?.logs || today.logs.length === 0) ? (
          <p className="text-muted text-sm">
            No meals logged yet. Tell your coach what you ate or snap a photo!
          </p>
        ) : (
          <div className="space-y-3">
            {today.logs.map((log: NutritionLog) => (
              <div key={log.id} className="flex items-start justify-between py-2 border-b border-slate-800 last:border-0">
                <div>
                  <p className="text-sm text-white">{log.rawInput}</p>
                  {log.mealType && (
                    <span className="text-xs text-muted capitalize">{log.mealType}</span>
                  )}
                </div>
                <div className="text-right text-xs text-muted whitespace-nowrap ml-4">
                  {log.calories && <div>{Math.round(log.calories)} kcal</div>}
                  {log.proteinG && <div>{Math.round(log.proteinG)}g protein</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
