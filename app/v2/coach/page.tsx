'use client';

import React, { useRef, useState } from 'react';
import { useCoachChat } from '@/components/redesign/coach/useCoachChat';
import { UserBubble, CoachBubble, LoggedMealCard, GeneratedRoutineCard } from '@/components/redesign/coach/ChatCards';
import { SparkleIcon, ArrowRightIcon, CloseIcon } from '@/components/redesign/icons';
import { readImageCompressed, type CompressedImage } from '@/lib/image';

function CameraIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

// Screen 02 · AI Coach Chat — accent: violet
export default function CoachPage() {
  const chat = useCoachChat();
  const [input, setInput] = useState('');
  const [image, setImage] = useState<CompressedImage | null>(null);
  const [attaching, setAttaching] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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
    await chat.send(text, img ?? undefined);
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
            <p className="mt-1 max-w-[260px] text-[12px] text-[var(--rd-text-faint)]">
              &ldquo;Give me a push day, spicy&rdquo; · &ldquo;log 2 eggs and oatmeal&rdquo; · 📷 snap a meal or your gym&rsquo;s routine board
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

      {/* Composer */}
      <div>
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
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--rd-border)] text-[var(--rd-violet)] disabled:opacity-50"
          >
            <CameraIcon size={18} />
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={image ? 'Add a note (optional)…' : 'Message your coach…'}
            disabled={chat.loading}
            className="font-body min-w-0 flex-1 bg-transparent text-[14px] text-[var(--rd-ink)] placeholder:text-[var(--rd-text-faint)] focus:outline-none"
          />
          <button
            type="submit"
            disabled={chat.loading || attaching || (!input.trim() && !image)}
            aria-label="Send"
            className="grad-ember flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#0A0C10] disabled:opacity-50"
          >
            <ArrowRightIcon size={18} />
          </button>
        </form>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} />
      </div>
    </div>
  );
}
