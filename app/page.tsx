'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { DailyNutrition, Workout } from '@/types';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [nutrition, setNutrition] = useState<DailyNutrition | null>(null);
  const [todayWorkouts, setTodayWorkouts] = useState<Workout[]>([]);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.isOnboarded === false) {
      router.replace('/onboarding');
    }
  }, [status, session, router]);

  // Fetch today's data when authenticated
  useEffect(() => {
    if (status !== 'authenticated') return;

    fetch('/api/nutrition/today')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (data) setNutrition(data); })
      .catch(() => {});

    fetch('/api/workouts?daysBack=1')
      .then((res) => res.ok ? res.json() : [])
      .then((workouts: Workout[]) => {
        const today = new Date().toDateString();
        setTodayWorkouts(workouts.filter((w) => new Date(w.date).toDateString() === today));
      })
      .catch(() => {});
  }, [status]);

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

  const totals = nutrition?.totals;
  const mealCount = nutrition?.logs?.length || 0;
  const hasNutrition = totals && totals.calories > 0;
  const hasWorkouts = todayWorkouts.length > 0;
  const hasSummary = hasNutrition || hasWorkouts;

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      <h2 className="text-xl font-bold text-white">
        Hey, {session.user?.name?.split(' ')[0] || 'there'}
      </h2>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
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

      {/* Today's Summary */}
      <Card>
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
          Today&apos;s Summary
        </h3>

        {!hasSummary ? (
          <p className="text-muted text-sm">
            Nothing logged yet today. Use the chat to generate a workout or log meals.
          </p>
        ) : (
          <div className="space-y-4">
            {/* Workouts section */}
            {hasWorkouts && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-slate-400 uppercase">Workouts</span>
                  <span className="text-xs text-muted">({todayWorkouts.length})</span>
                </div>
                <div className="space-y-2">
                  {todayWorkouts.map((w) => (
                    <Link key={w.id} href={`/workouts?id=${w.id}`} className="block">
                      <div className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors">
                        <div>
                          <span className="text-sm text-white">{w.name || w.workoutType.replace('_', ' ')}</span>
                          <span className="text-xs text-muted ml-2">{w.exercises?.length || 0} exercises</span>
                        </div>
                        {w.completed ? (
                          <span className="text-[10px] font-medium text-primary bg-primary/15 px-2 py-0.5 rounded-full">Done</span>
                        ) : (
                          <span className="text-[10px] font-medium text-amber-400 bg-amber-400/15 px-2 py-0.5 rounded-full">Pending</span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Nutrition section */}
            {hasNutrition && totals && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-slate-400 uppercase">Nutrition</span>
                  <span className="text-xs text-muted">({mealCount} meal{mealCount !== 1 ? 's' : ''})</span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div>
                    <div className="text-sm font-semibold text-primary">{Math.round(totals.calories)}</div>
                    <div className="text-[10px] text-muted">kcal</div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-blue-400">{Math.round(totals.proteinG)}g</div>
                    <div className="text-[10px] text-muted">protein</div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-amber-400">{Math.round(totals.carbsG)}g</div>
                    <div className="text-[10px] text-muted">carbs</div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-red-400">{Math.round(totals.fatG)}g</div>
                    <div className="text-[10px] text-muted">fat</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
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
