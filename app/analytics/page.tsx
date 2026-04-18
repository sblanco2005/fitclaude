'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { PeriodSelector } from '@/components/analytics/PeriodSelector';
import { MusclesWorkedCard } from '@/components/analytics/MusclesWorkedCard';
import { NutritionSummaryCards } from '@/components/analytics/NutritionSummaryCards';
import { CalorieTrendChart } from '@/components/analytics/CalorieTrendChart';
import { MacroChart } from '@/components/analytics/MacroChart';
import { ComplianceCards } from '@/components/analytics/ComplianceCards';
import { MealPatternChart } from '@/components/analytics/MealPatternChart';
import type { AnalyticsData } from '@/types';

// MEV (Minimum Effective Volume) thresholds in sets/week
const MEV: Record<string, number> = {
  chest: 10, back: 10, shoulders: 8, biceps: 8, triceps: 8,
  quadriceps: 10, hamstrings: 10, glutes: 10, core: 8, calves: 8,
  forearms: 6, legs: 10,
};
const MEV_DEFAULT = 8;

function muscleLabel(mg: string): string {
  const labels: Record<string, string> = {
    chest: 'Chest', back: 'Back', shoulders: 'Shoulders', biceps: 'Biceps',
    triceps: 'Triceps', quadriceps: 'Quads', hamstrings: 'Hamstrings', glutes: 'Glutes',
    core: 'Core', calves: 'Calves', forearms: 'Forearms', legs: 'Legs',
    arms: 'Arms', posterior_chain: 'Posterior', full_body: 'Full Body',
  };
  return labels[mg] ?? mg.charAt(0).toUpperCase() + mg.slice(1);
}

