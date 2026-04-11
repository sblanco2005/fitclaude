'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { Activity, DailyNutrition, TodayWorkout, Workout, WorkoutCollection } from '@/types';

const splitColors: Record<string, string> = {
  push: 'text-red-400',
  pull: 'text-blue-400',
  legs: 'text-amber-400',
  upper: 'text-purple-400',
  lower: 'text-emerald-400',
  full_body: 'text-cyan-400',
};

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [nutrition, setNutrition] = useState<DailyNutrition | null>(null);
  const [todayWorkouts, setTodayWorkouts] = useState<Workout[]>([]);
  const [todayActivities, setTodayActivities] = useState<Activity[]>([]);
  const [collections, setCollections] = useState<WorkoutCollection[]>([]);
  const [programToday, setProgramToday] = useState<TodayWorkout | null>(null);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.isOnboarded === false) {
      router.replace('/onboarding');
      return;
    }
    // If there's an active workout in Hit It, go straight to the workouts page
    // — unless the user explicitly chose to leave via the confirmation dialog
    if (status === 'authenticated') {
      try {
        const didLeave = sessionStorage.getItem('fitclaude:hitItLeave');
        if (didLeave) {
          sessionStorage.removeItem('fitclaude:hitItLeave');
        } else {
          const queue = JSON.parse(localStorage.getItem('fitclaude:hitItQueue') || '[]');
          if (Array.isArray(queue) && queue.length > 0) {
            router.replace('/workouts');
            return;
          }
        }
      } catch { /* ignore */ }
    }
  }, [status, session, router]);

  // Fetch today's data when authenticated + refetch on visibility change (back button)
  useEffect(() => {
    if (status !== 'authenticated') return;

    const fetchDashboard = () => {
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

      fetch('/api/collections')
        .then((res) => res.ok ? res.json() : [])
        .then((data) => setCollections(Array.isArray(data) ? data : []))
        .catch(() => {});

      fetch('/api/program/today')
        .then((res) => res.ok ? res.json() : null)
        .then((data) => { if (data?.programDayId) setProgramToday(data); })
        .catch(() => {});
    };

    fetchDashboard();

    // Refetch when page becomes visible (back button, tab switch)
    const onVisible = () => { if (document.visibilityState === 'visible') fetchDashboard(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [status]);

  if (status === 'loading') {
    return (
      <div className="p-4 pb-1 space-y-3 max-w-lg mx-auto">
        <div className="h-7 w-32 bg-slate-800 rounded animate-pulse" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-20 bg-slate-800/60 rounded-xl animate-pulse" />
          <div className="h-20 bg-slate-800/60 rounded-xl animate-pulse" />
        </div>
        <div className="h-4 w-16 bg-slate-800 rounded animate-pulse" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-36 bg-slate-800/60 rounded-xl animate-pulse" />
          <div className="h-36 bg-slate-800/60 rounded-xl animate-pulse" />
        </div>
        <div className="h-16 bg-slate-800/60 rounded-xl animate-pulse" />
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

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : hour < 21 ? 'Good evening' : 'Late night gains';
  const firstName = session.user?.name?.split(' ')[0] || 'there';

  return (
    <div className="p-4 pb-1 space-y-3 max-w-lg mx-auto">
      <h2 className="text-xl font-bold text-white">
        {greeting}, {firstName}
      </h2>

      {/* Today — tappable summary cards */}
      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Today</h3>
      <div className="grid grid-cols-2 gap-3">
        {/* Nutrition card — taps to /nutrition */}
        <Link href="/nutrition" className="block">
          <Card className="p-3" hover>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-base">🍽️</span>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Nutrition Coach</h3>
            </div>
            {hasNutrition && totals ? (
              <div className="space-y-1.5">
                <div className="text-center">
                  <div className="text-lg font-bold text-primary">{Math.round(totals.calories)}</div>
                  <div className="text-xs text-muted">kcal</div>
                </div>
                <div className="grid grid-cols-3 gap-1 text-center">
                  <div>
                    <div className="text-xs font-semibold text-blue-400">{Math.round(totals.proteinG)}g</div>
                    <div className="text-xs text-muted">protein</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-amber-400">{Math.round(totals.carbsG)}g</div>
                    <div className="text-xs text-muted">carbs</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-red-400">{Math.round(totals.fatG)}g</div>
                    <div className="text-xs text-muted">fat</div>
                  </div>
                </div>
                <div className="text-xs text-muted text-center pt-0.5">
                  {mealCount} meal{mealCount !== 1 ? 's' : ''} logged
                </div>
              </div>
            ) : (
              <p className="text-muted text-xs text-center py-3">No meals logged</p>
            )}
          </Card>
        </Link>

        {/* Workout card — program-aware */}
        {programToday ? (
          <Link href="/workouts" className="block">
            <Card className="p-3" hover>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-base">🏋️</span>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Today&apos;s Workout</h3>
              </div>
              <div className="space-y-2">
                <div className={`text-lg font-bold ${splitColors[programToday.workoutType] || 'text-white'}`}>
                  {programToday.dayLabel}
                </div>
                <div className="space-y-1">
                  {programToday.exerciseTemplate
                    .filter((e) => e.is_primary)
                    .map((e, i) => (
                      <div key={i} className="text-xs text-white">
                        {e.name} <span className="text-muted">{e.sets}x{e.reps}</span>
                      </div>
                    ))}
                  {programToday.exerciseTemplate.filter((e) => !e.is_primary).length > 0 && (
                    <div className="text-xs text-muted">
                      +{programToday.exerciseTemplate.filter((e) => !e.is_primary).length} accessories
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </Link>
        ) : (
          <Link href="/workouts" className="block">
            <Card className="p-3" hover>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-base">🏋️</span>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Workout Coach</h3>
              </div>
              {hasWorkouts ? (
                <div className="space-y-1.5">
                  {todayWorkouts.slice(0, 2).map((w) => (
                    <div key={w.id} className="py-2 px-3 rounded-lg bg-slate-800/50">
                      <div className="text-xs font-medium text-white truncate">
                        {w.name || w.workoutType.replace('_', ' ')}
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-xs text-muted">{w.exercises?.length || 0} exercises</span>
                        <span className="text-xs font-medium text-white bg-primary/30 px-1.5 py-0.5 rounded-full">Done</span>
                      </div>
                    </div>
                  ))}
                  {todayActivities.slice(0, todayWorkouts.length >= 2 ? 0 : 2 - todayWorkouts.length).map((a) => (
                    <div key={a.id} className="py-2 px-3 rounded-lg bg-slate-800/50">
                      <div className="text-xs font-medium text-white truncate capitalize">{a.name}</div>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-xs text-muted">{a.durationMinutes ? `${a.durationMinutes} min` : 'Activity'}</span>
                        <span className="text-xs font-medium text-white bg-amber-500/30 px-1.5 py-0.5 rounded-full">Activity</span>
                      </div>
                    </div>
                  ))}
                  {(todayWorkouts.length + todayActivities.length) > 2 && (
                    <div className="text-xs text-muted text-center">+{todayWorkouts.length + todayActivities.length - 2} more</div>
                  )}
                </div>
              ) : (
                <p className="text-muted text-xs text-center py-3">No workout today</p>
              )}
            </Card>
          </Link>
        )}
      </div>

      {/* Collections / Routines */}
      {collections.length > 0 && (
        <>
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Routines</h3>
          <div className="grid grid-cols-2 gap-3">
            {collections.map((col) => (
              <Link
                key={col.id}
                href={`/workouts?collection=${col.id}`}
                className="block"
              >
                <Card className="p-3" hover>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{col.emoji || '📁'}</span>
                    <h4 className="text-sm font-semibold text-white truncate">{col.name}</h4>
                  </div>
                  <p className="text-xs text-muted">
                    {col.routineNames.length} routine{col.routineNames.length !== 1 ? 's' : ''}
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}

    </div>
  );
}
