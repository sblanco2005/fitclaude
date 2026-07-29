'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFitClaude } from '@/context/FitClaudeContext';
import { CloseIcon } from '@/components/redesign/icons';

// Paste any workout text — an Instagram caption, a YouTube transcript, a blog
// post — and Muse Spark turns it into a saved routine. No scraping / proxy.

type Phase = 'form' | 'building' | 'error';

export function FromTextSheet({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { bumpDataVersion } = useFitClaude();
  const [phase, setPhase] = useState<Phase>('form');
  const [text, setText] = useState('');
  const [errMsg, setErrMsg] = useState('');

  const generate = async () => {
    const t = text.trim();
    if (t.length < 20) return;
    setPhase('building');
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const r = await fetch('/api/workouts/from-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: t, timezone: tz }),
      });
      const data = r.ok ? await r.json() : { error: 'Something went wrong. Please try again.' };
      if (data.workout_id) {
        bumpDataVersion();
        router.push(`/v2/train/routine/${data.workout_id}`);
        return;
      }
      setErrMsg(data.error || 'I couldn’t build a routine from that.');
      setPhase('error');
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
            <p className="font-display text-[17px] font-bold text-[var(--rd-ink)]">Building your routine…</p>
          </div>
        ) : phase === 'error' ? (
          <div className="py-4">
            <div className="flex items-start justify-between">
              <h3 className="font-display text-[19px] font-bold text-[var(--rd-ink)]">Couldn&apos;t build it</h3>
              <button onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-[var(--rd-border)] bg-[var(--rd-card-glass)] text-[var(--rd-text-secondary)]"><CloseIcon size={16} /></button>
            </div>
            <p className="mt-3 text-[14px] leading-relaxed text-[var(--rd-text-muted)]">{errMsg}</p>
            <button onClick={() => setPhase('form')} className="grad-ember mt-5 h-12 w-full rounded-[13px] text-[15px] font-semibold text-[#0A0C10]">Back</button>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-label text-[10px] tracking-[.14em] text-[var(--rd-ember)]">PASTE A WORKOUT</p>
                <h3 className="font-display mt-1 text-[20px] font-bold text-[var(--rd-ink)]">Routine from text</h3>
              </div>
              <button onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-[var(--rd-border)] bg-[var(--rd-card-glass)] text-[var(--rd-text-secondary)]"><CloseIcon size={16} /></button>
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-[var(--rd-text-muted)]">Paste an Instagram caption, a YouTube transcript, or any workout write-up — I&apos;ll turn it into a routine you can edit.</p>

            <div className="mt-4">
              <label className="font-label text-[10px] tracking-[.14em] text-[var(--rd-text-faint)]">WORKOUT TEXT</label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={'e.g.\nDay 1 – Push\nBench press 4x8\nIncline DB press 3x10\nLateral raise 3x15\n…'}
                rows={8}
                autoFocus
                className="font-body mt-1.5 w-full resize-y rounded-[12px] border border-[var(--rd-border)] bg-[var(--rd-card)] px-3.5 py-3 text-[14px] leading-relaxed text-[var(--rd-ink)] placeholder:text-[var(--rd-text-faint)] focus:border-[var(--rd-ember)] focus:outline-none"
              />
            </div>

            <button onClick={generate} disabled={text.trim().length < 20} className="grad-ember mt-4 h-12 w-full rounded-[13px] text-[15px] font-semibold text-[#0A0C10] disabled:opacity-50">Generate routine</button>
          </>
        )}
      </div>
    </div>
  );
}
