'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useFitClaude } from '@/context/FitClaudeContext';
import { Header } from './Header';
import { BottomNav } from './BottomNav';
import { ChatDrawer } from '@/components/chat/ChatDrawer';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { chatOpen } = useFitClaude();
  const isAuthPage = pathname.startsWith('/auth') || pathname === '/onboarding';
  const isChatPage = pathname === '/chat';
  // Redesign v1 lives at /v2 as an independent app with its own shell.
  const isRedesign = pathname === '/v2' || pathname.startsWith('/v2/');

  if (isAuthPage || isRedesign) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col h-dvh bg-background">
      <Header />
      <main className="flex-1 min-h-0 overflow-y-auto">
        {children}
      </main>
      {/* Bottom stack: chat bar on top, nav below */}
      <div className="shrink-0">
        {!isChatPage && <ChatDrawer />}
        <BottomNav />
      </div>
      <InstallPrompt />
    </div>
  );
}
