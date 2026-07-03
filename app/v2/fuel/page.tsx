'use client';

import React, { useState } from 'react';
import { MacroBar } from '@/components/redesign/nutrition/MacroBar';
import { useNutrition, type MealItem } from '@/components/redesign/nutrition/useNutrition';
import { ScreenHeader, Pill } from '@/components/redesign/ui';
import { PlusIcon } from '@/components/redesign/icons';

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
  const [input, setInput] = useState('');

  const remaining = n.remaining;
  const over = remaining < 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input;
    setInput('');
    await n.logText(text);
  };

  return (
    <div className="animate-fadeup space-y-5 pb-4">
      <ScreenHeader
        eyebrow={todayLabel()}
        title="Nutrition"
        right={
          <Pill
            color={over ? 'var(--rd-ember)' : 'var(--rd-lime)'}
            tint={over ? 'rgba(255,107,69,.12)' : 'rgba(200,255,77,.12)'}
          >
            {over ? `${Math.abs(remaining)} over` : `${remaining} left`}
          </Pill>
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

      {/* Today's meals */}
      <section>
        <div className="mb-2.5 flex items-center justify-between">
          <p className="text-[13px] font-semibold text-[var(--rd-ink)]">Today&apos;s meals</p>
          <span className="font-label text-[11px] text-[var(--rd-text-faint)]">{n.meals.length} logged</span>
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
