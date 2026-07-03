'use client';

import React, { useState } from 'react';
import { useCoachChat, type CoachContext } from './useCoachChat';
import { UserBubble, CoachBubble, LoggedMealCard, GeneratedRoutineCard } from './ChatCards';
import { SparkleIcon, ArrowRightIcon, TrainIcon, DropletIcon } from '@/components/redesign/icons';

// Screen 12 · Coach docked bottom sheet — opens over the current screen,
// context (nutrition | workout) selects tools/copy. Source: delta handoff.

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
  const chat = useCoachChat(context);
  const [input, setInput] = useState('');
  const cfg = CTX[context];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input;
    setInput('');
    await chat.send(text);
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
                {context === 'nutrition' ? 'Log food or ask about your macros.' : 'Generate a routine or adjust your training.'}
              </p>
            </div>
          )}
          {chat.messages.map((m) =>
            m.role === 'user' ? (
              <UserBubble key={m.id}>{m.content}</UserBubble>
            ) : (
              <div key={m.id} className="space-y-2">
                {m.content && <CoachBubble>{m.content}</CoachBubble>}
                {m.meal && <LoggedMealCard meal={m.meal} />}
                {m.routine && <GeneratedRoutineCard routine={m.routine} />}
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

        {/* footer: quick chips + input */}
        <div className="border-t border-[var(--rd-border)] px-4 pb-6 pt-2.5">
          <div className="scrollbar-hide -mx-1 mb-2.5 flex gap-2 overflow-x-auto px-1">
            {cfg.chips.map((chip, i) => (
              <button
                key={chip}
                onClick={() => chat.send(chip)}
                disabled={chat.loading}
                className="font-body shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-[12px] font-semibold"
                style={
                  i === 0
                    ? { background: cfg.tint, borderColor: cfg.border, color: cfg.color }
                    : { background: 'var(--rd-card-glass)', borderColor: 'var(--rd-border)', color: 'var(--rd-text-secondary)' }
                }
              >
                {chip}
              </button>
            ))}
          </div>
          <form onSubmit={submit} className="flex items-center gap-2 rounded-full border border-[var(--rd-border)] bg-[var(--rd-card)] p-1.5 pl-4">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={cfg.placeholder}
              disabled={chat.loading}
              className="font-body min-w-0 flex-1 bg-transparent text-[14px] text-[var(--rd-ink)] placeholder:text-[var(--rd-text-faint)] focus:outline-none"
            />
            <button type="submit" disabled={chat.loading || !input.trim()} aria-label="Send" className="grad-ember flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#0A0C10] disabled:opacity-50">
              <ArrowRightIcon size={18} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
