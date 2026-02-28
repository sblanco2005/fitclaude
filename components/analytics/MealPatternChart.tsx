'use client';

import type { MealTypeCount, TopFood } from '@/types';

interface Props {
  mealTypeDistribution: MealTypeCount[];
  topFoods: TopFood[];
  avgMealsPerDay: number;
}

const MEAL_TYPE_COLORS: Record<string, string> = {
  breakfast: '#f59e0b',
  lunch: '#10b981',
  dinner: '#3b82f6',
  snack: '#8b5cf6',
  unspecified: '#6B7280',
};

export function MealPatternChart({ mealTypeDistribution, topFoods, avgMealsPerDay }: Props) {
  const hasMealData = mealTypeDistribution.length > 0;
  const hasFoodData = topFoods.length > 0;

  if (!hasMealData && !hasFoodData) {
    return (
      <div className="bg-card border border-border-dark rounded-xl p-4">
        <h3 className="text-sm font-semibold text-white mb-2">Meal Patterns</h3>
        <div className="text-muted text-sm text-center py-8">Log more meals to see patterns</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Meal type distribution */}
      {hasMealData && (
        <div className="bg-card border border-border-dark rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white">Meal Distribution</h3>
            <span className="text-xs text-muted">{avgMealsPerDay} meals/day avg</span>
          </div>
          <div className="space-y-2">
            {mealTypeDistribution.map((m) => {
              const color = MEAL_TYPE_COLORS[m.type] || '#6B7280';
              return (
                <div key={m.type} className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-xs text-slate-300 capitalize flex-1">{m.type}</span>
                  <span className="text-xs text-muted">{m.count}x</span>
                  <div className="w-20 h-1.5 bg-[#1C1C26] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${m.percentage}%`, backgroundColor: color }}
                    />
                  </div>
                  <span className="text-xs text-muted w-8 text-right">{m.percentage}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top foods */}
      {hasFoodData && (
        <div className="bg-card border border-border-dark rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Most Logged Foods</h3>
          <div className="space-y-2">
            {topFoods.map((food, i) => (
              <div key={food.name} className="flex items-start gap-2">
                <span className="text-xs text-muted w-4 shrink-0 pt-0.5">{i + 1}.</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-slate-300 truncate capitalize">{food.name}</div>
                  <div className="text-[10px] text-muted">
                    {food.avgCalories} cal · {food.avgProtein}g protein
                  </div>
                </div>
                <span className="text-xs text-muted shrink-0">{food.count}x</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
