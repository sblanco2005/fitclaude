'use client';

import React, { useState } from 'react';
import { useFitClaude } from '@/context/FitClaudeContext';
import { CloseIcon } from '@/components/redesign/icons';

// Deterministic program creation — builds the program in code (no LLM in the save
// path). Collects a per-day workout type + equipment and posts to
// /api/program/build.

type Phase = 'form' | 'building' | 'error';

const WEEK_OPTS = [1, 2, 3, 4];
const WD = ['M', 'T', 'W', 'T', 'F', 'S', 'S']; // 0=Mon .. 6=Sun
const WD_FULL = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WORKOUT_TYPES = [
  { k: 'push', l: 'Push' },
  { k: 'pull', l: 'Pull' },
  { k: 'legs', l: 'Legs' },
  { k: 'upper', l: 'Upper' },
  { k: 'lower', l: 'Lower' },
  { k: 'full_body', l: 'Full Body' },
];
const QUICK: { key: string; label: string; rot: string[] }[] = [
  { key: 'ppl', label: 'PPL', rot: ['push', 'pull', 'legs'] },
  { key: 'ul', label: 'Upper / Lower', rot: ['upper', 'lower'] },
  { key: 'fb', label: 'Full Body', rot: ['full_body'] },
];

export function NewProgramSheet({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (newName: string, isActive: boolean) => void;
}) {
  const { bumpDataVersion } = useFitClaude();
  const [phase, setPhase] = useState<Phase>('form');
  const [name, setName] = useState('');
  const [weeks, setWeeks] = useState(1);
  const [days, setDays] = useState<number[]>([0, 2, 4]); // Mon / Wed / Fri
  const [types, setTypes] = useState<Record<number, string>>({ 0: 'push', 2: 'pull', 4: 'legs' });
  const [gymType, setGymType] = useState<'full_gym' | 'own_gym'>('full_gym');
  const [equipment, setEquipment] = useState('');
  const [errMsg, setErrMsg] = useState('');

  const toggleDay = (d: number) =>
    setDays((prev) => {
      const on = prev.includes(d);
      const next = on ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b);
      setTypes((t) => {
        const nt = { ...t };
        if (on) delete nt[d];
        else if (!nt[d]) nt[d] = 'push';
        return nt;
      });
      return next;
    });

  const quickFill = (rot: string[]) =>
    setTypes(() => {
      const nt: Record<number, string> = {};
      days.forEach((d, i) => { nt[d] = rot[i % rot.length]; });
      return nt;
    });

  const create = async () => {
    if (!days.length || phase === 'building') return;
    setPhase('building');
    try {
      const assignments = [...days].sort((a, b) => a - b).map((d) => ({ weekday: d, workoutType: types[d] || 'full_body' }));
      const res = await fetch('/api/program/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          totalWeeks: weeks,
          assignments,
          gymType,
          equipmentText: gymType === 'own_gym' ? equipment.trim() : '',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setErrMsg(data?.error || 'Something went wrong. Please try again.'); setPhase('error'); return; }
      bumpDataVersion();
      onCreated(data?.name || name.trim() || 'New program', !!data?.isActive);
    } catch {
      setErrMsg('Network error. Please try again.');
      setPhase('error');
    }
  };

  const sortedDays = [...days].sort((a, b) => a - b);

  return (
    <div className="absolute inset-0 z-[60] flex items-end" onClick={phase === 'building' ? undefined : onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(4,5,8,.6)', backdropFilter: 'blur(2px)' }} />
      <div className="relative max-h-[90%] w-full overflow-y-auto rounded-t-[24px] border-t border-[var(--rd-border)] p-5 pb-8" style={{ background: '#0F1117' }} onClick={(e) => e.stopPropagation()}>
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
            <p className="mt-2 text-[13px] text-[var(--rd-text-muted)]">Your current program stays saved — switch between them anytime.</p>

            <div className="mt-5 space-y-5">
              {/* Name */}
              <div>
                <label className="font-label text-[10px] tracking-[.14em] text-[var(--rd-text-faint)]">NAME</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Vacation" maxLength={40} className="font-body mt-1.5 w-full rounded-[12px] border border-[var(--rd-border)] bg-[var(--rd-card)] px-3.5 py-3 text-[15px] text-[var(--rd-ink)] placeholder:text-[var(--rd-text-faint)] focus:border-[var(--rd-ember)] focus:outline-none" />
              </div>

              {/* Training days */}
              <div>
                <label className="font-label text-[10px] tracking-[.14em] text-[var(--rd-text-faint)]">TRAINING DAYS</label>
                <div className="mt-1.5 flex gap-1.5">
                  {WD.map((lbl, d) => {
                    const on = days.includes(d);
                    return (
                      <button key={d} onClick={() => toggleDay(d)} className="font-label flex-1 rounded-[11px] border py-2.5 text-[13px] font-bold" style={{ borderColor: on ? 'transparent' : 'var(--rd-border)', background: on ? 'var(--rd-ember)' : 'var(--rd-card-glass)', color: on ? '#0A0C10' : 'var(--rd-text-muted)' }}>{lbl}</button>
                    );
                  })}
                </div>
              </div>

              {/* Per-day workout type */}
              {sortedDays.length > 0 && (
                <div>
                  <div className="flex items-center justify-between">
                    <label className="font-label text-[10px] tracking-[.14em] text-[var(--rd-text-faint)]">WORKOUT PER DAY</label>
                    <div className="flex gap-1">
                      {QUICK.map((q) => (
                        <button key={q.key} onClick={() => quickFill(q.rot)} className="font-label rounded-full border border-[var(--rd-border)] px-2 py-1 text-[10px] font-semibold text-[var(--rd-text-muted)]">{q.label}</button>
                      ))}
                    </div>
                  </div>
                  <div className="mt-2 space-y-2">
                    {sortedDays.map((d) => (
                      <div key={d} className="flex items-center gap-2">
                        <span className="font-label w-9 shrink-0 text-[12px] font-bold text-[var(--rd-ink)]">{WD_FULL[d]}</span>
                        <div className="scrollbar-hide flex flex-1 gap-1.5 overflow-x-auto">
                          {WORKOUT_TYPES.map((wt) => {
                            const on = (types[d] || 'push') === wt.k;
                            return (
                              <button key={wt.k} onClick={() => setTypes((t) => ({ ...t, [d]: wt.k }))} className="font-label shrink-0 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold" style={{ borderColor: on ? 'transparent' : 'var(--rd-border)', background: on ? 'var(--rd-ember)' : 'var(--rd-card-glass)', color: on ? '#0A0C10' : 'var(--rd-text-muted)' }}>{wt.l}</button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="font-label mt-1.5 text-[11px] text-[var(--rd-text-faint)]">Unselected days become rest days.</p>
                </div>
              )}

              {/* Equipment */}
              <div>
                <label className="font-label text-[10px] tracking-[.14em] text-[var(--rd-text-faint)]">EQUIPMENT</label>
                <div className="mt-1.5 flex gap-2">
                  {([['full_gym', 'Full gym'], ['own_gym', 'My own gym']] as const).map(([k, l]) => {
                    const on = gymType === k;
                    return (
                      <button key={k} onClick={() => setGymType(k)} className="flex-1 rounded-[11px] border py-2.5 text-[13px] font-semibold" style={{ borderColor: on ? 'var(--rd-ember)' : 'var(--rd-border)', background: on ? 'rgba(255,107,69,.1)' : 'var(--rd-card-glass)', color: on ? 'var(--rd-ember)' : 'var(--rd-text-muted)' }}>{l}</button>
                    );
                  })}
                </div>
                {gymType === 'own_gym' && (
                  <textarea value={equipment} onChange={(e) => setEquipment(e.target.value)} placeholder="e.g. dumbbells, pull-up bar, bench, resistance bands, kettlebell" rows={2} className="font-body mt-2 w-full resize-none rounded-[12px] border border-[var(--rd-border)] bg-[var(--rd-card)] px-3.5 py-3 text-[14px] text-[var(--rd-ink)] placeholder:text-[var(--rd-text-faint)] focus:border-[var(--rd-ember)] focus:outline-none" />
                )}
              </div>

              {/* Weeks */}
              <div>
                <label className="font-label text-[10px] tracking-[.14em] text-[var(--rd-text-faint)]">WEEKS</label>
                <div className="mt-1.5 flex gap-2">
                  {WEEK_OPTS.map((w) => {
                    const on = w === weeks;
                    return (
                      <button key={w} onClick={() => setWeeks(w)} className="font-label flex-1 rounded-[11px] border py-2.5 text-[13px] font-semibold" style={{ borderColor: on ? 'var(--rd-ember)' : 'var(--rd-border)', background: on ? 'rgba(255,107,69,.1)' : 'var(--rd-card-glass)', color: on ? 'var(--rd-ember)' : 'var(--rd-text-muted)' }}>{w} wk</button>
                    );
                  })}
                </div>
              </div>
            </div>

            <button onClick={create} disabled={!days.length} className="grad-ember mt-6 h-12 w-full rounded-[13px] text-[15px] font-semibold text-[#0A0C10] disabled:opacity-50">Create program</button>
          </>
        )}
      </div>
    </div>
  );
}
