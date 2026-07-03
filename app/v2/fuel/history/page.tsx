'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DailyNutritionSummary, UserProfile } from '@/types';
import { ScreenHeader } from '@/components/redesign/ui';

// Screen 13 · Nutrition History — accent: lime
const dayShort = (iso: string) => new Date(iso).toLocaleDateString('en-US', { weekday: 'short' });
const dayFull = (iso: string) => new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

export default function NutritionHistoryPage() {
  const router = useRouter();
  const [summaries, setSummaries] = useState<DailyNutritionSummary[]>([]);
  const [target, setTarget] = useState(2200);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [s, p] = await Promise.all([
        fetch('/api/nutrition/summaries?daysBack=90').then((r) => (r.ok ? r.json() : [])).catch(() => []),
        fetch('/api/profile').then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);
      setSummaries(Array.isArray(s) ? s : []);
      if ((p as UserProfile)?.dailyCalorieTarget) setTarget((p as UserProfile).dailyCalorieTarget!);
      setLoading(false);
    })();
  }, []);

  const sorted = [...summaries].sort((a, b) => +new Date(a.date) - +new Date(b.date));
  const last7 = sorted.slice(-7);
  const maxCal = Math.max(target, ...last7.map((d) => d.calories), 1);

  return (
    <div className="animate-fadeup space-y-5">
      <ScreenHeader eyebrow="NUTRITION" title="History" back onBack={() => router.push('/v2/fuel')} />

      {/* 7-day trend */}
      <section className="rd-card p-5">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-semibold text-[var(--rd-ink)]">Last 7 days</p>
          <span className="font-label text-[11px] text-[var(--rd-text-faint)]">target {target.toLocaleString()}</span>
        </div>
        {loading ? (
          <div className="mt-4 h-[120px] animate-pulse-soft rounded-[12px] bg-[var(--rd-border)]" />
        ) : last7.length === 0 ? (
          <p className="mt-4 text-center text-[13px] text-[var(--rd-text-faint)]">No closed days yet.</p>
        ) : (
          <div className="mt-4 flex h-[120px] items-end gap-2">
            {last7.map((d) => {
              const over = d.calories > target;
              const h = Math.max(6, (d.calories / maxCal) * 100);
              return (
                <div key={d.id} className="flex flex-1 flex-col items-center gap-1.5">
                  <div className="flex w-full flex-1 items-end">
                    <div
                      className="w-full rounded-t-[6px] transition-[height]"
                      style={{ height: `${h}%`, background: over ? 'var(--rd-ember)' : 'var(--rd-lime)' }}
                    />
                  </div>
                  <span className="font-label text-[9px] text-[var(--rd-text-faint)]">{dayShort(d.date)}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Day archive */}
      <section>
        <p className="font-label mb-2 text-[10px] tracking-[.14em] text-[var(--rd-text-faint)]">ARCHIVE</p>
        {loading ? (
          <div className="space-y-2.5">
            {[0, 1, 2].map((i) => <div key={i} className="rd-card h-[58px] animate-pulse-soft" />)}
          </div>
        ) : sorted.length === 0 ? (
          <div className="rd-card p-6 text-center text-[13px] text-[var(--rd-text-muted)]">Nothing logged yet.</div>
        ) : (
          <div className="space-y-2.5">
            {[...sorted].reverse().map((d) => {
              const over = d.calories > target;
              return (
                <div key={d.id} className="rd-card flex items-center justify-between p-3.5">
                  <div>
                    <p className="text-[14px] font-semibold text-[var(--rd-ink)]">{dayFull(d.date)}</p>
                    <p className="font-label mt-0.5 text-[11px] text-[var(--rd-text-faint)]">
                      {d.mealCount} meals · P{Math.round(d.proteinG)} C{Math.round(d.carbsG)} F{Math.round(d.fatG)}
                    </p>
                  </div>
                  <span className="font-num text-[16px] font-bold" style={{ color: over ? 'var(--rd-ember)' : 'var(--rd-lime)' }}>
                    {Math.round(d.calories).toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
