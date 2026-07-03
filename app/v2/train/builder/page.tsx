'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ScreenHeader } from '@/components/redesign/ui';
import { MinusIcon, PlusIcon } from '@/components/redesign/icons';

// Screen 15 · Program Builder — accent: lime
// Persists through the real program-creation path (the coach chat tool),
// since there is no direct "create custom program" REST endpoint.
export default function ProgramBuilderPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [weeks, setWeeks] = useState(4);
  const [days, setDays] = useState(4);
  const [split, setSplit] = useState<string[]>(['Push', 'Pull', 'Legs', 'Upper', 'Lower', 'Full body']);
  const [creating, setCreating] = useState(false);

  const setDayLabel = (i: number, v: string) =>
    setSplit((prev) => prev.map((d, j) => (j === i ? v : d)));

  const create = async () => {
    setCreating(true);
    const dayList = split.slice(0, days).map((d, i) => `Day ${i + 1}: ${d || 'training'}`).join(', ');
    const msg = `Build me a ${weeks}-week training program${name ? ` called "${name}"` : ''} with ${days} training days per week. Split: ${dayList}. Create the program and its routines.`;
    try {
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, topic: 'workout', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      });
    } finally {
      setCreating(false);
      router.push('/v2');
    }
  };

  return (
    <div className="animate-fadeup space-y-5 pb-4">
      <ScreenHeader title="Build program" back onBack={() => router.push('/v2/train/add')} />

      {/* Name */}
      <Field label="PROGRAM NAME">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Summer Push/Pull/Legs"
          className="font-body w-full rounded-[13px] border border-[var(--rd-border)] bg-[var(--rd-card-glass)] px-4 py-3 text-[14px] text-[var(--rd-ink)] placeholder:text-[var(--rd-text-faint)] focus:outline-none"
        />
      </Field>

      {/* Weeks + days */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="LENGTH (WEEKS)">
          <Counter value={weeks} min={1} max={16} onChange={setWeeks} />
        </Field>
        <Field label="DAYS / WEEK">
          <Counter value={days} min={1} max={6} onChange={setDays} />
        </Field>
      </div>

      {/* Per-day split */}
      <Field label="SPLIT">
        <div className="space-y-2">
          {Array.from({ length: days }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-[13px] border border-[var(--rd-border)] bg-[var(--rd-card-glass)] px-3 py-2">
              <span className="font-num flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--rd-card)] text-[12px] font-bold text-[var(--rd-lime)]">
                {i + 1}
              </span>
              <input
                value={split[i] ?? ''}
                onChange={(e) => setDayLabel(i, e.target.value)}
                placeholder={`Day ${i + 1} focus`}
                className="font-body min-w-0 flex-1 bg-transparent text-[14px] text-[var(--rd-ink)] placeholder:text-[var(--rd-text-faint)] focus:outline-none"
              />
            </div>
          ))}
        </div>
      </Field>

      <button
        onClick={create}
        disabled={creating}
        className="grad-lime flex h-12 w-full items-center justify-center rounded-[13px] text-[15px] font-semibold text-[#0A0C10] disabled:opacity-60"
        style={{ boxShadow: 'var(--rd-glow-lime)' }}
      >
        {creating ? 'Creating…' : 'Create program'}
      </button>
      <p className="text-center text-[11px] text-[var(--rd-text-faint)]">
        Your coach builds the routines for each day.
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-label mb-2 text-[10px] tracking-[.14em] text-[var(--rd-text-faint)]">{label}</p>
      {children}
    </div>
  );
}

function Counter({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between rounded-[13px] border border-[var(--rd-border)] bg-[var(--rd-card-glass)] p-1.5">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[var(--rd-card)] text-[var(--rd-ink)]"
        aria-label="Decrease"
      >
        <MinusIcon size={16} />
      </button>
      <span className="font-num text-[19px] font-bold text-[var(--rd-ink)]">{value}</span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[var(--rd-card)] text-[var(--rd-ink)]"
        aria-label="Increase"
      >
        <PlusIcon size={16} />
      </button>
    </div>
  );
}
