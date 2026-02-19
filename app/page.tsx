'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.isOnboarded === false) {
      router.replace('/onboarding');
    }
  }, [status, session, router]);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-muted">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold text-white">
            Fit<span className="text-primary">Claude</span>
          </h1>
          <p className="text-muted">Sign in to start training with your AI coach</p>
          <Link href="/auth/signin">
            <Button size="lg">Get Started</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      <h2 className="text-xl font-bold text-white">
        Hey, {session.user?.name?.split(' ')[0] || 'there'}
      </h2>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-3">
        <Link href="/chat" className="block">
          <Card className="text-center p-4" hover>
            <div className="text-2xl mb-1">💬</div>
            <span className="text-xs text-slate-300">Chat</span>
          </Card>
        </Link>
        <Link href="/workouts" className="block">
          <Card className="text-center p-4" hover>
            <div className="text-2xl mb-1">🏋️</div>
            <span className="text-xs text-slate-300">Workouts</span>
          </Card>
        </Link>
        <Link href="/nutrition" className="block">
          <Card className="text-center p-4" hover>
            <div className="text-2xl mb-1">🍽️</div>
            <span className="text-xs text-slate-300">Nutrition</span>
          </Card>
        </Link>
      </div>

      {/* Today's Summary placeholder */}
      <Card>
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
          Today&apos;s Summary
        </h3>
        <p className="text-muted text-sm">
          Start chatting with your coach to generate a workout or log your meals.
        </p>
      </Card>

      {/* Exercise Library */}
      <Link href="/exercises" className="block">
        <Card hover>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-white">Exercise Library</h3>
              <p className="text-sm text-muted">Browse exercises and spicy variations</p>
            </div>
            <svg className="w-5 h-5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Card>
      </Link>
    </div>
  );
}
