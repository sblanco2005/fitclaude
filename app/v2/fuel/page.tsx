'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { MacroBar } from '@/components/redesign/nutrition/MacroBar';
import { useNutrition, type MealItem } from '@/components/redesign/nutrition/useNutrition';
import { ScreenHeader, Pill } from '@/components/redesign/ui';
import { PlusIcon, BarcodeIcon } from '@/components/redesign/icons';
import { useToast } from '@/components/ui/Toast';

// Screen 04 · Nutrition ("Fuel") — accent: lime
const MEAL_STYLE: Record<string, { letter: string; color: string; tint: string }> = {
  breakfast: { letter: 'B', color: 'var(--rd-amber)', tint: 'rgba(255,178,62,.14)' },
  lunch: { letter: 'L', color: 'var(--rd-ember)', tint: 'rgba(255,107,69,.14)' },
  dinner: { letter: 'D', color: 'var(--rd-violet)', tint: 'rgba(155,123,255,.16)' },
  snack: { letter: 'S', color: 'var(--rd-lime)', tint: 'rgba(200,255,77,.14)' },
};
const mealStyle = (t: string | null) => MEAL_STYLE[t ?? ''] ?? { letter: '•', color: 'var(--rd-text-muted)', tint: 'var(--rd-card-glass)' };

const todayLabel = () =>
  `TODAY · ${new Date().toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase()}`;

export default function FuelPage() {
  const n = useNutrition();
  const { toast } = useToast();
  const [input, setInput] = useState('');

  const remaining = n.remaining;
  const over = remaining < 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input;
    setInput('');
    await n.logText(text);
  };

  const scan = async () => {
    const code = window.prompt('Scan or enter a barcode number');
    if (!code) return;
    const res = await n.logBarcode(code);
    if (res === 'logged') toast('Logged from barcode', 'success');
    else if (res === 'notfound') toast('Product not found', 'error');
    else toast('Could not log that barcode', 'error');
  };

  return (
    <div className="animate-fadeup space-y-5 pb-4">
      <ScreenHeader
        eyebrow={todayLabel()}
        title="Nutrition"
        back
        right={
          <div className="flex items-center gap-2">
            <Pill
              color={over ? 'var(--rd-ember)' : 'var(--rd-lime)'}
              tint={over ? 'rgba(255,107,69,.12)' : 'rgba(200,255,77,.12)'}
            >
              {over ? `${Math.abs(remaining)} over` : `${remaining} left`}
            </Pill>
            <button
              onClick={scan}
              aria-label="Scan barcode"
              className="flex h-[38px] w-[38px] items-center justify-center rounded-[12px] border"
              style={{ borderColor: 'rgba(200,255,77,.24)', background: 'rgba(200,255,77,.08)', color: 'var(--rd-lime)' }}
            >
              <BarcodeIcon size={20} />
            </button>
          </div>
        }
      />

      {/* Oversized counter card */}
      <section className="rd-card p-5">
        <div className="flex items-baseline gap-2">
          <span className="font-num text-[46px] font-bold leading-[.9] tracking-tight text-[var(--rd-ink)]">
            {n.kcal.toLocaleString()}
          </span>
          <span className="font-label text-[13px] text-[var(--rd-text-faint)]">
            / {n.kcalTarget.toLocaleString()} kcal
          </span>
        </div>
        <div className="mt-4">
          <MacroBar proteinG={n.proteinG} carbsG={n.carbsG} fatG={n.fatG} />
        </div>
      </section>

      {/* Weekly deficit */}
      <WeeklyDeficit
        deficit={n.weekDeficit}
        kg={n.weekKg}
        bars={n.weekBars}
        goalPerWeek={-0.5}
      />

      {/* Today's meals */}
      <section>
        <div className="mb-2.5 flex items-center justify-between">
          <p className="text-[13px] font-semibold text-[var(--rd-ink)]">Today&apos;s meals</p>
          <Link href="/v2/fuel/history" className="font-label text-[11px] font-semibold text-[var(--rd-lime)]">
            History
          </Link>
        </div>

        {n.loading ? (
          <div className="space-y-2.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rd-card h-[64px] animate-pulse-soft" />
            ))}
          </div>
        ) : n.meals.length === 0 ? (
          <div className="rd-card p-6 text-center">
            <p className="text-[13px] text-[var(--rd-text-muted)]">No meals logged yet.</p>
            <p className="mt-1 text-[12px] text-[var(--rd-text-faint)]">Type what you ate below to log it.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {n.meals.map((m) => (
              <MealRow key={m.id} meal={m} />
            ))}
          </div>
        )}
      </section>

      {/* Plain-English quick-log bar */}
      <form
        onSubmit={submit}
        className="sticky bottom-2 flex items-center gap-2 rounded-full border border-[var(--rd-border)] bg-[var(--rd-card)] p-1.5 pl-4"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={n.logging ? 'Logging…' : '"a handful of almonds…"'}
          disabled={n.logging}
          className="font-body min-w-0 flex-1 bg-transparent text-[14px] text-[var(--rd-ink)] placeholder:text-[var(--rd-text-faint)] focus:outline-none"
        />
        <button
          type="submit"
          disabled={n.logging || !input.trim()}
          aria-label="Log meal"
          className="grad-lime flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#0A0C10] disabled:opacity-50"
        >
          <PlusIcon size={18} />
        </button>
      </form>
    </div>
  );
}