function fmtVolume(lbs: number): string {
  if (lbs >= 1000) return `${(lbs / 1000).toFixed(1)}K`;
  return `${lbs}`;
}

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function fmtDuration(mins: number | null): string {
  if (!mins) return '—';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function deriveFocus(name: string, notes: string | null): string {
  if (notes) return notes.slice(0, 20);
  const n = name.toLowerCase();
  if (n.includes('alpha x') || n.includes('alphax')) return 'legs + cond';
  if (n.includes('alpha fit') || n.includes('alphafit')) return 'full body';
  if (n.includes('upper')) return 'upper body';
  if (n.includes('lower')) return 'lower body';
  if (n.includes('run') || n.includes('cardio')) return 'cardio';
  return '—';
}

function weekStartLabel(sessions: { date: string }[]): string {
  if (!sessions.length) return '';
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  const d = new Date(sorted[0].date + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getVolumeColor(sets: number, mev: number): { bar: string; text: string; num: string } {
  const ratio = sets / mev;
  if (ratio >= 0.8) return { bar: '#1D9E75', text: 'text-slate-400', num: 'text-slate-400' };
  if (ratio >= 0.5) return { bar: '#BA7517', text: 'text-amber-500', num: 'text-amber-500' };
  return { bar: '#E24B4A', text: 'text-red-500', num: 'text-red-500' };
}

export default function AnalyticsPage() {
  const { status } = useSession();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [period, setPeriod] = useState('week');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'training' | 'nutrition'>('training');

  useEffect(() => {
    if (status !== 'authenticated') return;
    setLoading(true);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    fetch(`/api/analytics?period=${period}&tz=${encodeURIComponent(tz)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [status, period]);

  // Auto-generated TL;DR
  const tldr = useMemo(() => {
    if (!data || (!data.sessions.length && !data.conditioningActivities.length)) return null;
    const { sessions, conditioningActivities, totalVolume, personalRecords, setsByMuscle, period: p } = data;
    const periodStr = p === 'week' ? 'this week' : 'in this period';

    // PRs this period
    const prThisPeriod = personalRecords.filter(pr => {
      if (!sessions.length) return false;
      const latestSessionDate = [...sessions].sort((a, b) => b.date.localeCompare(a.date))[0].date;
      const weekAgo = new Date(latestSessionDate + 'T12:00:00Z');
      weekAgo.setDate(weekAgo.getDate() - 7);
      return new Date(pr.prDate) >= weekAgo;
    });

    // Muscles below MEV
    const muscleGaps = setsByMuscle
      .filter(m => {
        const mev = MEV[m.muscleGroup] ?? MEV_DEFAULT;
        return m.sets < mev * 0.5;
      })
      .slice(0, 2)
      .map(m => muscleLabel(m.muscleGroup));

    const parts: string[] = [];
    if (sessions.length) parts.push(`${sessions.length} lifting session${sessions.length !== 1 ? 's' : ''} (${fmtVolume(totalVolume)} lb)`);
    if (conditioningActivities.length) {
      const totalMins = conditioningActivities.reduce((s, a) => s + (a.durationMinutes ?? 0), 0);
      parts.push(`${conditioningActivities.length} class${conditioningActivities.length !== 1 ? 'es' : ''} (~${fmtDuration(totalMins)} conditioning)`);
    }
    const base = parts.join(' + ') + '.';
    const prStr = prThisPeriod.length
      ? ` Hit ${prThisPeriod.slice(0, 2).map(pr => `${pr.exerciseName} PR (${pr.prWeight}×${pr.prReps})`).join(' and ')}.`
      : '';
    const gapStr = muscleGaps.length
      ? ` ${muscleGaps.join(' and ')} below minimum volume ${periodStr}.`
      : '';

    return base + prStr + gapStr;
  }, [data]);

  // Auto-generated flags
  const flags = useMemo(() => {
    if (!data) return [];
    const result: string[] = [];
    const { setsByMuscle, plateaus, keyLifts, restDays, sessions, conditioningActivities } = data;

    // Zero rest days
    const totalLoad = sessions.length + conditioningActivities.length;
    if (restDays === 0 && totalLoad >= 5) {
      result.push(`Zero rest days this week — ${totalLoad} total sessions. Intentional push, or schedule recovery?`);
    }

    // Push:pull balance
    const pushMuscles = ['chest', 'shoulders', 'triceps'];
    const pullMuscles = ['back', 'biceps'];
    const pushSets = setsByMuscle.filter(m => pushMuscles.includes(m.muscleGroup)).reduce((s, m) => s + m.sets, 0);
    const pullSets = setsByMuscle.filter(m => pullMuscles.includes(m.muscleGroup)).reduce((s, m) => s + m.sets, 0);
    if (pullSets > 0 && pushSets / pullSets > 1.5) {
      result.push(`Push:pull ratio is ${(pushSets / pullSets).toFixed(1)} — consider adding a pull session.`);
    }

    // Low-volume muscle groups (from lifting only — classes may cover some)
    const lowMuscles = setsByMuscle.filter(m => {
      const mev = MEV[m.muscleGroup] ?? MEV_DEFAULT;
      return m.sets > 0 && m.sets < mev * 0.5;
    });
    if (lowMuscles.length) {
      const classNote = conditioningActivities.length ? ' (classes may partly cover this)' : '';
      result.push(`${lowMuscles.map(m => muscleLabel(m.muscleGroup)).join(', ')} below minimum lifting volume${classNote}.`);
    }

    // Plateau exercises
    if (plateaus.length) {
      const names = plateaus.slice(0, 2).map(p => p.exerciseName).join(' and ');
      result.push(`${names} ${plateaus.length === 1 ? 'has' : 'have'} stalled — consider deload or variation.`);
    }

    // Declining key lifts
    const declining = keyLifts.filter(l => l.deltaPercent !== null && l.deltaPercent < -3);
    if (declining.length) {
      result.push(`${declining[0].exerciseName} e1RM down ${Math.abs(declining[0].deltaPercent!).toFixed(1)}% — fatigue or technique?`);
    }

    // High-RPE class on consecutive days with heavy lifting
    const highRpeClasses = conditioningActivities.filter(a => a.notes?.toLowerCase().includes('hard') || false);
    if (highRpeClasses.length > 0 && sessions.length >= 3) {
      result.push(`${highRpeClasses.length} high-intensity class${highRpeClasses.length !== 1 ? 'es' : ''} combined with ${sessions.length} lifting sessions — monitor recovery.`);
    }

    return result;
  }, [data]);

  if (status === 'loading' || loading) {
    return (
      <div className="p-3 space-y-3 max-w-lg mx-auto">
        <h2 className="text-xl font-bold text-white">Analytics</h2>
        <PeriodSelector value={period} onChange={setPeriod} />
        <div className="bg-card border border-border-dark rounded-xl h-[400px] animate-pulse" />
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
          <button onClick={() => setPeriod(period)} className="text-sm text-primary hover:underline">
            Try again
          </button>
        </div>
      </div>
    );
  }

  const isTrainingEmpty = data.totalWorkouts === 0 && data.conditioningActivities.length === 0;
  const isNutritionEmpty = !data.nutrition || data.nutrition.daysLogged === 0;
  const weekStart = weekStartLabel(data.sessions);
  const maxSets = data.setsByMuscle.length ? data.setsByMuscle[0].sets : 1;
  const totalCondMins = data.conditioningActivities.reduce((s, a) => s + (a.durationMinutes ?? 0), 0);

  return (
    <div className="p-3 pb-1 space-y-3 max-w-lg mx-auto">
      <h2 className="text-xl font-bold text-white">Analytics</h2>
      <PeriodSelector value={period} onChange={setPeriod} />

      {/* Tab switcher */}
      <div className="flex gap-1 bg-[#111118] rounded-lg p-0.5">
        <button
          onClick={() => setTab('training')}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
            tab === 'training' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          Training
        </button>
        <button
          onClick={() => setTab('nutrition')}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
            tab === 'nutrition' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-300'
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
          <div className="bg-card border border-border-dark rounded-xl overflow-hidden">
            {/* Email-style header */}
            <div className="px-4 pt-4 pb-3 border-b border-border-dark">
              <p className="text-[10px] text-slate-500 tracking-widest uppercase mb-1">
                WEEKLY REPORT · {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}
              </p>
              <p className="text-sm font-medium text-white leading-snug">
                {weekStart ? `Week of ${weekStart}` : 'This period'} —{' '}
                {data.totalWorkouts > 0 && `${data.totalWorkouts} lift${data.totalWorkouts !== 1 ? 's' : ''}`}
                {data.totalWorkouts > 0 && data.conditioningActivities.length > 0 && ' + '}
                {data.conditioningActivities.length > 0 && `${data.conditioningActivities.length} class${data.conditioningActivities.length !== 1 ? 'es' : ''}`}
                {',\u00A0'}
                {data.personalRecords.length > 0 ? `${data.personalRecords.length} PRs` : 'no new PRs'}
              </p>
            </div>

            <div className="p-4 space-y-5">
              {/* TL;DR */}
              {tldr && (
                <div className="bg-[#0d1b2e] rounded-lg p-3 border-l-2 border-blue-500">
                  <p className="text-[10px] font-semibold text-blue-400 tracking-widest uppercase mb-1.5">TL;DR</p>
                  <p className="text-xs text-slate-300 leading-relaxed">{tldr}</p>
                </div>
              )}

              {/* WHAT HAPPENED */}
              <div>
                <p className="text-[10px] font-semibold text-slate-400 tracking-widest uppercase mb-2">What Happened</p>
                <div className="space-y-1.5">
                  {data.sessions.map((sess, i) => (
                    <div key={i} className="grid gap-2 text-xs" style={{ gridTemplateColumns: '84px 1fr auto' }}>
                      <span className="text-slate-500">{fmtDate(sess.date)}</span>
                      <span className="text-slate-200 truncate">{sess.name} · {sess.exerciseCount} lifts</span>
                      <span className="text-slate-500 whitespace-nowrap">
                        {sess.fatigueRating != null ? `RPE ${sess.fatigueRating.toFixed(1)}` : `${fmtVolume(sess.volume)} lb`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* CONDITIONING / CLASSES */}
              {data.conditioningActivities.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 tracking-widest uppercase mb-2">
                    Conditioning / Classes — {data.conditioningActivities.length}
                  </p>
                  <div className="bg-[#111118] rounded-lg p-3">
                    {/* Header */}
                    <div className="grid gap-2 text-[10px] text-slate-500 pb-2 border-b border-border-dark mb-2"
                      style={{ gridTemplateColumns: '84px 1fr 60px 44px' }}>
                      <span>Day</span><span>Class</span><span>Focus</span><span className="text-right">Dur</span>
                    </div>
                    <div className="space-y-1.5">
                      {data.conditioningActivities.map((a, i) => (
                        <div key={i} className="grid gap-2 text-xs items-baseline"
                          style={{ gridTemplateColumns: '84px 1fr 60px 44px' }}>
                          <span className="text-slate-500">{fmtDate(a.date)}</span>
                          <span className="text-slate-200 truncate">{a.name}</span>
                          <span className="text-slate-500 truncate text-[11px]">{deriveFocus(a.name, a.notes)}</span>
                          <span className="text-right text-slate-400">{fmtDuration(a.durationMinutes)}</span>
                        </div>
                      ))}
                    </div>
                    {totalCondMins > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-border-dark flex justify-between text-[10px] text-slate-500">
                        <span>Total class time: {fmtDuration(totalCondMins)}</span>
                        <span>{data.conditioningActivities.length} session{data.conditioningActivities.length !== 1 ? 's' : ''}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* COMBINED LOAD */}
              {(data.sessions.length > 0 || data.conditioningActivities.length > 0) && (
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 tracking-widest uppercase mb-2">Combined Load</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-[#111118] rounded-lg p-3">
                      <p className="text-[10px] text-slate-500 mb-1">Strength</p>
                      <p className="text-base font-semibold text-white">{data.sessions.length}</p>
                      <p className="text-[10px] text-slate-500">sessions</p>
                    </div>
                    <div className="bg-[#111118] rounded-lg p-3">
                      <p className="text-[10px] text-slate-500 mb-1">Conditioning</p>
                      <p className="text-base font-semibold text-white">{data.conditioningActivities.length}</p>
                      <p className="text-[10px] text-slate-500">classes</p>
                    </div>
                    <div className="bg-[#111118] rounded-lg p-3">
                      <p className="text-[10px] text-slate-500 mb-1">Rest days</p>
                      <p className={`text-base font-semibold ${data.restDays === 0 ? 'text-amber-400' : 'text-white'}`}>
                        {data.restDays}
                      </p>
                      <p className="text-[10px] text-slate-500">days</p>
                    </div>
                  </div>
                </div>
              )}

              {/* KEY LIFTS */}
              {data.keyLifts.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 tracking-widest uppercase mb-2">Key Lifts</p>
                  <div className="bg-[#111118] rounded-lg p-3">
                    {/* Header row */}
                    <div className="grid gap-2 text-[10px] text-slate-500 pb-2 border-b border-border-dark mb-2"
                      style={{ gridTemplateColumns: '1fr 72px 56px 44px' }}>
                      <span>Lift</span>
                      <span>Top set</span>
                      <span>e1RM</span>
                      <span className="text-right">Δ</span>
                    </div>
                    <div className="space-y-1.5">
                      {data.keyLifts.map((lift, i) => {
                        const delta = lift.deltaPercent;
                        const deltaColor = delta == null
                          ? 'text-slate-500'
                          : delta > 1 ? 'text-emerald-400' : delta < -1 ? 'text-red-400' : 'text-slate-500';
                        const deltaStr = delta == null
                          ? '—'
                          : Math.abs(delta) < 1 ? 'flat'
                          : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%`;
                        return (
                          <div key={i} className="grid gap-2 text-xs" style={{ gridTemplateColumns: '1fr 72px 56px 44px' }}>
                            <span className="text-slate-200 truncate">{lift.exerciseName}</span>
                            <span className="text-slate-400">{lift.topSet.weight}×{lift.topSet.reps}</span>
                            <span className="text-slate-300">{lift.e1rm}</span>
                            <span className={`text-right font-medium ${deltaColor}`}>{deltaStr}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* VOLUME BY MUSCLE */}
              {data.setsByMuscle.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 tracking-widest uppercase mb-2">Volume</p>
                  <div className="space-y-1.5">
                    {data.setsByMuscle.map((m, i) => {
                      const mev = MEV[m.muscleGroup] ?? MEV_DEFAULT;
                      const { bar, num } = getVolumeColor(m.sets, mev);
                      const barWidth = Math.min(100, Math.round((m.sets / Math.max(maxSets, 1)) * 100));
                      return (
                        <div key={i} className="grid gap-2 text-xs items-center" style={{ gridTemplateColumns: '88px 1fr 44px' }}>
                          <span className="text-slate-300">{muscleLabel(m.muscleGroup)}</span>
                          <div className="h-1.5 bg-[#111118] rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${barWidth}%`, background: bar }} />
                          </div>
                          <span className={`text-right font-medium text-[11px] ${num}`}>{m.sets}s</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* FLAGS */}
              {flags.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 tracking-widest uppercase mb-2">Flags</p>
                  <div className="bg-amber-950/40 rounded-lg p-3 border-l-2 border-amber-500">
                    <ul className="space-y-1 text-xs text-amber-200/80 list-disc list-inside leading-relaxed">
                      {flags.map((f, i) => <li key={i}>{f}</li>)}
                    </ul>
                  </div>
                </div>
              )}

              {/* MUSCLES WORKED (Arnold anatomy) */}
              <div>
                <p className="text-[10px] font-semibold text-slate-400 tracking-widest uppercase mb-2">Muscles Worked</p>
                <MusclesWorkedCard musclesWorked={data.musclesWorked || []} />
              </div>
            </div>
          </div>
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
          <CalorieTrendChart data={data.nutrition.caloriesByDay} target={data.nutrition.targets.calories} />
          <MacroChart
            data={data.nutrition.macrosByDay}
            targets={{ proteinG: data.nutrition.targets.proteinG, carbsG: data.nutrition.targets.carbsG, fatG: data.nutrition.targets.fatG }}
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
