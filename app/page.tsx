'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { Activity, DailyNutrition, Workout } from '@/types';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [nutrition, setNutrition] = useState<DailyNutrition | null>(null);
  const [todayWorkouts, setTodayWorkouts] = useState<Workout[]>([]);
  const [todayActivities, setTodayActivities] = useState<Activity[]>([]);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.isOnboarded === false) {
      router.replace('/onboarding');
    }
  }, [status, session, router]);

  // Fetch today's data when authenticated
  useEffect(() => {
    if (status !== 'authenticated') return;

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    fetch(`/api/nutrition/today?tz=${encodeURIComponent(tz)}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (data) setNutrition(data); })
      .catch(() => {});

    fetch('/api/workouts?daysBack=1')
      .then((res) => res.ok ? res.json() : [])
      .then((workouts: Workout[]) => {
        const today = new Date().toDateString();
        setTodayWorkouts(workouts.filter((w) => new Date(w.date).toDateString() === today && w.completed));
      })
      .catch(() => {});

    fetch('/api/activities?daysBack=1')
      .then((res) => res.ok ? res.json() : [])
      .then((acts: Activity[]) => {
        const today = new Date().toDateString();
        setTodayActivities(acts.filter((a) => new Date(a.date).toDateString() === today));
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
  const hasWorkouts = todayWorkouts.length > 0 || todayActivities.length > 0;

  return (
    <div className="p-3 pb-1 space-y-3 max-w-lg mx-auto">
      <h2 className="text-xl font-bold text-white">
        Hey, {session.user?.name?.split(' ')[0] || 'there'}
      </h2>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/workouts" className="block">
          <Card className="text-center p-3" hover>
            <div className="text-2xl mb-0.5">🏋️</div>
            <span className="text-xs text-slate-300">Workouts</span>
          </Card>
        </Link>
        <Link href="/nutrition" className="block">
          <Card className="text-center p-3" hover>
            <div className="text-2xl mb-0.5">🍽️</div>
            <span className="text-xs text-slate-300">Nutrition</span>
          </Card>
        </Link>
      </div>

      {/* Today's Summary — two blocks */}
      <div className="grid grid-cols-2 gap-3">
        {/* Nutrition block */}
        <Card className="p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-base">🍽️</span>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Nutrition</h3>
          </div>
          {hasNutrition && totals ? (
            <div className="space-y-1.5">
              <div className="text-center">
                <div className="text-lg font-bold text-primary">{Math.round(totals.calories)}</div>
                <div className="text-[10px] text-muted">kcal</div>
              </div>
              <div className="grid grid-cols-3 gap-1 text-center">
                <div>
                  <div className="text-xs font-semibold text-blue-400">{Math.round(totals.proteinG)}g</div>
                  <div className="text-[9px] text-muted">protein</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-amber-400">{Math.round(totals.carbsG)}g</div>
                  <div className="text-[9px] text-muted">carbs</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-red-400">{Math.round(totals.fatG)}g</div>
                  <div className="text-[9px] text-muted">fat</div>
                </div>
              </div>
              <div className="text-[10px] text-muted text-center pt-0.5">
                {mealCount} meal{mealCount !== 1 ? 's' : ''} logged
              </div>
            </div>
          ) : (
            <p className="text-muted text-xs text-center py-3">No meals logged</p>
          )}
        </Card>

        {/* Last Workout block */}
        <Card className="p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-base">🏋️</span>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Workout</h3>
          </div>
          {hasWorkouts ? (
            <div className="space-y-1.5">
              {todayWorkouts.slice(0, 2).map((w) => (
                <Link key={w.id} href={`/workouts?id=${w.id}`} className="block">
                  <div className="py-1.5 px-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors">
                    <div className="text-xs font-medium text-white truncate">
                      {w.name || w.workoutType.replace('_', ' ')}
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-[10px] text-muted">{w.exercises?.length || 0} exercises</span>
                      <span className="text-[9px] font-medium text-primary bg-primary/15 px-1.5 py-0.5 rounded-full">Done</span>
                    </div>
                  </div>
                </Link>
              ))}
              {todayActivities.slice(0, todayWorkouts.length >= 2 ? 0 : 2 - todayWorkouts.length).map((a) => (
                <div key={a.id} className="py-1.5 px-2 rounded-lg bg-slate-800/50">
                  <div className="text-xs font-medium text-white truncate capitalize">{a.name}</div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-[10px] text-muted">{a.durationMinutes ? `${a.durationMinutes} min` : 'Activity'}</span>
                    <span className="text-[9px] font-medium text-amber-300 bg-amber-500/15 px-1.5 py-0.5 rounded-full">Activity</span>
                  </div>
                </div>
              ))}
              {(todayWorkouts.length + todayActivities.length) > 2 && (
                <div className="text-[10px] text-muted text-center">+{todayWorkouts.length + todayActivities.length - 2} more</div>
              )}
            </div>
          ) : (
            <p className="text-muted text-xs text-center py-3">No workout today</p>
          )}
        </Card>
      </div>

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