function MealRow({ meal }: { meal: MealItem }) {
  const s = mealStyle(meal.mealType);
  return (
    <div className="rd-card flex items-center gap-3 p-3.5">
      <span
        className="font-display flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold"
        style={{ background: s.tint, color: s.color }}
      >
        {s.letter}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold text-[var(--rd-ink)]">{meal.name}</p>
        <p className="font-label mt-0.5 text-[11px] text-[var(--rd-text-faint)]">
          P{meal.proteinG} · C{meal.carbsG} · F{meal.fatG}
        </p>
      </div>
      <span className="font-num text-[17px] font-bold text-[var(--rd-ink)]">{meal.calories}</span>
    </div>
  );
}

function WeeklyDeficit({
  deficit,
  kg,
  bars,
  goalPerWeek,
}: {
  deficit: number; // Σ(target−consumed); positive = deficit
  kg: number; // deficit / 7700
  bars: { label: string; magnitude: number; state: 'today' | 'logged' | 'future' }[];
  goalPerWeek: number;
}) {
  const isDeficit = deficit >= 0;
  const netBalance = -deficit; // relative to maintenance
  const changeKg = -kg; // negative = weight lost
  const accent = isDeficit ? 'var(--rd-lime)' : 'var(--rd-ember)';
  const max = Math.max(1, ...bars.map((b) => b.magnitude));
  const sign = (v: number, digits = 0) => `${v > 0 ? '+' : '−'}${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

  return (
    <section
      className="rounded-[20px] border p-4"
      style={{
        borderColor: isDeficit ? 'rgba(200,255,77,.2)' : 'rgba(255,107,69,.22)',
        background: isDeficit ? 'linear-gradient(135deg,rgba(200,255,77,.1),rgba(200,255,77,.02))' : 'linear-gradient(135deg,rgba(255,107,69,.1),rgba(255,107,69,.02))',
      }}
    >
      <div className="flex items-end justify-between">
        <div>
          <p className="font-label text-[10px] tracking-[.1em]" style={{ color: accent }}>
            THIS WEEK · {isDeficit ? 'DEFICIT' : 'SURPLUS'}
          </p>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="font-num text-[28px] font-bold leading-[.9] text-[var(--rd-ink)]">{sign(netBalance)}</span>
            <span className="font-label text-[12px] text-[var(--rd-text-faint)]">kcal</span>
          </div>
        </div>
        <div className="text-right">
          <div className="font-display text-[15px] font-bold" style={{ color: accent }}>
            {sign(changeKg, 2)} kg
          </div>
          <div className="font-label mt-0.5 text-[10px] text-[var(--rd-text-faint)]">goal {sign(goalPerWeek, 1)}/wk</div>
        </div>
      </div>
      <div className="mt-4 flex h-[46px] items-end gap-1.5">
        {bars.map((b, i) => {
          const h = b.state === 'future' ? 30 : Math.max(14, (b.magnitude / max) * 100);
          const bg = b.state === 'today' ? accent : b.state === 'logged' ? accent : 'rgba(200,255,77,.22)';
          return (
            <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex w-full flex-1 items-end">
                <div
                  className="w-full rounded-[4px]"
                  style={{
                    height: `${h}%`,
                    background: b.state === 'logged' ? `color-mix(in srgb, ${accent} 55%, transparent)` : bg,
                    boxShadow: b.state === 'today' ? '0 0 8px rgba(200,255,77,.5)' : undefined,
                  }}
                />
              </div>
              <span className="font-label text-[9px]" style={{ color: b.state === 'today' ? accent : 'var(--rd-text-disabled)' }}>
                {b.label}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
