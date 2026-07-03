'use client';

import React, { useState } from 'react';
import { useCoachChat } from '@/components/redesign/coach/useCoachChat';
import { UserBubble, CoachBubble, LoggedMealCard, GeneratedRoutineCard } from '@/components/redesign/coach/ChatCards';
import { SparkleIcon, ArrowRightIcon } from '@/components/redesign/icons';

// Screen 02 · AI Coach Chat — accent: violet
export default function CoachPage() {
  const chat = useCoachChat();
  const [input, setInput] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input;
    setInput('');
    await chat.send(text);
  };

  return (
    <div className="animate-fadeup flex h-full flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-[var(--rd-border)] pb-3">
        <span className="grad-coach flex h-10 w-10 items-center justify-center rounded-full text-[#0A0C10]" style={{ boxShadow: 'var(--rd-glow-coach)' }}>
          <SparkleIcon size={20} />
        </span>
        <div>
          <p className="font-display text-[16px] font-bold text-[var(--rd-ink)]">Coach</p>
          <p className="flex items-center gap-1.5 text-[11px] text-[var(--rd-text-faint)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--rd-lime)] animate-livedot" />
            Online · knows your plan
          </p>
        </div>
      </header>

      {/* Messages */}
      <div ref={chat.listRef} className="scrollbar-hide -mx-5 flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {chat.historyLoaded && chat.messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <span className="grad-coach mb-3 flex h-12 w-12 items-center justify-center rounded-full text-[#0A0C10]">
              <SparkleIcon size={24} />
            </span>
            <p className="text-[14px] font-semibold text-[var(--rd-ink)]">Ask your coach anything</p>
            <p className="mt-1 max-w-[240px] text-[12px] text-[var(--rd-text-faint)]">
              &ldquo;Give me a push day, spicy&rdquo; · &ldquo;log 2 eggs and oatmeal&rdquo;
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
            <div
              className="flex gap-1 border border-[var(--rd-border)] bg-[var(--rd-card-glass)] px-4 py-3"
              style={{ borderRadius: '18px 18px 18px 5px' }}
            >
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-[var(--rd-text-muted)] animate-pulse-soft"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={submit} className="flex items-center gap-2 rounded-full border border-[var(--rd-border)] bg-[var(--rd-card)] p-1.5 pl-4">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message your coach…"
          disabled={chat.loading}
          className="font-body min-w-0 flex-1 bg-transparent text-[14px] text-[var(--rd-ink)] placeholder:text-[var(--rd-text-faint)] focus:outline-none"
        />
        <button
          type="submit"
          disabled={chat.loading || !input.trim()}
          aria-label="Send"
          className="grad-ember flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#0A0C10] disabled:opacity-50"
        >
          <ArrowRightIcon size={18} />
        </button>
      </form>
    </div>
  );
}
