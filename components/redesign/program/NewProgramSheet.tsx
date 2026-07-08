'use client';

import React, { useState } from 'react';
import { useFitClaude } from '@/context/FitClaudeContext';
import { CloseIcon } from '@/components/redesign/icons';

// Reliable "new program" creation. generate_program upserts into the ACTIVE
// program, so to ADD one we must free the active slot (prepare-new) first — which
// means if generation then fails (e.g. the prod coach narrates success without
// running the tool) the old main is left demoted. So we: capture the current
// main → prepare-new → one structured generate_program call → verify a populated
// new program actually landed → on failure, re-activate the old main and report
// it truthfully instead of pretending it worked.

type Phase = 'form' | 'building' | 'error';

const WEEK_OPTS = [1, 2, 3, 4];

export function NewProgramSheet({
  currentActive,
  onClose,
  onCreated,
}: {
  currentActive: { id: string; name: string | null } | null;
  onClose: () => void;
  onCreated: (newName: string) => void;
}) {
  const { bumpDataVersion } = useFitClaude();
  const [phase, setPhase] = useState<Phase>('form');
  const [name, setName] = useState('');
  const [weeks, setWeeks] = useState(1);
  const [desc, setDesc] = useState('');
  const [errMsg, setErrMsg] = useState('');

  const patch = (b: object) =>
    fetch('/api/program', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).catch(() => {});

  const rollback = async () => {
    if (currentActive?.id) await patch({ programId: currentActive.id });
  };

  const create = async () => {
    if (!desc.trim() || phase === 'building') return;
    setPhase('building');
    const prevId = currentActive?.id ?? null;
    try {
      // 1) Free the active slot (demote current main → bench).
      await fetch('/api/program/prepare-new', { method: 'POST' });

      // 2) One structured generation — mirror V1's "call ONLY generate_program".
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const msg =
        `Create a NEW ${weeks}-week training program. Call ONLY the generate_program tool ` +
        `with total_weeks=${weeks} — do NOT call generate_workout or any other tool. ` +
        `Fill all ${weeks} week(s), 7 days each, using rest days where appropriate. ` +
        `Program details: ${desc.trim()}`;
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, topic: 'workout', timezone: tz }),
      });

      // 3) Verify a populated new active program actually landed.
      const list = await fetch('/api/program/list', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []);
      const created =
        Array.isArray(list) && list.find((p: { id: string; isActive: boolean; dayCount?: number }) => p.isActive && p.id !== prevId && (p.dayCount ?? 0) > 0);

      if (!created) {
        // 4a) Nothing saved — restore the old main so it's never lost.
        await rollback();
        setErrMsg("The coach didn't save a program. Your main is unchanged — please try again.");
        setPhase('error');
        return;
      }

      // 4b) Name the new program, and give the demoted main a default name so the
      // switcher reads clearly after switching (e.g. "Home" / "Vacation").
      const finalName = name.trim() || 'New program';
      await patch({ programId: created.id, name: finalName });
      if (prevId) {
        const prevName = Array.isArray(list) ? list.find((p: { id: string; name: string | null }) => p.id === prevId)?.name : null;
        if (!prevName) await patch({ programId: prevId, name: 'Home' });
      }

      bumpDataVersion();
      onCreated(finalName);
    } catch {
      await rollback();
      setErrMsg('Something went wrong. Your main is unchanged — please try again.');
      setPhase('error');
    }
  };

  return (
    <div className="absolute inset-0 z-[60] flex items-end" onClick={phase === 'building' ? undefined : onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(4,5,8,.6)', backdropFilter: 'blur(2px)' }} />
      <div
        className="relative max-h-[86%] w-full overflow-y-auto rounded-t-[24px] border-t border-[var(--rd-border)] p-5 pb-8"
        style={{ background: '#0F1117' }}
        onClick={(e) => e.stopPropagation()}
      >
        {phase === 'building' ? (
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <span className="grad-ember flex h-12 w-12 items-center justify-center rounded-full text-[#0A0C10]">
              <svg className="animate-spin" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.2-8.5" /></svg>
            </span>
            <div>
              <p className="font-display text-[17px] font-bold text-[var(--rd-ink)]">Building your program…</p>
              <p className="mt-1 text-[13px] text-[var(--rd-text-muted)]">This can take up to a minute. Your current program is safe.</p>
            </div>
          </div>
        ) : phase === 'error' ? (
          <div className="py-4">
            <div className="flex items-start justify-between">
              <h3 className="font-display text-[19px] font-bold text-[var(--rd-ink)]">Couldn&apos;t create it</h3>
              <button onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-[var(--rd-border)] bg-[var(--rd-card-glass)] text-[var(--rd-text-secondary)]"><CloseIcon size={16} /></button>
            </div>
            <p className="mt-3 text-[14px] text-[var(--rd-text-muted)]">{errMsg}</p>
            <button onClick={() => setPhase('form')} className="grad-ember mt-5 h-12 w-full rounded-[13px] text-[15px] font-semibold text-[#0A0C10]">Try again</button>
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
            <p className="mt-2 text-[13px] text-[var(--rd-text-muted)]">Your current program stays as your Main — you can switch between them anytime.</p>

            <div className="mt-5 space-y-4">
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

              <div>
                <label className="font-label text-[10px] tracking-[.14em] text-[var(--rd-text-faint)]">DESCRIBE THE SPLIT</label>
                <textarea
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="e.g. Push / Pull / Legs on Mon, Wed, Fri. Hotel gym — machines and dumbbells only. Keep it under 45 min."
                  rows={4}
                  className="font-body mt-1.5 w-full resize-none rounded-[12px] border border-[var(--rd-border)] bg-[var(--rd-card)] px-3.5 py-3 text-[14px] text-[var(--rd-ink)] placeholder:text-[var(--rd-text-faint)] focus:border-[var(--rd-ember)] focus:outline-none"
                />
              </div>
            </div>

            <button
              onClick={create}
              disabled={!desc.trim()}
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
