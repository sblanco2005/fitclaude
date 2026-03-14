'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { PeriodSelector } from '@/components/analytics/PeriodSelector';
import { SummaryCards } from '@/components/analytics/SummaryCards';
import { VolumeChart } from '@/components/analytics/VolumeChart';
import { ProgressChart } from '@/components/analytics/ProgressChart';
import { PersonalRecordsList } from '@/components/analytics/PersonalRecordsList';
import { PlateauAlerts } from '@/components/analytics/PlateauAlerts';
import { RepRangeChart } from '@/components/analytics/RepRangeChart';
import { WeeklyInsightsCard } from '@/components/analytics/WeeklyInsightsCard';
import { MusclesWorkedCard } from '@/components/analytics/MusclesWorkedCard';
import { CalorieTrendChart } from '@/components/analytics/CalorieTrendChart';
import { MacroChart } from '@/components/analytics/MacroChart';
import { NutritionSummaryCards } from '@/components/analytics/NutritionSummaryCards';
import { ComplianceCards } from '@/components/analytics/ComplianceCards';
import { MealPatternChart } from '@/components/analytics/MealPatternChart';
import type { AnalyticsData } from '@/types';

export default function AnalyticsPage() {
  const { status } = useSession();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [period, setPeriod] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'training' | 'nutrition'>('training');

  useEffect(() => {
    if (status !== 'authenticated') return;
    setLoading(true);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    fetch(`/api/analytics?period=${period}&tz=${encodeURIComponent(tz)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [status, period]);

  if (status === 'loading' || loading) {
    return (
      <div className="p-3 space-y-3 max-w-lg mx-auto">
        <h2 className="text-xl font-bold text-white">Analytics</h2>
        <PeriodSelector value={period} onChange={setPeriod} />
        {/* Skeleton */}
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card border border-border-dark rounded-xl p-3 h-16 animate-pulse" />
          ))}
        </div>
        <div className="bg-card border border-border-dark rounded-xl h-[240px] animate-pulse" />
        <div className="bg-card border border-border-dark rounded-xl h-[300px] animate-pulse" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-3 space-y-3 max-w-lg mx-auto">
        <h2 className="text-xl font-bold text-white">Analytics</h2>
        <PeriodSelector value={period} onChange={setPeriod} />
        <div className="py-16 text-center">
          <div className="text-muted mb-2">Could not load analytics data</div>
          <button
            onClick={() => setPeriod(period)}
            className="text-sm text-primary hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const isTrainingEmpty = data.totalWorkouts === 0;
  const isNutritionEmpty = !data.nutrition || data.nutrition.daysLogged === 0;

  return (
    <div className="p-3 pb-1 space-y-3 max-w-lg mx-auto">
      <h2 className="text-xl font-bold text-white">Analytics</h2>
      <PeriodSelector value={period} onChange={setPeriod} />

      {/* Tab switcher */}
      <div className="flex gap-1 bg-[#111118] rounded-lg p-0.5">
        <button
          onClick={() => setTab('training')}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
            tab === 'training'
              ? 'bg-emerald-600 text-white'
              : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          Training
        </button>
        <button
          onClick={() => setTab('nutrition')}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
            tab === 'nutrition'
              ? 'bg-emerald-600 text-white'
              : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          Nutrition
        </button>
      </div>

      {tab === 'training' ? (
        isTrainingEmpty ? (
          <div className="py-16 text-center">
            <svg className="w-12 h-12 mx-auto text-slate-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            <div className="text-slate-400 font-medium mb-1">No completed workouts yet</div>
            <div className="text-muted text-sm">Complete a workout to see your analytics</div>
          </div>
        ) : (
          <>
            <SummaryCards
              totalWorkouts={data.totalWorkouts}
              totalVolume={data.totalVolume}
              avgVolumePerSession={data.avgVolumePerSession}
            />
            <MusclesWorkedCard musclesWorked={data.musclesWorked || []} />
            <VolumeChart data={data.volumeByWeek} />
            <ProgressChart data={data.progressiveOverload} />
            <PersonalRecordsList records={data.personalRecords} />
            <PlateauAlerts plateaus={data.plateaus} />
            <RepRangeChart data={data.repRangeAnalysis} />
            <WeeklyInsightsCard />
          </>
        )
      ) : isNutritionEmpty ? (
        <div className="py-16 text-center">
          <svg className="w-12 h-12 mx-auto text-slate-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.871c1.355 0 2.697.056 4.024.166C17.155 8.51 18 9.473 18 10.608v2.513M15 8.25v-1.5m-6 1.5v-1.5m12 9.75l-1.5.75a3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0L3 16.5m15-3.379a48.474 48.474 0 00-6-.371c-2.032 0-4.034.126-6 .371m12 0c.39.049.777.102 1.163.16 1.07.16 1.837 1.094 1.837 2.175v5.169c0 .621-.504 1.125-1.125 1.125H4.125A1.125 1.125 0 013 20.625v-5.17c0-1.08.768-2.014 1.837-2.174A47.78 47.78 0 016 13.12M12.265 3.11a.375.375 0 11-.53 0L12 2.845l.265.265zm-3 0a.375.375 0 11-.53 0L9 2.845l.265.265zm6 0a.375.375 0 11-.53 0L15 2.845l.265.265z" />
          </svg>
          <div className="text-slate-400 font-medium mb-1">No nutrition data yet</div>
          <div className="text-muted text-sm">Log meals via chat to see nutrition analytics</div>
        </div>
      ) : (
        <>
          <NutritionSummaryCards nutrition={data.nutrition} />
          <CalorieTrendChart
            data={data.nutrition.caloriesByDay}
            target={data.nutrition.targets.calories}
          />
          <MacroChart
            data={data.nutrition.macrosByDay}
            targets={{
              proteinG: data.nutrition.targets.proteinG,
              carbsG: data.nutrition.targets.carbsG,
              fatG: data.nutrition.targets.fatG,
            }}
          />
          <ComplianceCards
            calorieCompliance={data.nutrition.compliance.calorie}
            proteinCompliance={data.nutrition.compliance.protein}
            calorieTarget={data.nutrition.targets.calories}
            proteinTarget={data.nutrition.targets.proteinG}
          />
          <MealPatternChart
            mealTypeDistribution={data.nutrition.mealTypeDistribution}
            topFoods={data.nutrition.topFoods}
            avgMealsPerDay={data.nutrition.avgMealsPerDay}
          />
        </>
      )}
    </div>
  );
}
