'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';

export function Header() {
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const isHome = pathname === '/';

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
    <header className="shrink-0 z-30 flex items-center justify-between h-14 px-4 bg-background/80 backdrop-blur-md border-b border-border-dark">
      <div className="flex items-center gap-2">
        {!isHome && (
          <button
            onClick={() => router.back()}
            className="p-1.5 -ml-1.5 text-slate-400 hover:text-white active:text-primary transition-colors"
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
          <button onClick={() => setMenuOpen(!menuOpen)}>
            <img
              src={session.user.image}
              alt={session.user.name || 'User'}
              className="w-8 h-8 rounded-full border border-border-dark"
            />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-11 w-40 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden z-50">
              <button
                onClick={() => signOut({ callbackUrl: '/auth/signin' })}
                className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-slate-700/60 transition-colors"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
