'use client';

import React, { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCoachChat, type CoachContext, type SessionType } from './useCoachChat';
import { UserBubble, CoachBubble, LoggedMealCard, GeneratedRoutineCard, LoggedActivityCard } from './ChatCards';
import { SparkleIcon, ArrowRightIcon, TrainIcon, DropletIcon, CloseIcon } from '@/components/redesign/icons';
import { readImageCompressed, type CompressedImage } from '@/lib/image';

// Screen 12 · Coach docked bottom sheet — opens over the current screen,
// context (nutrition | workout) selects tools/copy. Source: delta handoff.

const CYAN = '#22D3EE';

function CameraIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

const CTX: Record<CoachContext, {
  label: string;
  color: string;
  tint: string;
  border: string;
  status: string;
  placeholder: string;
  chips: string[];
  Icon: typeof TrainIcon;
}> = {
  nutrition: {
    label: 'Nutrition',
    color: 'var(--rd-lime)',
    tint: 'rgba(200,255,77,.12)',
    border: 'rgba(200,255,77,.28)',
    status: 'reading your day',
    placeholder: 'Ask about your food…',
    chips: ['Scan a barcode', 'Log lunch', 'Am I on track?'],
    Icon: DropletIcon,
  },
  workout: {
    label: 'Workout',
    color: 'var(--rd-violet)',
    tint: 'rgba(155,123,255,.14)',
    border: 'rgba(155,123,255,.3)',
    status: 'reading your plan',
    placeholder: 'Ask about your training…',
    chips: ['Start workout', 'Make it easier', 'Swap an exercise'],
    Icon: TrainIcon,
  },
};

export function CoachSheet({
  open,
  context,
  onClose,
}: {
  open: boolean;
  context: CoachContext;
  onClose: () => void;
}) {
  if (!open) return null;
  return <CoachSheetInner context={context} onClose={onClose} />;
}

