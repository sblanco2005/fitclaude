'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import type { UserProfile } from '@/types';
import { ScreenHeader } from '@/components/redesign/ui';

// Screen 08 · Settings — accent: violet
const titleCase = (s?: string | null) => (s ? s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '');
const gymLabel = (g?: string | null) => (g === 'home' ? 'Home gym' : g === 'public' ? 'Public gym' : titleCase(g) || '—');

export default function SettingsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [p, setP] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/profile')
      .then((r) => (r.ok ? r.json() : null))
      .then(setP)
      .catch(() => setP(null))
      .finally(() => setLoading(false));
  }, []);

  const isAdmin = (session?.user as { isAdmin?: boolean } | undefined)?.isAdmin;
  const name = p?.name || session?.user?.name || 'Athlete';
  const email = p?.email || session?.user?.email || '';
  const goal = titleCase(p?.fitnessGoal);
  const targets = [
    { v: p?.dailyCalorieTarget ?? '—', label: 'KCAL' },
    { v: p?.dailyProteinTarget ?? '—', label: 'PROTEIN' },
    { v: p?.trainingFrequency ?? '—', label: 'DAYS/WK' },
  ];
  const rows = [
    { label: 'Goal & experience', value: [goal, titleCase(p?.experienceLevel)].filter(Boolean).join(' · ') || '—' },
    { label: 'Gym & equipment', value: gymLabel(p?.gymType) },
    { label: 'Injuries to avoid', value: p?.injuriesNotes || 'None' },
  ];

  return (
    <div className="animate-fadeup space-y-5">
      <ScreenHeader title="Settings" back onBack={() => router.push('/v2')} />

      {/* Profile card */}
      <section className="rd-card flex items-center gap-3.5 p-4">
        {session?.user?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={session.user.image} alt="" className="h-12 w-12 rounded-full object-cover" />
        ) : (
          <span className="grad-coach flex h-12 w-12 items-center justify-center rounded-full font-display text-[17px] font-bold text-[#0A0C10]">
            {name.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-[16px] font-bold text-[var(--rd-ink)]">{name}</p>
          <p className="truncate text-[12px] text-[var(--rd-text-faint)]">
            {email}{goal ? ` · ${goal}` : ''}
          </p>
        </div>
      </section>

      {/* Daily targets */}
      <section>
        <p className="font-label mb-2 text-[10px] tracking-[.14em] text-[var(--rd-text-faint)]">DAILY TARGETS</p>
        <div className="grid grid-cols-3 gap-3">
          {targets.map((t) => (
            <div key={t.label} className="rd-card p-3.5 text-center">
              <div className="font-num text-[20px] font-bold text-[var(--rd-ink)]">{t.v}</div>
              <div className="font-label mt-1 text-[9px] tracking-[.12em] text-[var(--rd-text-faint)]">{t.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Rows — tap to edit via the onboarding wizard */}
      <section className="rd-card divide-y divide-[var(--rd-border)] overflow-hidden">
        {rows.map((r) => (
          <button
            key={r.label}
            onClick={() => router.push('/v2/onboarding')}
            className="flex w-full items-center justify-between gap-3 p-4 text-left"
          >
            <span className="text-[14px] text-[var(--rd-text-secondary)]">{r.label}</span>
            <span className="truncate text-right text-[13px] font-medium text-[var(--rd-text-muted)]">
              {loading ? '…' : r.value}
            </span>
          </button>
        ))}
      </section>

      {/* Admin */}
      {isAdmin && (
        <button
          onClick={() => router.push('/v2/admin')}
          className="rd-card flex w-full items-center justify-between p-4"
        >
          <span className="text-[14px] font-medium text-[var(--rd-text-secondary)]">Admin tools</span>
          <span className="font-label text-[11px] tracking-[.12em] text-[var(--rd-violet)]">INTERNAL</span>
        </button>
      )}

      {/* Sign out */}
      <button
        onClick={() => signOut()}
        className="flex h-12 w-full items-center justify-center rounded-[13px] border text-[14px] font-semibold text-[var(--rd-ember)]"
        style={{ borderColor: 'rgba(255,107,69,.4)' }}
      >
        Sign out
      </button>
    </div>
  );
}
