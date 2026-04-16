'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useFitClaude } from '@/context/FitClaudeContext';
import type { Activity, CoachNote, DailyNutrition, TodayWorkout, TrainingProgram, UserProfile, Workout, WorkoutCollection } from '@/types';
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
  const [viewedWeek, setViewedWeek] = useState<number | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [coachNote, setCoachNote] = useState<CoachNote | null>(null);

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

      fetch(`/api/program/today?tz=${encodeURIComponent(tz)}`)
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

      fetch('/api/coach-notes/latest')
        .then((res) => res.ok ? res.json() : null)
        .then((data) => { if (data?.id) setCoachNote(data); })
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

  // Days of the VIEWED week (defaults to current program week)
  const displayWeek = viewedWeek ?? program?.currentWeek ?? 1;
  const displayedWeekDays = program
    ? program.days.filter((d) => d.weekNumber === displayWeek)
    : [];
  const daysByWeekday = new Map(displayedWeekDays.map((d) => [d.weekday, d]));
  const isViewingCurrentWeek = program ? displayWeek === program.currentWeek : true;

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
      href: w.name ? `/workouts?tab=history&routine=${encodeURIComponent(w.name)}` : '/workouts?tab=history',
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
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {program.totalWeeks > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewedWeek(displayWeek > 1 ? displayWeek - 1 : program.totalWeeks);
                  }}
                  className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
                  aria-label="Previous week"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}
              <Link href="/program" className="text-xs font-bold text-slate-400 uppercase tracking-widest hover:text-white transition-colors">
                Program — Week {displayWeek} of {program.totalWeeks}
                {!isViewingCurrentWeek && <span className="ml-1.5 text-[9px] normal-case font-medium text-slate-600">(preview)</span>}
              </Link>
              {program.totalWeeks > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewedWeek(displayWeek < program.totalWeeks ? displayWeek + 1 : 1);
                  }}
                  className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
                  aria-label="Next week"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}
            </div>
            <Link href="/program" className="text-slate-600 hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
          <Link href="/program" className="block">
            <div className="grid grid-cols-7 gap-1.5">
              {WEEKDAY_LABELS.map((label, wd) => {
                const day = daysByWeekday.get(wd);
                const isToday = isViewingCurrentWeek && wd === todayWeekday;
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
          </Link>
        </Card>
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

      {/* ───────────────── BLOCK 4 — COACH NOTES ──────────────────────── */}
      {coachNote ? (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              coachNote.tone === 'celebrate' ? 'bg-primary/20' :
              coachNote.tone === 'warn' ? 'bg-amber-400/20' :
              'bg-emerald-500/20'
            }`}>
              {coachNote.tone === 'celebrate' ? (
                <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              ) : coachNote.tone === 'warn' ? (
                <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Coach Notes</h3>
            </div>
          </div>
          <p className={`text-sm font-semibold mb-1.5 ${
            coachNote.tone === 'celebrate' ? 'text-primary' :
            coachNote.tone === 'warn' ? 'text-amber-400' :
            'text-white'
          }`}>
            {coachNote.headline}
          </p>
          <div className="text-xs text-slate-400 leading-relaxed space-y-0.5 [&>*]:before:content-['•_'] [&>*]:before:text-slate-600">
            {coachNote.body.split('\n').filter(Boolean).map((line, i) => (
              <p key={i}>{line.replace(/^[-•*]\s*/, '')}</p>
            ))}
          </div>
        </Card>
      ) : (
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <p className="text-xs text-slate-600">Your first coach briefing arrives tomorrow morning.</p>
          </div>
        </Card>
      )}

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
