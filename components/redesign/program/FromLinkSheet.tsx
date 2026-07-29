'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFitClaude } from '@/context/FitClaudeContext';
import { CloseIcon } from '@/components/redesign/icons';

// Paste a video link (YouTube, Instagram, TikTok, X) — Supadata returns the
// transcript, Muse Spark turns it into a routine you can edit.

type Phase = 'form' | 'building' | 'error';

export function FromLinkSheet({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { bumpDataVersion } = useFitClaude();
  const [phase, setPhase] = useState<Phase>('form');
  const [url, setUrl] = useState('');
  const [errMsg, setErrMsg] = useState('');

  const generate = async () => {
    const link = url.trim();
    if (!/^https?:\/\//i.test(link)) return;
    setPhase('building');
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const r = await fetch('/api/workouts/from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: link, timezone: tz }),
      });
      const data = r.ok ? await r.json() : { error: 'Something went wrong. Please try again.' };
      if (data.workout_id) {
        bumpDataVersion();
        router.push(`/v2/train/routine/${data.workout_id}`);
        return;
      }
      setErrMsg(data.error || 'I couldn’t build a routine from that link.');
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
            <p className="font-display text-[17px] font-bold text-[var(--rd-ink)]">Reading the video…</p>
            <p className="text-[12px] text-[var(--rd-text-faint)]">Pulling the transcript and building your routine. This can take up to a minute.</p>
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
                <p className="font-label text-[10px] tracking-[.14em] text-[var(--rd-ember)]">FROM A LINK</p>
                <h3 className="font-display mt-1 text-[20px] font-bold text-[var(--rd-ink)]">Routine from a video</h3>
              </div>
              <button onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-[var(--rd-border)] bg-[var(--rd-card-glass)] text-[var(--rd-text-secondary)]"><CloseIcon size={16} /></button>
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-[var(--rd-text-muted)]"><span className="text-[var(--rd-text-secondary)]">YouTube</span> is instant and reliable. <span className="text-[var(--rd-text-secondary)]">Instagram / TikTok</span> are transcribed from the audio — slower, and only work when the exercises are <span className="italic">spoken</span>. If a reel times out or fails, paste the caption with <span className="text-[var(--rd-text-secondary)]">Paste a workout</span> instead.</p>

            <div className="mt-5">
              <label className="font-label text-[10px] tracking-[.14em] text-[var(--rd-text-faint)]">VIDEO LINK</label>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') generate(); }}
                placeholder="https://…  (youtube.com, instagram.com/reel/…, tiktok.com)"
                inputMode="url"
                autoFocus
                className="font-body mt-1.5 w-full rounded-[12px] border border-[var(--rd-border)] bg-[var(--rd-card)] px-3.5 py-3 text-[15px] text-[var(--rd-ink)] placeholder:text-[var(--rd-text-faint)] focus:border-[var(--rd-ember)] focus:outline-none"
              />
            </div>

            <button onClick={generate} disabled={!/^https?:\/\//i.test(url.trim())} className="grad-ember mt-5 h-12 w-full rounded-[13px] text-[15px] font-semibold text-[#0A0C10] disabled:opacity-50">Generate routine</button>
          </>
        )}
      </div>
    </div>
  );
}
