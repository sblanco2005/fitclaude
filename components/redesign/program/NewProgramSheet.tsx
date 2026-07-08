'use client';

import React, { useState } from 'react';
import { useFitClaude } from '@/context/FitClaudeContext';
import { CloseIcon } from '@/components/redesign/icons';

// Deterministic program creation — builds the program in code (no LLM in the save
// path, since MiniMax won't emit the generate_program tool call). Collects a split
// + training days and posts to /api/program/build.

type Phase = 'form' | 'building' | 'error';

const WEEK_OPTS = [1, 2, 3, 4];
const WD = ['M', 'T', 'W', 'T', 'F', 'S', 'S']; // index 0=Mon .. 6=Sun
const SPLITS: { key: string; label: string; sub: string }[] = [
  { key: 'ppl', label: 'Push / Pull / Legs', sub: 'Rotates push → pull → legs' },
  { key: 'upper_lower', label: 'Upper / Lower', sub: 'Alternates upper and lower' },
  { key: 'full_body', label: 'Full Body', sub: 'Whole body each session' },
];

export function NewProgramSheet({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (newName: string) => void;
}) {
  const { bumpDataVersion } = useFitClaude();
  const [phase, setPhase] = useState<Phase>('form');
  const [name, setName] = useState('');
  const [weeks, setWeeks] = useState(1);
  const [split, setSplit] = useState('ppl');
  const [days, setDays] = useState<number[]>([0, 2, 4]); // Mon / Wed / Fri
  const [errMsg, setErrMsg] = useState('');

  const toggleDay = (d: number) => setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b)));

  const create = async () => {
    if (!days.length || phase === 'building') return;
    setPhase('building');
    try {
      const res = await fetch('/api/program/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), totalWeeks: weeks, splitType: split, trainingDays: days }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrMsg(data?.error || 'Something went wrong. Please try again.');
        setPhase('error');
        return;
      }
      bumpDataVersion();
      onCreated(data?.name || name.trim() || 'New program');
    } catch {
      setErrMsg('Network error. Please try again.');
      setPhase('error');
    }
  };

  return (
    <div className="absolute inset-0 z-[60] flex items-end" onClick={phase === 'building' ? undefined : onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(4,5,8,.6)', backdropFilter: 'blur(2px)' }} />
      <div
        className="relative max-h-[88%] w-full overflow-y-auto rounded-t-[24px] border-t border-[var(--rd-border)] p-5 pb-8"
        style={{ background: '#0F1117' }}
        onClick={(e) => e.stopPropagation()}
      >
        {phase === 'building' ? (
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <span className="grad-ember flex h-12 w-12 items-center justify-center rounded-full text-[#0A0C10]">
              <svg className="animate-spin" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.2-8.5" /></svg>
            </span>
            <p className="font-display text-[17px] font-bold text-[var(--rd-ink)]">Building your program…</p>
          </div>
        ) : phase === 'error' ? (
          <div className="py-4">
            <div className="flex items-start justify-between">
              <h3 className="font-display text-[19px] font-bold text-[var(--rd-ink)]">Couldn&apos;t create it</h3>
              <button onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-[var(--rd-border)] bg-[var(--rd-card-glass)] text-[var(--rd-text-secondary)]"><CloseIcon size={16} /></button>
            </div>
            <p className="mt-3 text-[14px] text-[var(--rd-text-muted)]">{errMsg}</p>
            <button onClick={() => setPhase('form')} className="grad-ember mt-5 h-12 w-full rounded-[13px] text-[15px] font-semibold text-[#0A0C10]">Back</button>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-label text-[10px] tracking-[.14em] text-[var(--rd-ember)]">NEW PROGRAM</p>
                <h3 className="font-display mt-1 text-[20px] font-bold text-[var(--rd-ink)]">Add a program</h3>
              </div>
              <button onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-[var(--rd-border)] bg-[var(--rd-card-glass)] text-[var(--rd-text-secondary)]"><CloseIcon size={16} /></button>
            </div>
            <p className="mt-2 text-[13px] text-[var(--rd-text-muted)]">Your current program stays saved — you can switch between them anytime.</p>

            <div className="mt-5 space-y-5">
              <div>
                <label className="font-label text-[10px] tracking-[.14em] text-[var(--rd-text-faint)]">NAME</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Vacation"
                  maxLength={40}
                  className="font-body mt-1.5 w-full rounded-[12px] border border-[var(--rd-border)] bg-[var(--rd-card)] px-3.5 py-3 text-[15px] text-[var(--rd-ink)] placeholder:text-[var(--rd-text-faint)] focus:border-[var(--rd-ember)] focus:outline-none"
                />
              </div>

              <div>
                <label className="font-label text-[10px] tracking-[.14em] text-[var(--rd-text-faint)]">SPLIT</label>
                <div className="mt-1.5 space-y-2">
                  {SPLITS.map((s) => {
                    const on = s.key === split;
                    return (
                      <button
                        key={s.key}
                        onClick={() => setSplit(s.key)}
                        className="flex w-full items-center justify-between rounded-[12px] border px-3.5 py-3 text-left"
                        style={{ borderColor: on ? 'var(--rd-ember)' : 'var(--rd-border)', background: on ? 'rgba(255,107,69,.08)' : 'var(--rd-card-glass)' }}
                      >
                        <span>
                          <span className="block text-[14px] font-semibold text-[var(--rd-ink)]">{s.label}</span>
                          <span className="font-label block text-[11px] text-[var(--rd-text-faint)]">{s.sub}</span>
                        </span>
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border" style={{ borderColor: on ? 'var(--rd-ember)' : 'var(--rd-border-strong)', background: on ? 'var(--rd-ember)' : 'transparent' }}>
                          {on && <span className="h-2 w-2 rounded-full bg-[#0A0C10]" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="font-label text-[10px] tracking-[.14em] text-[var(--rd-text-faint)]">TRAINING DAYS</label>
                <div className="mt-1.5 flex gap-1.5">
                  {WD.map((lbl, d) => {
                    const on = days.includes(d);
                    return (
                      <button
                        key={d}
                        onClick={() => toggleDay(d)}
                        className="font-label flex-1 rounded-[11px] border py-2.5 text-[13px] font-bold"
                        style={{ borderColor: on ? 'transparent' : 'var(--rd-border)', background: on ? 'var(--rd-ember)' : 'var(--rd-card-glass)', color: on ? '#0A0C10' : 'var(--rd-text-muted)' }}
                      >
                        {lbl}
                      </button>
                    );
                  })}
                </div>
                <p className="font-label mt-1.5 text-[11px] text-[var(--rd-text-faint)]">Unselected days become rest days.</p>
              </div>

              <div>
                <label className="font-label text-[10px] tracking-[.14em] text-[var(--rd-text-faint)]">WEEKS</label>
                <div className="mt-1.5 flex gap-2">
                  {WEEK_OPTS.map((w) => {
                    const on = w === weeks;
                    return (
                      <button
                        key={w}
                        onClick={() => setWeeks(w)}
                        className="font-label flex-1 rounded-[11px] border py-2.5 text-[13px] font-semibold"
                        style={{ borderColor: on ? 'var(--rd-ember)' : 'var(--rd-border)', background: on ? 'rgba(255,107,69,.1)' : 'var(--rd-card-glass)', color: on ? 'var(--rd-ember)' : 'var(--rd-text-muted)' }}
                      >
                        {w} wk
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <button
              onClick={create}
              disabled={!days.length}
              className="grad-ember mt-6 h-12 w-full rounded-[13px] text-[15px] font-semibold text-[#0A0C10] disabled:opacity-50"
            >
              Create program
            </button>
          </>
        )}
      </div>
    </div>
  );
}
