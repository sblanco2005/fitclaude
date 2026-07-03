'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  HomeIcon, TrainIcon, SparkleIcon, DropletIcon, LibraryIcon,
} from './icons';

// Per-screen accent glow tint (radial glow at top of the canvas)
const GLOW: Record<string, string> = {
  ember: 'rgba(255,107,69,.16)',
  violet: 'rgba(155,123,255,.16)',
  lime: 'rgba(200,255,77,.14)',
};

function accentForPath(pathname: string): keyof typeof GLOW {
  if (pathname.startsWith('/v2/coach') || pathname.startsWith('/v2/library')) return 'violet';
  if (pathname.startsWith('/v2/fuel')) return 'lime';
  return 'ember';
}

const NAV = [
  { href: '/v2', label: 'Home', Icon: HomeIcon, accent: 'var(--rd-ember)' },
  { href: '/v2/train', label: 'Train', Icon: TrainIcon, accent: 'var(--rd-ember)' },
  { href: '/v2/coach', label: 'Coach', Icon: SparkleIcon, accent: 'var(--rd-violet)', center: true },
  { href: '/v2/fuel', label: 'Fuel', Icon: DropletIcon, accent: 'var(--rd-lime)' },
  { href: '/v2/library', label: 'Library', Icon: LibraryIcon, accent: 'var(--rd-violet)' },
];

function StatusBar() {
  return (
    <div className="flex items-center justify-between px-6 pt-3 pb-1 select-none">
      <span className="font-label text-[13px] font-semibold text-[var(--rd-ink)]">9:41</span>
      <div className="flex items-center gap-1.5 text-[var(--rd-ink)]">
        {/* signal */}
        <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor" aria-hidden>
          <rect x="0" y="7" width="3" height="4" rx="1" />
          <rect x="4.5" y="5" width="3" height="6" rx="1" />
          <rect x="9" y="2.5" width="3" height="8.5" rx="1" />
          <rect x="13.5" y="0" width="3" height="11" rx="1" />
        </svg>
        {/* wifi */}
        <svg width="16" height="11" viewBox="0 0 16 11" fill="currentColor" aria-hidden>
          <path d="M8 2.2c2.5 0 4.8.95 6.5 2.5l-1.2 1.3A7.7 7.7 0 0 0 8 4.1a7.7 7.7 0 0 0-5.3 1.9L1.5 4.7A9.5 9.5 0 0 1 8 2.2Zm0 3.4c1.5 0 2.9.55 3.9 1.5l-1.25 1.3A4 4 0 0 0 8 7.3a4 4 0 0 0-2.65 1.1L4.1 7.1A5.7 5.7 0 0 1 8 5.6Zm0 3.3 1.4 1.45L8 11 6.6 9.85 8 8.9Z" />
        </svg>
        {/* battery */}
        <svg width="26" height="12" viewBox="0 0 26 12" fill="none" aria-hidden>
          <rect x="0.5" y="0.5" width="22" height="11" rx="3" stroke="currentColor" opacity="0.4" />
          <rect x="2" y="2" width="17" height="8" rx="1.6" fill="currentColor" />
          <rect x="24" y="4" width="1.5" height="4" rx="0.75" fill="currentColor" opacity="0.5" />
        </svg>
      </div>
    </div>
  );
}

function BottomNav({ pathname }: { pathname: string }) {
  return (
    <nav
      className="absolute inset-x-0 bottom-0 z-20 border-t border-[var(--rd-border)] px-4 pb-6 pt-2"
      style={{ background: 'color-mix(in srgb, var(--rd-bg) 88%, transparent)', backdropFilter: 'blur(12px)' }}
    >
      <ul className="flex items-end justify-between">
        {NAV.map(({ href, label, Icon, accent, center }) => {
          const active = href === '/v2' ? pathname === '/v2' : pathname.startsWith(href);
          if (center) {
            return (
              <li key={href} className="relative -mt-8 flex flex-col items-center">
                <Link
                  href={href}
                  aria-label={label}
                  className="grad-coach animate-floaty flex h-14 w-14 items-center justify-center rounded-full text-[#0A0C10]"
                  style={{ boxShadow: 'var(--rd-glow-coach)' }}
                >
                  <Icon size={26} />
                </Link>
                <span
                  className="font-label mt-1 text-[9px] font-semibold tracking-[.12em]"
                  style={{ color: active ? accent : 'var(--rd-text-disabled)' }}
                >
                  {label}
                </span>
              </li>
            );
          }
          return (
            <li key={href} className="flex-1">
              <Link href={href} className="flex flex-col items-center gap-1 py-1">
                <Icon size={22} style={{ color: active ? accent : 'var(--rd-text-disabled)' }} />
                <span
                  className="font-label text-[9px] font-semibold tracking-[.12em]"
                  style={{ color: active ? accent : 'var(--rd-text-disabled)' }}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function RedesignShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/v2';
  const glowTint = GLOW[accentForPath(pathname)];
  // Chat manages its own scroll + pinned input, so it fills a fixed height
  // instead of the default scrolling body with tall bottom padding.
  const isChat = pathname.startsWith('/v2/coach');
  // Live-workout focus mode: hide the tab bar; the screen supplies its own
  // full-width "Finish & rate" bar.
  const isFocus = pathname.includes('/v2/train/session/');

  return (
    <div className="min-h-dvh w-full" style={{ background: 'var(--rd-chrome)' }}>
      <div
        className="relative mx-auto flex min-h-dvh w-full max-w-[430px] flex-col overflow-hidden"
        style={{ background: 'var(--rd-bg)' }}
      >
        {/* screen-accent radial glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[45%]"
          style={{ background: `radial-gradient(120% 55% at 50% -6%, ${glowTint}, transparent 55%)` }}
        />
        <div className="relative z-10 shrink-0">
          <StatusBar />
        </div>
        <main
          className={
            isFocus
              ? 'scrollbar-hide relative z-10 flex-1 overflow-y-auto px-5 pb-24 pt-2'
              : isChat
                ? 'relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden px-5 pb-24 pt-2'
                : 'scrollbar-hide relative z-10 flex-1 overflow-y-auto px-5 pb-32 pt-2'
          }
        >
          {children}
        </main>
        {!isFocus && <BottomNav pathname={pathname} />}
      </div>
    </div>
  );
}
