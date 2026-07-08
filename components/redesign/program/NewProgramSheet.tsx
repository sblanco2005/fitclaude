'use client';

import React, { useState } from 'react';
import { useFitClaude } from '@/context/FitClaudeContext';
import { CloseIcon } from '@/components/redesign/icons';

// Deterministic program creation — builds the program in code (no LLM). Collects
// a free-text focus per training day, optionally per week, plus equipment, and
// posts to /api/program/build.

type Phase = 'form' | 'building' | 'error';

const WEEK_OPTS = [1, 2, 3, 4];
const WD = ['M', 'T', 'W', 'T', 'F', 'S', 'S']; // 0=Mon .. 6=Sun
const WD_FULL = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const QUICK: { key: string; label: string; rot: string[] }[] = [
  { key: 'ppl', label: 'PPL', rot: ['Push', 'Pull', 'Legs'] },
  { key: 'ul', label: 'Upper / Lower', rot: ['Upper', 'Lower'] },
  { key: 'fb', label: 'Full Body', rot: ['Full Body'] },
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
  // week (1-based) -> weekday -> focus text
  const [weekFocus, setWeekFocus] = useState<Record<number, Record<number, string>>>({ 1: { 0: 'Push', 2: 'Pull', 4: 'Legs' } });
  const [sameEveryWeek, setSameEveryWeek] = useState(true);
  const [editWeek, setEditWeek] = useState(1);
  const [gymType, setGymType] = useState<'full_gym' | 'own_gym'>('full_gym');
  const [equipment, setEquipment] = useState('');
  const [errMsg, setErrMsg] = useState('');

  const sortedDays = [...days].sort((a, b) => a - b);
  const curWeek = sameEveryWeek ? 1 : editWeek;
  // Value for an input: this week's focus, falling back to week 1 as the default.
  const focusVal = (d: number) => weekFocus[curWeek]?.[d] ?? (curWeek !== 1 ? weekFocus[1]?.[d] : undefined) ?? '';

  const setFocus = (d: number, val: string) =>
    setWeekFocus((prev) => ({ ...prev, [curWeek]: { ...(prev[curWeek] ?? {}), [d]: val } }));

  const toggleDay = (d: number) =>
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b)));

  const quickFill = (rot: string[]) =>
    setWeekFocus((prev) => {
      const wf: Record<number, string> = {};
      sortedDays.forEach((d, i) => { wf[d] = rot[i % rot.length]; });
      return { ...prev, [curWeek]: wf };
    });

  const create = async () => {
    if (!days.length || phase === 'building') return;
    setPhase('building');
    try {
      const assignments: { weekday: number; weekNumber?: number; focus: string }[] = [];
      const focusFor = (w: number, d: number) => (weekFocus[w]?.[d] ?? weekFocus[1]?.[d] ?? '').trim() || 'Full Body';
      if (sameEveryWeek || weeks === 1) {
        sortedDays.forEach((d) => assignments.push({ weekday: d, focus: focusFor(1, d) }));
      } else {
        for (let w = 1; w <= weeks; w++) sortedDays.forEach((d) => assignments.push({ weekday: d, weekNumber: w, focus: focusFor(w, d) }));
      }
      const res = await fetch('/api/program/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), totalWeeks: weeks, assignments, gymType, equipmentText: gymType === 'own_gym' ? equipment.trim() : '' }),
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

              {/* Weeks */}
              <div>
                <label className="font-label text-[10px] tracking-[.14em] text-[var(--rd-text-faint)]">WEEKS</label>
                <div className="mt-1.5 flex gap-2">
                  {WEEK_OPTS.map((wk) => {
                    const on = wk === weeks;
                    return (
                      <button key={wk} onClick={() => { setWeeks(wk); if (wk === 1) { setSameEveryWeek(true); setEditWeek(1); } else if (editWeek > wk) setEditWeek(1); }} className="font-label flex-1 rounded-[11px] border py-2.5 text-[13px] font-semibold" style={{ borderColor: on ? 'var(--rd-ember)' : 'var(--rd-border)', background: on ? 'rgba(255,107,69,.1)' : 'var(--rd-card-glass)', color: on ? 'var(--rd-ember)' : 'var(--rd-text-muted)' }}>{wk} wk</button>
                    );
                  })}
                </div>
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

              {/* Per-day (optionally per-week) focus */}
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

                  {/* Same-every-week toggle + week tabs */}
                  {weeks > 1 && (
                    <div className="mt-2">
                      <button onClick={() => setSameEveryWeek((v) => !v)} className="flex items-center gap-2">
                        <span className="flex h-4 w-4 items-center justify-center rounded-[5px] border" style={{ borderColor: sameEveryWeek ? 'var(--rd-ember)' : 'var(--rd-border-strong)', background: sameEveryWeek ? 'var(--rd-ember)' : 'transparent', color: '#0A0C10' }}>
                          {sameEveryWeek && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}
                        </span>
                        <span className="text-[13px] font-medium text-[var(--rd-text-secondary)]">Same every week</span>
                      </button>
                      {!sameEveryWeek && (
                        <div className="mt-2 flex gap-2">
                          {Array.from({ length: weeks }, (_, i) => i + 1).map((wk) => {
                            const on = wk === editWeek;
                            return (
                              <button key={wk} onClick={() => setEditWeek(wk)} className="font-label flex-1 rounded-[10px] border py-1.5 text-[12px] font-semibold" style={{ borderColor: on ? 'var(--rd-ember)' : 'var(--rd-border)', background: on ? 'rgba(255,107,69,.1)' : 'var(--rd-card-glass)', color: on ? 'var(--rd-ember)' : 'var(--rd-text-muted)' }}>Wk {wk}</button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-2 space-y-2">
                    {sortedDays.map((d) => (
                      <div key={`${curWeek}-${d}`} className="flex items-center gap-2">
                        <span className="font-label w-9 shrink-0 text-[12px] font-bold text-[var(--rd-ink)]">{WD_FULL[d]}</span>
                        <input
                          value={focusVal(d)}
                          onChange={(e) => setFocus(d, e.target.value)}
                          placeholder="e.g. Push & Pull, Deadlifts & Back"
                          maxLength={60}
                          className="font-body min-w-0 flex-1 rounded-[11px] border border-[var(--rd-border)] bg-[var(--rd-card)] px-3 py-2.5 text-[14px] text-[var(--rd-ink)] placeholder:text-[var(--rd-text-faint)] focus:border-[var(--rd-ember)] focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                  <p className="font-label mt-1.5 text-[11px] text-[var(--rd-text-faint)]">
                    {weeks > 1 && !sameEveryWeek ? `Editing Week ${editWeek}. ` : ''}Type each day’s focus — muscles or a lift. Unselected days are rest.
                  </p>
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
            </div>

            <button onClick={create} disabled={!days.length} className="grad-ember mt-6 h-12 w-full rounded-[13px] text-[15px] font-semibold text-[#0A0C10] disabled:opacity-50">Create program</button>
          </>
        )}
      </div>
    </div>
  );
}
