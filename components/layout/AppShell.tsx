'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Header } from './Header';
import { BottomNav } from './BottomNav';
import { ChatDrawer } from '@/components/chat/ChatDrawer';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname.startsWith('/auth') || pathname === '/onboarding';
  const isChatPage = pathname === '/chat';

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <Header />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
      {/* Bottom stack: chat bar on top, nav below */}
      <div className="shrink-0">
        {!isChatPage && <ChatDrawer />}
        <BottomNav />
      </div>
    </div>
  );
}