function CoachSheetInner({ context, onClose }: { context: CoachContext; onClose: () => void }) {
  const router = useRouter();
  const chat = useCoachChat(context);
  const [input, setInput] = useState('');
  const [image, setImage] = useState<CompressedImage | null>(null);
  const [attaching, setAttaching] = useState(false);
  const [mode, setMode] = useState<SessionType>('lifting');
  const fileRef = useRef<HTMLInputElement>(null);
  const cfg = CTX[context];
  const cardio = context === 'workout' && mode === 'conditioning';

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!f) return;
    setAttaching(true);
    try { setImage(await readImageCompressed(f)); } catch { /* ignore */ } finally { setAttaching(false); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !image) || chat.loading) return;
    const text = input;
    const img = image;
    setInput('');
    setImage(null);
    // Only pass sessionType in the workout context (nutrition ignores it).
    await chat.send(text, img ?? undefined, context === 'workout' ? mode : undefined);
  };

  return (
    <div className="absolute inset-0 z-40">
      {/* scrim */}
      <button
        aria-label="Close coach"
        onClick={onClose}
        className="animate-fadeup absolute inset-0"
        style={{ background: 'rgba(4,5,8,.6)', backdropFilter: 'blur(2px)' }}
      />
      {/* sheet */}
      <div
        className="absolute inset-x-0 bottom-0 flex h-[72%] flex-col overflow-hidden rounded-t-[28px] border-t"
        style={{ background: '#0F1117', borderColor: 'rgba(255,255,255,.08)', boxShadow: '0 -24px 60px -12px rgba(0,0,0,.7)', animation: 'rd-fadeup .28s ease-out both' }}
      >
        {/* grab handle */}
        <div className="flex justify-center pb-1 pt-2.5">
          <span className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        {/* header */}
        <div className="flex items-center gap-2.5 border-b border-[var(--rd-border)] px-4 pb-3">
          <span className="grad-coach flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#0A0C10]" style={{ boxShadow: '0 6px 16px -4px rgba(139,107,255,.7)' }}>
            <SparkleIcon size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-[15px] font-bold text-[var(--rd-ink)]">Coach</p>
            <p className="flex items-center gap-1.5 text-[11px] text-[var(--rd-text-faint)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--rd-lime)] animate-livedot" />
              {cfg.status}
            </p>
          </div>
          <span className="font-label flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold" style={{ background: cfg.tint, borderColor: cfg.border, color: cfg.color }}>
            <cfg.Icon size={12} /> {cfg.label}
          </span>
          <button onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-[var(--rd-border)] bg-[var(--rd-card-glass)] text-[var(--rd-text-secondary)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
          </button>
        </div>

        {/* messages */}
        <div ref={chat.listRef} className="scrollbar-hide flex flex-1 flex-col justify-end gap-3 overflow-y-auto px-4 py-4">
          {chat.historyLoaded && chat.messages.length === 0 && (
            <div className="mb-auto mt-2 text-center">
              <p className="text-[13px] text-[var(--rd-text-muted)]">
                {context === 'nutrition' ? 'Log food or ask about your macros.' : 'Generate a routine, log a session, or snap your gym’s board.'}
              </p>
            </div>
          )}
          {chat.messages.map((m) =>
            m.role === 'user' ? (
              <div key={m.id} className="flex flex-col items-end gap-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {m.image && <img src={m.image} alt="attachment" className="max-h-52 max-w-[220px] rounded-[16px] border border-[var(--rd-border)] object-cover" />}
                {m.content && <UserBubble>{m.content}</UserBubble>}
              </div>
            ) : (
              <div key={m.id} className="space-y-2">
                {m.content && <CoachBubble>{m.content}</CoachBubble>}
                {m.meal && <LoggedMealCard meal={m.meal} />}
                {m.activity && <LoggedActivityCard activity={m.activity} />}
                {m.routine && <GeneratedRoutineCard routine={m.routine} onOpen={m.routine.id ? () => { onClose(); router.push(`/v2/train/routine/${m.routine!.id}`); } : undefined} />}
              </div>
            ),
          )}
          {chat.loading && (
            <div className="flex justify-start">
              <div className="flex gap-1 border border-[var(--rd-border)] bg-[var(--rd-card-glass)] px-4 py-3" style={{ borderRadius: '18px 18px 18px 5px' }}>
                {[0, 1, 2].map((i) => (
                  <span key={i} className="h-1.5 w-1.5 rounded-full bg-[var(--rd-text-muted)] animate-pulse-soft" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* footer: mode toggle (workout only) + input */}
        <div className="border-t border-[var(--rd-border)] px-4 pb-6 pt-2.5">
          {context === 'workout' && (
            <div className="mb-2.5 flex gap-1.5 rounded-full border border-[var(--rd-border)] bg-[var(--rd-card)] p-1">
              {(['lifting', 'conditioning'] as SessionType[]).map((m) => {
                const active = mode === m;
                const isCardio = m === 'conditioning';
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className="flex-1 rounded-full py-1.5 text-[12px] font-semibold transition-colors"
                    style={active
                      ? { background: isCardio ? CYAN : 'var(--rd-violet)', color: '#0A0C10' }
                      : { color: 'var(--rd-text-muted)' }}
                  >
                    {isCardio ? 'Cardio' : 'Workout'}
                  </button>
                );
              })}
            </div>
          )}

          {/* Attached-photo preview */}
          {(image || attaching) && (
            <div className="mb-2 flex items-center gap-2 rounded-[14px] border border-[var(--rd-border)] bg-[var(--rd-card-glass)] p-2">
              {attaching ? (
                <span className="flex h-14 w-14 items-center justify-center rounded-[10px] bg-[var(--rd-card)] text-[var(--rd-text-faint)]">
                  <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.2-8.5" /></svg>
                </span>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image!.dataUrl} alt="attachment" className="h-14 w-14 rounded-[10px] object-cover" />
              )}
              <span className="flex-1 text-[12px] text-[var(--rd-text-muted)]">{attaching ? 'Preparing photo…' : 'Photo attached — add a note or send.'}</span>
              {!attaching && (
                <button onClick={() => setImage(null)} aria-label="Remove photo" className="flex h-8 w-8 items-center justify-center rounded-[9px] border border-[var(--rd-border)] text-[var(--rd-text-secondary)]"><CloseIcon size={15} /></button>
              )}
            </div>
          )}

          <form onSubmit={submit} className="flex items-center gap-2 rounded-full border border-[var(--rd-border)] bg-[var(--rd-card)] p-1.5 pl-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={attaching || chat.loading}
              aria-label="Add a photo"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--rd-border)] disabled:opacity-50"
              style={{ color: cardio ? CYAN : 'var(--rd-violet)' }}
            >
              <CameraIcon size={18} />
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={image ? 'Add a note (optional)…' : cardio ? 'e.g. rower 5min + air bike 2min + run 400m' : cfg.placeholder}
              disabled={chat.loading}
              className="font-body min-w-0 flex-1 bg-transparent text-[14px] text-[var(--rd-ink)] placeholder:text-[var(--rd-text-faint)] focus:outline-none"
            />
            <button type="submit" disabled={chat.loading || attaching || (!input.trim() && !image)} aria-label="Send" className="grad-ember flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#0A0C10] disabled:opacity-50">
              <ArrowRightIcon size={18} />
            </button>
          </form>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} />
        </div>
      </div>
    </div>
  );
}
