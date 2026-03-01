'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useFitClaude } from '@/context/FitClaudeContext';

export function Header() {
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { customBack } = useFitClaude();
  const isHome = pathname === '/' && !customBack;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  return (
    <header className="shrink-0 z-30 flex items-center justify-between px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))] bg-background/80 backdrop-blur-md border-b border-border-dark">
      <div className="flex items-center gap-2">
        {!isHome && (
          <button
            onClick={() => customBack ? customBack() : router.back()}
            className="p-3 -ml-3 text-slate-400 hover:text-white active:text-primary transition-colors"
            aria-label="Go back"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <h1 className="text-lg font-bold text-white">
          Fit<span className="text-primary">Claude</span>
        </h1>
      </div>
      {session?.user?.image && (
        <div className="relative" ref={menuRef}>
          <button onClick={() => setMenuOpen(!menuOpen)} className="p-1">
            <img
              src={session.user.image}
              alt={session.user.name || 'User'}
              className="w-8 h-8 rounded-full border border-border-dark"
            />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-40 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden z-50">
              <button
                onClick={() => { setMenuOpen(false); router.push('/settings'); }}
                className="w-full text-left px-4 py-3 text-sm text-slate-300 hover:bg-slate-700/60 active:bg-slate-700/80 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Profile
              </button>
              <div className="border-t border-slate-700" />
              <button
                onClick={() => signOut({ callbackUrl: '/auth/signin' })}
                className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-slate-700/60 active:bg-slate-700/80 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign out
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
