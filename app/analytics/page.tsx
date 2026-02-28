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
import type { AnalyticsData } from '@/types';

export default function AnalyticsPage() {
  const { status } = useSession();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [period, setPeriod] = useState('30d');
  const [loading, setLoading] = useState(true);

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

  const isEmpty = data.totalWorkouts === 0;

  return (
    <div className="p-3 pb-1 space-y-3 max-w-lg mx-auto">
      <h2 className="text-xl font-bold text-white">Analytics</h2>
      <PeriodSelector value={period} onChange={setPeriod} />

      {isEmpty ? (
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
          <VolumeChart data={data.volumeByWeek} />
          <ProgressChart data={data.progressiveOverload} />
          <PersonalRecordsList records={data.personalRecords} />
          <PlateauAlerts plateaus={data.plateaus} />
          <RepRangeChart data={data.repRangeAnalysis} />
          <WeeklyInsightsCard />
        </>
      )}
    </div>
  );
}
