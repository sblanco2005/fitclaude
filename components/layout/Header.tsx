'use client';

import React from 'react';
import { useSession } from 'next-auth/react';

export function Header() {
  const { data: session } = useSession();

  return (
    <header className="shrink-0 z-30 flex items-center justify-between h-14 px-4 bg-background/80 backdrop-blur-md border-b border-border-dark">
      <h1 className="text-lg font-bold text-white">
        Fit<span className="text-primary">Claude</span>
      </h1>
      {session?.user?.image && (
        <img
          src={session.user.image}
          alt={session.user.name || 'User'}
          className="w-8 h-8 rounded-full border border-border-dark"
        />
      )}
    </header>
  );
}
