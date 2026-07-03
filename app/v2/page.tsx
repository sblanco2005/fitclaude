'use client';

import React from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { MacroRing } from '@/components/redesign/dashboard/MacroRing';
import { useDashboardData } from '@/components/redesign/dashboard/useDashboardData';
import { BackButton } from '@/components/redesign/ui';
import { CheckIcon, PlusIcon, DropletIcon, SparkleIcon } from '@/components/redesign/icons';

// Screen 01 · Dashboard ("Home") — accent: ember
// Real data via the shared backend (same endpoints the current app uses),
// styled to match design_handoff screenshot 01.

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function nowEyebrow(): string {
  return new Date()
    .toLocaleDateString('en-US', { weekday: 'long', hour: 'numeric', minute: '2-digit' })
    .toUpperCase()
    .replace(',', ' ·');
}

export default function DashboardV2() {
  const { data: session } = useSession();
  const d = useDashboardData();
  const firstName = session?.user?.name?.split(' ')[0] ?? 'there';
  const avatarLetter = firstName.charAt(0).toUpperCase();

  const proteinPct = d.macros[0] ? d.macros[0].value / d.macros[0].target : 0;
  const carbsPct = d.macros[1] ? d.macros[1].value / d.macros[1].target : 0;
  const fatPct = d.macros[2] ? d.macros[2].value / d.macros[2].target : 0;

  return (
    <div className="animate-fadeup space-y-5">
      {/* Greeting row */}
      <header className="flex items-start justify-between pt-1">
        <div className="flex items-center gap-3">
          <BackButton />
          <div>
            <p className="font-label text-[10px] tracking-[.14em] text-[var(--rd-text-faint)]">
              {nowEyebrow()}
            </p>
            <h1 className="font-display mt-1 text-[25px] font-bold leading-[1.1] text-[var(--rd-ink)]">
              {greeting()}, {firstName}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {d.streak > 0 && (
            <span className="flex items-center gap-1.5 rounded-full border border-[var(--rd-border)] bg-[var(--rd-card-glass)] px-2.5 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--rd-lime)] animate-livedot" />
              <span className="font-label text-[12px] font-semibold text-[var(--rd-ink)]">{d.streak}</span>
            </span>
          )}
          <Link href="/v2/settings" aria-label="Settings">
            {session?.user?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={session.user.image} alt="" className="h-9 w-9 rounded-full object-cover" />
            ) : (
              <span className="grad-coach flex h-9 w-9 items-center justify-center rounded-full font-display text-sm font-bold text-[#0A0C10]">
                {avatarLetter}
              </span>
            )}
          </Link>
        </div>
      </header>

      {/* Macro hero card */}
      <section className="rd-card flex items-center gap-5 p-5">
        <MacroRing
          kcal={d.kcal}
          kcalTarget={d.kcalTarget}
          protein={proteinPct}
          carbs={carbsPct}
          fat={fatPct}
        />
        <div className="flex-1 space-y-3.5">
          {d.macros.map((m) => (
            <div key={m.label}>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: m.color }} />
                  <span className="text-[13px] font-medium text-[var(--rd-text-secondary)]">{m.label}</span>
                </span>
                <span className="font-label text-[12px] text-[var(--rd-text-faint)]">
                  {m.value}/{m.target}g
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--rd-border)]">
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{ width: `${Math.min(100, (m.value / Math.max(1, m.target)) * 100)}%`, background: m.color }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* This week */}
      <section>
        <div className="mb-2.5 flex items-center justify-between">
          <p className="text-[13px] font-semibold text-[var(--rd-ink)]">
            This week{' '}
            {d.weekNumber != null && (
              <span className="font-label text-[11px] font-normal text-[var(--rd-text-faint)]">· Week {d.weekNumber}</span>
            )}
          </p>
          <Link href="/v2/train/add" className="flex items-center gap-1 text-[var(--rd-ember)]">
            <PlusIcon size={13} />
            <span className="text-[12px] font-semibold">Add program</span>
          </Link>
        </div>
        <div className="flex gap-2">
          {d.week.map((day, i) => (
            <div
              key={i}
              className="flex flex-1 flex-col items-center gap-2 rounded-[13px] border py-2.5"
              style={{
                borderColor: day.state === 'today' ? 'var(--rd-ember)' : 'var(--rd-border)',
                background: day.state === 'today' ? 'rgba(255,107,69,.08)' : 'var(--rd-card-glass)',
              }}
            >
              <span className="font-label text-[11px] font-semibold text-[var(--rd-text-muted)]">{day.label}</span>
              {day.state === 'done' ? (
                <span className="text-[var(--rd-lime)]"><CheckIcon size={14} /></span>
              ) : day.state === 'today' ? (
                <span className="h-2 w-2 rounded-full bg-[var(--rd-ember)] animate-restpulse" />
              ) : day.state === 'planned' ? (
                <span className="h-2 w-2 rounded-full" style={{ background: day.dot }} />
              ) : (
                <span className="h-2 w-2 rounded-full bg-[var(--rd-border-strong)]" />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Today's plan */}
      {d.today.hasPlan ? (
        <section
          className="relative overflow-hidden rounded-[20px] border p-5"
          style={{ borderColor: 'rgba(255,107,69,.32)', background: 'rgba(255,107,69,.06)' }}
        >
          <p className="font-label text-[10px] tracking-[.16em] text-[var(--rd-ember)]">
            {d.today.completed ? 'COMPLETED TODAY' : "TODAY'S PLAN"}
          </p>
          <h2 className="font-display mt-1.5 text-[21px] font-bold text-[var(--rd-ink)]">{d.today.dayLabel}</h2>
          <p className="mt-1 text-[13px] text-[var(--rd-text-muted)]">
            {d.today.exerciseCount} exercises
            {d.today.estMinutes > 0 && ` · ~${d.today.estMinutes} min`}
            {d.today.muscles && ` · ${d.today.muscles}`}
          </p>
          <Link
            href="/v2/train"
            className="grad-ember relative mt-4 flex h-12 items-center justify-center overflow-hidden rounded-[13px] font-semibold text-[#0A0C10]"
            style={{ boxShadow: 'var(--rd-glow-ember)' }}
          >
            <span className="relative z-10">{d.today.completed ? 'View workout' : 'Hit It'}</span>
            {!d.today.completed && (
              <span
                aria-hidden
                className="animate-sheen absolute inset-y-0 -left-1/3 z-0 w-1/3"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.35), transparent)' }}
              />
            )}
          </Link>
        </section>
      ) : (
        <section className="rd-card p-5">
          <p className="font-label text-[10px] tracking-[.16em] text-[var(--rd-text-faint)]">TODAY</p>
          <h2 className="font-display mt-1.5 text-[21px] font-bold text-[var(--rd-ink)]">
            {d.loading ? 'Loading…' : 'Rest day'}
          </h2>
          <p className="mt-1 text-[13px] text-[var(--rd-text-muted)]">
            {d.loading ? 'Fetching your plan' : 'No training scheduled. Recover well.'}
          </p>
        </section>
      )}

      {/* Quick actions */}
      <section className="grid grid-cols-2 gap-3">
        <QuickAction
          href="/v2/fuel"
          icon={<DropletIcon size={18} />}
          accent="var(--rd-lime)"
          tint="rgba(200,255,77,.12)"
          title="Log a meal"
          sub="Just type what you ate"
        />
        <QuickAction
          href="/v2/coach"
          icon={<SparkleIcon size={18} />}
          accent="var(--rd-violet)"
          tint="rgba(155,123,255,.14)"
          title="Spin a routine"
          sub="Fresh exercises, same focus"
        />
      </section>
    </div>
  );
}

function QuickAction({
  href, icon, accent, tint, title, sub,
}: {
  href: string; icon: React.ReactNode; accent: string; tint: string; title: string; sub: string;
}) {
  return (
    <Link href={href} className="rd-card flex flex-col gap-3 p-4 transition-colors active:bg-[var(--rd-card-glass-hover)]">
      <span
        className="flex h-9 w-9 items-center justify-center rounded-[11px]"
        style={{ background: tint, color: accent }}
      >
        {icon}
      </span>
      <div>
        <p className="text-[14px] font-semibold text-[var(--rd-ink)]">{title}</p>
        <p className="mt-0.5 text-[12px] leading-snug text-[var(--rd-text-faint)]">{sub}</p>
      </div>
    </Link>
  );
}
