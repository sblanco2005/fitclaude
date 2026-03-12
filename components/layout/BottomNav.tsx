'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const navItems = [
  {
    href: '/',
    label: 'Home',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: '/workouts',
    label: 'Workouts',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
    ),
  },
  {
    href: '/nutrition',
    label: 'Nutrition',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    href: '/analytics',
    label: 'Analytics',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  },
];

/** Check if there's an active (running) Hit It session in localStorage */
function hasActiveHitIt(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const queue = JSON.parse(localStorage.getItem('fitclaude:hitItQueue') || '[]');
    if (!Array.isArray(queue) || queue.length === 0) return false;
    // Check if any session is actually running (not just queued)
    for (const name of queue) {
      const raw = localStorage.getItem(`fitclaude:session:${name}`);
      if (raw) {
        const s = JSON.parse(raw);
        if (s.running || s.paused) return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const handleNavClick = useCallback(
    (e: React.MouseEvent, href: string) => {
      // Only intercept if we're on /workouts AND navigating away AND there's an active session
      if (pathname.startsWith('/workouts') && !href.startsWith('/workouts') && hasActiveHitIt()) {
        e.preventDefault();
        setPendingHref(href);
      }
    },
    [pathname],
  );

  const confirmLeave = useCallback(() => {
    if (pendingHref) {
      router.push(pendingHref);
      setPendingHref(null);
    }
  }, [pendingHref, router]);

  const cancelLeave = useCallback(() => {
    setPendingHref(null);
  }, []);

  return (
    <>
      <nav className="shrink-0 bg-card/95 backdrop-blur-sm border-t border-border-dark pb-[env(safe-area-inset-bottom,0px)]">
        <div className="flex items-center justify-around h-14">
          {navItems.map((item) => {
            const isActive = item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={(e) => handleNavClick(e, item.href)}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
                  isActive
                    ? 'text-primary'
                    : 'text-muted hover:text-slate-300'
                }`}
              >
                {item.icon}
                <span className="text-[11px] font-medium truncate max-w-full">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Active workout leave confirmation */}
      {pendingHref && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 pb-20">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={cancelLeave} />
          <div className="relative w-full max-w-sm glass rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
            <div className="p-5 text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-amber-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-1">Workout in Progress</h3>
              <p className="text-sm text-slate-400 mb-5">
                You have an active workout. Your progress is saved — you can come back anytime.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={cancelLeave}
                  className="flex-1 px-4 py-3 rounded-xl bg-primary/20 text-primary font-medium text-sm active:scale-95 transition-transform"
                >
                  Stay
                </button>
                <button
                  onClick={confirmLeave}
                  className="flex-1 px-4 py-3 rounded-xl bg-slate-700/60 text-slate-300 font-medium text-sm active:scale-95 transition-transform"
                >
                  Leave
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
