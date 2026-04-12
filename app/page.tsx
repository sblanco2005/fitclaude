'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useFitClaude } from '@/context/FitClaudeContext';
import type { Activity, DailyNutrition, TodayWorkout, TrainingProgram, UserProfile, Workout, WorkoutCollection } from '@/types';
import { estimateActivityKcal } from '@/lib/calorie-estimate';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { setChatOpen, setChatTopic, dataVersion } = useFitClaude();
  const [nutrition, setNutrition] = useState<DailyNutrition | null>(null);
  const [todayWorkouts, setTodayWorkouts] = useState<Workout[]>([]);
  const [todayActivities, setTodayActivities] = useState<Activity[]>([]);
  const [collections, setCollections] = useState<WorkoutCollection[]>([]);
  const [programToday, setProgramToday] = useState<TodayWorkout | null>(null);
  const [program, setProgram] = useState<TrainingProgram | null>(null);
  const [programLoaded, setProgramLoaded] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);

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
        .then((data) => { if (data?.programDayId) setProgramToday(data); else setProgramToday(null); })
        .catch(() => {});

      fetch('/api/program')
        .then((res) => res.ok ? res.json() : null)
        .then((data) => {
          if (data?.id) setProgram(data);
          else setProgram(null);
          setProgramLoaded(true);
        })
        .catch(() => setProgramLoaded(true));

      fetch('/api/profile')
        .then((res) => res.ok ? res.json() : null)
        .then((data) => { if (data) setProfile(data); })
        .catch(() => {});
    };

    fetchDashboard();

    // Refetch when page becomes visible (back button, tab switch)
    const onVisible = () => { if (document.visibilityState === 'visible') fetchDashboard(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [status, dataVersion]);

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

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : hour < 21 ? 'Good evening' : 'Late night gains';
  const firstName = session.user?.name?.split(' ')[0] || 'there';

  // Today's weekday index: 0=Mon ... 6=Sun (to match our ProgramDay.weekday)
  const jsDay = new Date().getDay();
  const todayWeekday = jsDay === 0 ? 6 : jsDay - 1;
  const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Days of the CURRENT week from the program, keyed by weekday
  const currentWeekDays = program
    ? program.days.filter((d) => d.weekNumber === program.currentWeek)
    : [];
  const daysByWeekday = new Map(currentWeekDays.map((d) => [d.weekday, d]));

  // Build the combined "today" activity list (workouts + activities)
  type TodayItem = { id: string; label: string; meta: string; kcal?: number | null; done: boolean; type: 'workout' | 'activity' | 'todo'; href?: string; onClick?: () => void };

  const weightKg = profile?.weightKg ?? null;
  const todayItems: TodayItem[] = [];

  // Completed workouts
  todayWorkouts.forEach((w) => {
    todayItems.push({
      id: w.id,
      label: w.name || w.workoutType.replace('_', ' '),
      meta: `${w.exercises?.length || 0} exercises`,
      kcal: estimateActivityKcal(w.name || w.workoutType, w.durationMinutes || 50, weightKg),
      done: true,
      type: 'workout',
      href: w.name ? `/workouts?routine=${encodeURIComponent(w.name)}` : '/workouts',
    });
  });

  // Completed activities
  todayActivities.forEach((a) => {
    todayItems.push({
      id: a.id,
      label: a.name,
      meta: a.durationMinutes ? `${a.durationMinutes} min` : 'Activity',
      kcal: estimateActivityKcal(a.name, a.durationMinutes, weightKg),
      done: true,
      type: 'activity',
    });
  });

  // Pending program day (if not yet done)
  if (programToday && !programToday.completedToday && programToday.dayType !== 'rest') {
    const isOwn = programToday.dayType === 'pt_session' || programToday.dayType === 'class';
    todayItems.push({
      id: `program-${programToday.programDayId}`,
      label: programToday.dayLabel,
      meta: isOwn
        ? 'Tap to log'
        : programToday.exerciseTemplate
          ? `${programToday.exerciseTemplate.length} exercises`
          : 'Routine',
      done: false,
      type: 'todo',
      href:
        programToday.dayType === 'coached' && programToday.routineName
          ? `/workouts?routine=${encodeURIComponent(programToday.routineName)}`
          : undefined,
      onClick: isOwn
        ? () => { setChatTopic('workout'); setChatOpen(true); }
        : undefined,
    });
  }

  return (
    <div className="p-4 pb-1 space-y-4 max-w-lg mx-auto">
      <h2 className="text-xl font-bold text-white">
        {greeting}, {firstName}
      </h2>

      {/* ───────────────── BLOCK 1 — PROGRAM (weekly strip) ──────────────────── */}
      {!programLoaded ? (
        <Card className="p-4">
          <div className="h-20 bg-slate-800/40 rounded animate-pulse" />
        </Card>
      ) : program ? (
        <Link href="/program" className="block">
          <Card className="p-4" hover>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Program — Week {program.currentWeek} of {program.totalWeeks}
              </h3>
              <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {WEEKDAY_LABELS.map((label, wd) => {
                const day = daysByWeekday.get(wd);
                const isToday = wd === todayWeekday;
                const dayType = day?.dayType || 'rest';

                const typeColor =
                  dayType === 'coached' ? 'bg-primary/20 text-primary border-primary/40' :
                  dayType === 'pt_session' || dayType === 'class' ? 'bg-purple-500/20 text-purple-400 border-purple-500/40' :
                  'bg-slate-800/40 text-slate-500 border-slate-700';

                return (
                  <div
                    key={wd}
                    className={`aspect-[4/5] rounded-lg border flex flex-col items-center justify-center p-1 ${typeColor} ${
                      isToday ? 'ring-2 ring-primary ring-offset-2 ring-offset-slate-900' : ''
                    }`}
                  >
                    <div className="text-[10px] font-bold opacity-70 uppercase">{label}</div>
                    <div className="text-[9px] font-medium text-center leading-tight mt-0.5 line-clamp-2">
                      {day?.dayLabel || 'Rest'}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </Link>
      ) : (
        <Link href="/program" className="block">
          <Card className="p-4" hover>
            <div className="flex items-center gap-3">
              <span className="text-2xl">📅</span>
              <div className="flex-1">
                <div className="text-sm font-bold text-white">Build your program</div>
                <div className="text-xs text-muted mt-0.5">Set up a weekly schedule the coach can follow</div>
              </div>
              <svg className="w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Card>
        </Link>
      )}

      {/* ───────────────── BLOCK 2 — NUTRITION ───────────────────────────────── */}
      <Link href="/nutrition" className="block">
        <Card className="p-3" hover>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <span className="text-base">🍽️</span>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nutrition</h3>
            </div>
            {hasNutrition && (
              <span className="text-[10px] text-muted">{mealCount} meal{mealCount !== 1 ? 's' : ''}</span>
            )}
          </div>
          {hasNutrition && totals ? (
            <div className="flex items-center justify-center gap-5 tabular-nums">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-primary leading-none">{Math.round(totals.calories)}</span>
                <span className="text-[10px] text-muted uppercase tracking-wide">kcal</span>
              </div>
              <div className="flex items-center gap-3.5 text-base">
                <span className="text-blue-400 font-bold">{Math.round(totals.proteinG)}<span className="text-muted font-normal text-xs ml-0.5">P</span></span>
                <span className="text-amber-400 font-bold">{Math.round(totals.carbsG)}<span className="text-muted font-normal text-xs ml-0.5">C</span></span>
                <span className="text-red-400 font-bold">{Math.round(totals.fatG)}<span className="text-muted font-normal text-xs ml-0.5">F</span></span>
              </div>
            </div>
          ) : (
            <p className="text-muted text-xs">No meals logged — tap to add</p>
          )}
        </Card>
      </Link>

      {/* ───────────────── BLOCK 3 — TODAY (activity list) ───────────────────── */}
      <Card className="p-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Today</h3>
        {todayItems.length === 0 ? (
          <p className="text-muted text-xs py-2">Nothing scheduled. Rest day 😴</p>
        ) : (
          <div className="space-y-2">
            {todayItems.map((item) => {
              const inner = (
                <div className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {item.done ? (
                      <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                        <svg className="w-3 h-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-slate-600 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-white truncate capitalize">{item.label}</div>
                      <div className="text-xs text-muted truncate">
                        {item.meta}
                        {item.kcal != null && (
                          <span className="ml-1.5 text-amber-400 font-medium">· ~{item.kcal} kcal</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-slate-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              );

              if (item.onClick) {
                return (
                  <button key={item.id} type="button" onClick={item.onClick} className="block w-full text-left">
                    {inner}
                  </button>
                );
              }
              if (item.href) {
                return (
                  <Link key={item.id} href={item.href} className="block">
                    {inner}
                  </Link>
                );
              }
              return <div key={item.id}>{inner}</div>;
            })}
          </div>
        )}
      </Card>

      {/* Collections / Routines (kept at bottom for quick access) */}
      {collections.length > 0 && (
        <>
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1 pt-1">Routines</h3>
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
