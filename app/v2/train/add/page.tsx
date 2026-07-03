'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ScreenHeader } from '@/components/redesign/ui';
import { SparkleIcon, LibraryIcon, TrainIcon, ArrowRightIcon } from '@/components/redesign/icons';

// Screen 14 · Add Program (method) — accent: ember
export default function AddProgramPage() {
  const router = useRouter();
  const methods = [
    {
      icon: <SparkleIcon size={20} />,
      accent: 'var(--rd-violet)',
      tint: 'rgba(155,123,255,.14)',
      title: 'Coach-generated',
      sub: 'Tell the coach your split and let it build a full program',
      go: () => router.push('/v2/coach'),
    },
    {
      icon: <LibraryIcon size={20} />,
      accent: 'var(--rd-ember)',
      tint: 'rgba(255,107,69,.14)',
      title: 'From a template',
      sub: 'Start from a proven split (PPL, upper/lower, full-body)',
      go: () => router.push('/v2/coach'),
    },
    {
      icon: <TrainIcon size={20} />,
      accent: 'var(--rd-lime)',
      tint: 'rgba(200,255,77,.14)',
      title: 'Build by hand',
      sub: 'Set the weeks, days and routine for each training day',
      go: () => router.push('/v2/train/builder'),
    },
  ];

  return (
    <div className="animate-fadeup space-y-5">
      <ScreenHeader title="Add program" back onBack={() => router.push('/v2/train')} />
      <div className="space-y-3">
        {methods.map((m) => (
          <button key={m.title} onClick={m.go} className="rd-card flex w-full items-center gap-4 p-4 text-left">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px]" style={{ background: m.tint, color: m.accent }}>
              {m.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-[var(--rd-ink)]">{m.title}</p>
              <p className="mt-0.5 text-[12px] leading-snug text-[var(--rd-text-faint)]">{m.sub}</p>
            </div>
            <ArrowRightIcon size={18} className="shrink-0 text-[var(--rd-text-muted)]" />
          </button>
        ))}
      </div>
    </div>
  );
}
