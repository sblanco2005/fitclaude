'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DailyNutritionSummary, NutritionLog, UserProfile } from '@/types';
import { ScreenHeader } from '@/components/redesign/ui';

// Screen 13 · Nutrition History — accent: lime
const dayShort = (iso: string) => new Date(iso).toLocaleDateString('en-US', { weekday: 'short' });
const dayFull = (iso: string) => new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
const dateKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA');
const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

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
            {[...sorted].reverse().map((d) => (
              <HistoryDayCard
                key={d.id}
                day={d}
                target={target}
                onDeleted={() => setSummaries((prev) => prev.filter((x) => x.id !== d.id))}
                onCopied={() => router.push('/v2/fuel')}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function HistoryDayCard({ day, target, onDeleted, onCopied }: {
  day: DailyNutritionSummary;
  target: number;
  onDeleted: () => void;
  onCopied: () => void;
}) {
  const over = day.calories > target;
  const [open, setOpen] = useState(false);
  const [meals, setMeals] = useState<NutritionLog[] | null>(null);
  const [loadingMeals, setLoadingMeals] = useState(false);
  const [copyMode, setCopyMode] = useState(false);
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && meals == null) {
      setLoadingMeals(true);
      try {
        const r = await fetch(`/api/nutrition/history?date=${dateKey(day.date)}&tz=${encodeURIComponent(tz())}`);
        setMeals(r.ok ? await r.json() : []);
      } catch {
        setMeals([]);
      } finally {
        setLoadingMeals(false);
      }
    }
  };

  const copy = async (mode: 'append' | 'replace') => {
    setCopying(true);
    try {
      const r = await fetch('/api/nutrition/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateKey(day.date), timezone: tz(), mode }),
      });
      if (r.ok) { setCopied(true); setTimeout(onCopied, 900); }
    } finally {
      setCopying(false);
    }
  };

  const del = async () => {
    try {
      await fetch('/api/nutrition/summaries', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: day.id }) });
      onDeleted();
    } catch { /* ignore */ }
  };

  return (
    <div className="rd-card overflow-hidden">
      <button onClick={toggle} className="flex w-full items-center justify-between p-3.5 text-left">
        <div>
          <p className="text-[14px] font-semibold text-[var(--rd-ink)]">{dayFull(day.date)}</p>
          <p className="font-label mt-0.5 text-[11px] text-[var(--rd-text-faint)]">{day.mealCount} meals · P{Math.round(day.proteinG)} C{Math.round(day.carbsG)} F{Math.round(day.fatG)}</p>
        </div>
        <span className="font-num text-[16px] font-bold" style={{ color: over ? 'var(--rd-ember)' : 'var(--rd-lime)' }}>{Math.round(day.calories).toLocaleString()}</span>
      </button>

      {open && (
        <div className="border-t border-[var(--rd-border)] p-3.5">
          {loadingMeals ? (
            <p className="text-[12px] text-[var(--rd-text-faint)]">Loading meals…</p>
          ) : meals && meals.length > 0 ? (
            <div className="space-y-1.5">
              {meals.map((m) => (
                <div key={m.id} className="flex items-center justify-between">
                  <span className="truncate pr-2 text-[13px] text-[var(--rd-text-secondary)]">{(m.rawInput || 'Meal').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()}</span>
                  <span className="font-label shrink-0 text-[11px] text-[var(--rd-text-faint)]">{Math.round(m.calories ?? 0)} · P{Math.round(m.proteinG ?? 0)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-[var(--rd-text-faint)]">No individual meals found.</p>
          )}

          <div className="mt-3 flex items-center gap-2">
            {copied ? (
              <span className="text-[12px] font-semibold text-[var(--rd-lime)]">Copied to Today!</span>
            ) : copyMode ? (
              <>
                <button onClick={() => copy('append')} disabled={copying} className="flex-1 rounded-[10px] border border-[var(--rd-border)] bg-[var(--rd-card-glass)] py-2 text-[12px] font-semibold text-[var(--rd-text-secondary)]">Add to Today</button>
                <button onClick={() => copy('replace')} disabled={copying} className="grad-lime flex-1 rounded-[10px] py-2 text-[12px] font-semibold text-[#0A0C10]">Replace Today</button>
              </>
            ) : (
              <button onClick={() => setCopyMode(true)} className="flex-1 rounded-[10px] border py-2 text-[12px] font-semibold" style={{ borderColor: 'rgba(200,255,77,.3)', color: 'var(--rd-lime)' }}>Copy all to Today</button>
            )}
            {confirmDel ? (
              <button onClick={del} className="rounded-[10px] border px-3 py-2 text-[12px] font-semibold" style={{ borderColor: 'rgba(255,107,69,.4)', color: 'var(--rd-ember)' }}>Confirm?</button>
            ) : (
              <button onClick={() => setConfirmDel(true)} aria-label="Delete day" className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-[var(--rd-border)] text-[var(--rd-ember)]">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" /></svg>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
