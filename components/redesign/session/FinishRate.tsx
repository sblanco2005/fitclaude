'use client';

import React, { useState } from 'react';
import { CheckIcon } from '@/components/redesign/icons';

// Screen 11 · Finish & Rate — accent: lime
const FATIGUE = ['Easy', 'Light', 'Solid', 'Hard', 'Brutal'];

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function FinishRate({
  name,
  elapsedSec,
  volumeKg,
  setsLogged,
  exercises,
  saving,
  onSave,
  onDiscard,
}: {
  name: string;
  elapsedSec: number;
  volumeKg: number;
  setsLogged: number;
  exercises: number;
  saving: boolean;
  onSave: (fatigue: number | null, note: string) => void;
  onDiscard: () => void;
}) {
  const [fatigue, setFatigue] = useState<number | null>(3); // default "Hard"
  const [note, setNote] = useState('');

  const tiles = [
    { v: fmt(elapsedSec), label: 'DURATION', color: 'var(--rd-ink)' },
    { v: `${volumeKg.toLocaleString()} kg`, label: 'TOTAL VOLUME', color: 'var(--rd-ink)' },
    { v: String(setsLogged), label: 'SETS LOGGED', color: 'var(--rd-ink)' },
    { v: String(exercises), label: 'EXERCISES', color: 'var(--rd-lime)' },
  ];

  return (
    <div className="animate-fadeup flex min-h-full flex-col pb-4">
      {/* Success badge */}
      <div className="flex flex-col items-center pt-6 text-center">
        <span
          className="grad-lime animate-floaty flex h-16 w-16 items-center justify-center rounded-full text-[#0A0C10]"
          style={{ boxShadow: 'var(--rd-glow-lime)' }}
        >
          <CheckIcon size={30} />
        </span>
        <h1 className="font-display mt-4 text-[24px] font-bold text-[var(--rd-ink)]">Workout complete</h1>
        <p className="mt-1 text-[13px] text-[var(--rd-text-muted)]">
          {name} · finished in {fmt(elapsedSec)}
        </p>
      </div>

      {/* Stat grid */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="rd-card p-4">
            <div className="font-num text-[22px] font-bold" style={{ color: t.color }}>{t.v}</div>
            <div className="font-label mt-1 text-[9px] tracking-[.14em] text-[var(--rd-text-faint)]">{t.label}</div>
          </div>
        ))}
      </div>

      {/* Fatigue scale */}
      <div className="mt-6">
        <p className="text-[14px] font-semibold text-[var(--rd-ink)]">How did that feel?</p>
        <div className="mt-3 flex gap-2">
          {FATIGUE.map((f, i) => {
            const active = fatigue === i;
            return (
              <button
                key={f}
                onClick={() => setFatigue(i)}
                className="font-label flex-1 rounded-[11px] border py-2.5 text-[11px] font-semibold transition-colors"
                style={{
                  borderColor: active ? 'transparent' : 'var(--rd-border)',
                  background: active ? 'var(--rd-ember)' : 'var(--rd-card-glass)',
                  color: active ? '#0A0C10' : 'var(--rd-text-muted)',
                }}
              >
                {f}
              </button>
            );
          })}
        </div>
      </div>

      {/* Note for coach */}
      <div className="mt-5">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note for your coach (optional)…"
          rows={3}
          className="font-body w-full resize-none rounded-[14px] border border-[var(--rd-border)] bg-[var(--rd-card-glass)] p-3.5 text-[14px] text-[var(--rd-ink)] placeholder:text-[var(--rd-text-faint)] focus:outline-none"
        />
      </div>

      {/* Actions */}
      <div className="mt-auto pt-5">
        <button
          onClick={() => onSave(fatigue, note)}
          disabled={saving}
          className="grad-lime flex h-12 w-full items-center justify-center rounded-[13px] text-[15px] font-semibold text-[#0A0C10] disabled:opacity-60"
          style={{ boxShadow: 'var(--rd-glow-lime)' }}
        >
          {saving ? 'Saving…' : 'Save workout'}
        </button>
        <button onClick={onDiscard} disabled={saving} className="mt-2 w-full py-2 text-[13px] text-[var(--rd-text-faint)]">
          Discard
        </button>
      </div>
    </div>
  );
}
