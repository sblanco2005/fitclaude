'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useFitClaude } from '@/context/FitClaudeContext';
import type { Activity, DailyNutrition, TodayWorkout, TrainingProgram, UserProfile, Workout, WorkoutCollection } from '@/types';
import { estimateActivityKcal } from '@/lib/calorie-estimate';

interface ProgramDayLite { weekday: number; weekNumber: number; dayType: string; dayLabel: string }
interface ProgramListItem {
  id: string;
  name: string | null;
  isActive: boolean;
  totalWeeks: number;
  currentWeek: number;
  dayCount: number;
  days: ProgramDayLite[];
  source: { id: string; name: string | null; username: string | null } | null;
}

const MINI_WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Compact 7-day strip for a non-active "bench" program (week 1).
function MiniWeekStrip({ days }: { days: ProgramDayLite[] }) {
  const byWeekday = new Map(days.map((d) => [d.weekday, d]));
  return (
    <div className="grid grid-cols-7 gap-1">
      {MINI_WEEKDAYS.map((label, wd) => {
        const day = byWeekday.get(wd);
        const dayType = day?.dayType || 'rest';
        const color =
          dayType === 'coached'
            ? 'bg-primary/20 text-primary border-primary/40'
            : dayType === 'pt_session' || dayType === 'class'
              ? 'bg-purple-500/20 text-purple-400 border-purple-500/40'
              : 'bg-slate-800/40 text-slate-500 border-slate-700';
        return (
          <div key={wd} className={`aspect-[4/5] rounded-md border flex flex-col items-center justify-center px-0.5 py-0.5 ${color}`}>
            <div className="text-[9px] font-bold uppercase">{label}</div>
            <div className="text-[8px] font-medium text-center leading-tight line-clamp-2">{day?.dayLabel || 'Rest'}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const { toast } = useToast();
  const router = useRouter();
  const { setChatOpen, setChatTopic, dataVersion, setPendingSessionType } = useFitClaude();
  const [nutrition, setNutrition] = useState<DailyNutrition | null>(null);
  const [recentWorkouts, setRecentWorkouts] = useState<Workout[]>([]);
  const [recentActivities, setRecentActivities] = useState<Activity[]>([]);
  const [viewOffset, setViewOffset] = useState(0); // 0=today, -1=yesterday, etc.
  const [collections, setCollections] = useState<WorkoutCollection[]>([]);
  const [programToday, setProgramToday] = useState<TodayWorkout | null>(null);
  const [program, setProgram] = useState<TrainingProgram | null>(null);
  const [allPrograms, setAllPrograms] = useState<ProgramListItem[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [shareProgramId, setShareProgramId] = useState<string | null>(null);
  const [shareComment, setShareComment] = useState('');
  const [shareBusy, setShareBusy] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [programLoaded, setProgramLoaded] = useState(false);
  const [viewedWeek, setViewedWeek] = useState<number | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [ptSheet, setPtSheet] = useState(false);
  const [ptRoutineView, setPtRoutineView] = useState(false);
  const [ptRoutines, setPtRoutines] = useState<{ id: string; name: string; displayId?: number | null }[]>([]);
  const [ptRoutinesLoading, setPtRoutinesLoading] = useState(false);
  const [sessionTypeSheet, setSessionTypeSheet] = useState(false);
  const [ptSessionType, setPtSessionType] = useState<'lifting' | 'conditioning' | null>(null);

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

      fetch('/api/workouts?daysBack=7')
        .then((res) => res.ok ? res.json() : [])
        .then((workouts: Workout[]) => setRecentWorkouts(workouts.filter((w) => w.completed)))
        .catch(() => {});

      fetch('/api/activities?daysBack=7')
        .then((res) => res.ok ? res.json() : [])
        .then((acts: Activity[]) => setRecentActivities(acts))
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

      fetch('/api/program/list')
        .then((res) => res.ok ? res.json() : [])
        .then((data) => setAllPrograms(Array.isArray(data) ? data : []))
        .catch(() => {});

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

  // Promote a program to the active "main" one; refresh the active card + list.
  const makeMain = async (programId: string) => {
    try {
      const res = await fetch('/api/program', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ programId }),
      });
      if (!res.ok) return;
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const [p, today, list] = await Promise.all([
        fetch('/api/program').then((r) => (r.ok ? r.json() : null)),
        fetch(`/api/program/today?tz=${encodeURIComponent(tz)}`).then((r) => (r.ok ? r.json() : null)),
        fetch('/api/program/list').then((r) => (r.ok ? r.json() : [])),
      ]);
      setProgram(p?.id ? p : null);
      setProgramToday(today?.programDayId ? today : null);
      setAllPrograms(Array.isArray(list) ? list : []);
      setViewedWeek(null);
    } catch { /* ignore */ }
  };

  const removeBenchProgram = async (programId: string) => {
    if (!confirm('Remove this program? This cannot be undone.')) return;
    try {
      await fetch(`/api/program?programId=${programId}`, { method: 'DELETE' });
      setAllPrograms((prev) => prev.filter((p) => p.id !== programId));
      if (selectedProgramId === programId) setSelectedProgramId(null);
    } catch { /* ignore */ }
  };

  const submitShareProgram = async () => {
    if (!shareProgramId || shareBusy || !shareComment.trim()) return;
    setShareBusy(true);
    try {
      const res = await fetch('/api/social/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemType: 'program', sourceId: shareProgramId, caption: shareComment }),
      });
      if (res.ok) {
        toast('Program shared with your followers!');
        setShareProgramId(null);
        setShareComment('');
      } else {
        toast('Failed to share program', 'error');
      }
    } catch {
      toast('Failed to share program', 'error');
    } finally {
      setShareBusy(false);
    }
  };

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

  // Program tabs: the active program is the "main" tab; non-active are bench tabs.
  // When a bench tab is selected we render that program's strip; otherwise the
  // full main program (with today highlight + week nav) from /api/program.
  const activeProgramItem = allPrograms.find((p) => p.isActive) || null;
  const selectedBench =
    allPrograms.find((p) => p.id === selectedProgramId && !p.isActive) || null;
  const viewingMain = !selectedBench;

  // Build the combined activity list for the viewed date
  type TodayItem = { id: string; label: string; meta: string; kcal?: number | null; done: boolean; type: 'workout' | 'activity' | 'todo'; href?: string; onClick?: () => void };

  const weightKg = profile?.weightKg ?? null;
  const isViewingToday = viewOffset === 0;

  // Compute the viewed date
  const viewDate = new Date();
  viewDate.setDate(viewDate.getDate() + viewOffset);
  const viewDateStr = viewDate.toDateString();

  const viewWorkouts = recentWorkouts.filter((w) => new Date(w.date).toDateString() === viewDateStr);
  const viewActivities = recentActivities.filter((a) => new Date(a.date).toDateString() === viewDateStr);

  const todayItems: TodayItem[] = [];

  // Completed workouts for viewed date
  viewWorkouts.forEach((w) => {
    todayItems.push({
      id: w.id,
      label: w.name || w.workoutType.replace('_', ' '),
      meta: `${w.exercises?.length || 0} exercises`,
      kcal: estimateActivityKcal(w.name || w.workoutType, w.durationMinutes || 50, weightKg),
      done: true,
      type: 'workout',
      href: '/workouts?tab=history',
    });
  });

  // Completed activities for viewed date
  viewActivities.forEach((a) => {
    todayItems.push({
      id: a.id,
      label: a.name,
      meta: a.durationMinutes ? `${a.durationMinutes} min` : 'Activity',
      kcal: estimateActivityKcal(a.name, a.durationMinutes, weightKg),
      done: true,
      type: 'activity',
      href: '/workouts?tab=history',
    });
  });

  // Pending program day — only for today
  if (isViewingToday && programToday && !programToday.completedToday && programToday.dayType !== 'rest') {
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
        ? () => { setSessionTypeSheet(true); }
        : undefined,
    });
  }

  // Date label for the section header
  const sectionLabel = isViewingToday
    ? 'Today'
    : viewOffset === -1
    ? 'Yesterday'
    : viewDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <>
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
          {/* Program tabs: main (active) + up to 2 bench programs */}
          <div className="flex items-center gap-1.5 mb-3 overflow-x-auto -mx-1 px-1">
            {allPrograms.map((p) => {
              const isSel = p.isActive ? viewingMain : selectedProgramId === p.id;
              const benchPos = allPrograms.filter((x) => !x.isActive).findIndex((x) => x.id === p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedProgramId(p.isActive ? null : p.id)}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                    isSel ? 'bg-primary text-white' : 'bg-slate-800/50 text-slate-400 hover:text-white'
                  }`}
                >
                  {p.isActive ? '★ Main' : (p.name || `Program ${benchPos + 2}`)}
                </button>
              );
            })}
            {allPrograms.length < 3 && (
              <button
                onClick={() => setAddMenuOpen(true)}
                className="shrink-0 w-7 h-7 rounded-lg bg-slate-800/50 text-slate-400 hover:text-white flex items-center justify-center text-lg leading-none"
                title="Add a program"
              >
                +
              </button>
            )}
          </div>

          {viewingMain ? (
          <>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {program.totalWeeks > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const next = displayWeek > 1 ? displayWeek - 1 : program.totalWeeks;
                    setViewedWeek(next);
                    fetch('/api/program', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentWeek: next }) }).catch(() => {});
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
                    const next = displayWeek < program.totalWeeks ? displayWeek + 1 : 1;
                    setViewedWeek(next);
                    fetch('/api/program', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentWeek: next }) }).catch(() => {});
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
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setShareComment(''); setShareProgramId(program.id); }}
                className="text-xs font-bold text-primary hover:text-primary/80 transition-colors"
              >
                Share
              </button>
              <Link href="/program" className="text-slate-600 hover:text-white transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
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
          </>
          ) : selectedBench ? (
          <>
            <div className="flex items-center justify-between mb-3 gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest truncate">
                {selectedBench.name || 'Program'} · {selectedBench.totalWeeks}-week
              </span>
              {selectedBench.source && (
                <span className="text-[10px] text-slate-600 shrink-0">from @{selectedBench.source.username || selectedBench.source.name}</span>
              )}
            </div>
            <MiniWeekStrip days={selectedBench.days.filter((d) => d.weekNumber === 1)} />
            <div className="flex items-center gap-2 mt-3">
              <button onClick={() => makeMain(selectedBench.id)} className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold active:scale-95 transition">
                Make main
              </button>
              <button onClick={() => { setShareComment(''); setShareProgramId(selectedBench.id); }} className="px-3 py-1.5 rounded-lg bg-slate-700/60 text-slate-300 text-xs font-bold">
                Share
              </button>
              <button onClick={() => removeBenchProgram(selectedBench.id)} className="ml-auto text-slate-600 hover:text-red-400 text-xs font-medium">
                Remove
              </button>
            </div>
          </>
          ) : null}
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

      {/* Add-program menu */}
      {addMenuOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 z-50" onClick={() => setAddMenuOpen(false)} />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-slate-800 border border-slate-700 rounded-2xl p-4 max-w-[300px] w-[90%] shadow-2xl space-y-2">
            <p className="text-sm font-bold text-white mb-1">Add a program</p>
            <Link href="/program" onClick={() => setAddMenuOpen(false)} className="block w-full px-4 py-3 rounded-xl bg-primary/15 text-primary text-sm font-bold text-center">
              Build a new program
            </Link>
            <Link href="/social" onClick={() => setAddMenuOpen(false)} className="block w-full px-4 py-3 rounded-xl bg-slate-700/60 text-slate-300 text-sm font-bold text-center">
              Import from a post
            </Link>
            <button onClick={() => setAddMenuOpen(false)} className="w-full px-4 py-2 text-slate-500 text-xs font-medium">
              Cancel
            </button>
          </div>
        </>
      )}

      {/* Share program */}
      {shareProgramId && (
        <>
          <div className="fixed inset-0 bg-black/60 z-50" onClick={() => !shareBusy && setShareProgramId(null)} />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-[320px] w-[90%] shadow-2xl">
            <p className="text-base font-bold text-white">Share this program?</p>
            <p className="text-xs text-slate-400 mt-1">Your followers will see it in their feed and can add it to their library.</p>
            <textarea
              value={shareComment}
              onChange={(e) => setShareComment(e.target.value)}
              placeholder="Add a comment (required)"
              rows={2}
              className="w-full mt-3 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary resize-none"
            />
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShareProgramId(null)} disabled={shareBusy} className="flex-1 py-2.5 rounded-xl bg-slate-700/60 text-slate-300 text-sm font-bold disabled:opacity-60">
                Cancel
              </button>
              <button onClick={submitShareProgram} disabled={shareBusy || !shareComment.trim()} className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-60">
                {shareBusy ? 'Sharing…' : 'Share'}
              </button>
            </div>
          </div>
        </>
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
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={() => setViewOffset((v) => Math.max(v - 1, -6))}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Previous day"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">{sectionLabel}</h3>
          <button
            type="button"
            onClick={() => setViewOffset((v) => Math.min(v + 1, 0))}
            disabled={isViewingToday}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-20 disabled:pointer-events-none"
            aria-label="Next day"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        {todayItems.length === 0 ? (
          <p className="text-muted text-xs py-2">
            {isViewingToday ? 'Nothing scheduled. Rest day 😴' : 'Nothing logged this day.'}
          </p>
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

      {/* ───────── SESSION TYPE SHEET — Lifting or Conditioning? ───────── */}
      {sessionTypeSheet && programToday && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setSessionTypeSheet(false)}>
          <div
            className="w-full max-w-lg mx-auto bg-slate-900 border border-slate-700/60 rounded-t-2xl p-5 pb-10 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">{programToday.dayLabel}</h3>
                <p className="text-xs text-slate-400">What type of session is this?</p>
              </div>
              <button onClick={() => setSessionTypeSheet(false)} className="text-slate-500 hover:text-white p-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { setSessionTypeSheet(false); setPtSessionType('lifting'); setPtSheet(true); setPtRoutineView(false); setPtRoutines([]); }}
                className="flex flex-col items-center gap-2 p-5 rounded-2xl bg-primary/10 border border-primary/30 hover:bg-primary/20 transition-colors"
              >
                <span className="text-3xl">🏋️</span>
                <span className="text-sm font-bold text-white">Lifting</span>
                <span className="text-xs text-slate-400 text-center">Sets & reps</span>
              </button>
              <button
                onClick={() => { setSessionTypeSheet(false); setPtSessionType('conditioning'); setPtSheet(true); setPtRoutineView(false); setPtRoutines([]); }}
                className="flex flex-col items-center gap-2 p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors"
              >
                <span className="text-3xl">🏃</span>
                <span className="text-sm font-bold text-white">Conditioning</span>
                <span className="text-xs text-slate-400 text-center">Class / cardio</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────── PT / OWN SESSION SHEET ───────── */}
      {ptSheet && programToday && (
        <div
          className="fixed inset-0 z-50 flex items-end"
          onClick={() => { setPtSheet(false); setPtRoutineView(false); }}
        >
          <div
            className="w-full max-w-lg mx-auto bg-slate-900 border border-slate-700/60 rounded-t-2xl p-5 pb-8 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-500 mb-0.5">
                  {programToday.weekdayName} — Week {programToday.weekNumber}
                </p>
                <h3 className="text-lg font-bold text-white">{programToday.dayLabel}</h3>
                <p className="text-xs text-slate-400 capitalize">{programToday.dayType.replace('_', ' ')}</p>
              </div>
              <button
                type="button"
                onClick={() => { setPtSheet(false); setPtRoutineView(false); }}
                className="text-slate-500 hover:text-white transition-colors p-1"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {ptRoutineView ? (
              /* ── Routine picker sub-view ── */
              <>
                <button
                  type="button"
                  onClick={() => setPtRoutineView(false)}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
                <p className="text-sm text-slate-300 font-medium">Pick a routine to log as done</p>
                {ptRoutinesLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-12 bg-slate-800/60 rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : ptRoutines.length === 0 ? (
                  <p className="text-xs text-slate-500 py-2">No routines found. Create one in the Workouts tab first.</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {ptRoutines.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        className="w-full flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 transition-colors text-left"
                        onClick={async () => {
                          // Duplicate the template first so the template itself stays intact,
                          // then mark the copy as completed.
                          const dupRes = await fetch(`/api/workouts/${r.id}/duplicate`, { method: 'POST' });
                          if (dupRes.ok) {
                            const dup = await dupRes.json();
                            await fetch(`/api/workouts/${dup.id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                completed: true,
                                date: new Date().toISOString(),
                                programDayId: programToday.programDayId,
                              }),
                            });
                          }
                          setPtSheet(false);
                          setPtRoutineView(false);
                          // Refresh dashboard data
                          const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
                          fetch('/api/workouts?daysBack=7')
                            .then((res) => res.ok ? res.json() : [])
                            .then((workouts: Workout[]) => setRecentWorkouts(workouts.filter((w) => w.completed)))
                            .catch(() => {});
                          fetch(`/api/program/today?tz=${encodeURIComponent(tz)}`)
                            .then((res) => res.ok ? res.json() : null)
                            .then((data) => { if (data?.programDayId) setProgramToday(data); else setProgramToday(null); })
                            .catch(() => {});
                        }}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-white truncate">
                            {r.displayId ? `#${r.displayId} ` : ''}{r.name}
                          </div>
                        </div>
                        <svg className="w-4 h-4 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              /* ── Main options ── */
              <>
                <p className="text-sm text-slate-400">
                  {ptSessionType === 'conditioning' ? 'Log this conditioning session:' : 'Log this workout when you\'re done. You can:'}
                </p>
                <div className="space-y-2">
                  {/* Chat */}
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 p-4 rounded-xl bg-primary/10 border border-primary/30 hover:bg-primary/20 transition-colors text-left"
                    onClick={() => { setPendingSessionType(ptSessionType); setPtSheet(false); setChatTopic('workout'); setChatOpen(true); }}
                  >
                    <svg className="w-5 h-5 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    <span className="text-sm font-semibold text-primary">Chat with Coach Fit</span>
                  </button>

                  {/* Upload photo */}
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 p-4 rounded-xl bg-slate-800/60 border border-slate-700/50 hover:bg-slate-700/60 transition-colors text-left"
                    onClick={() => { setPendingSessionType(ptSessionType); setPtSheet(false); setChatTopic('workout'); setChatOpen(true); }}
                  >
                    <svg className="w-5 h-5 text-slate-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-sm font-semibold text-white">Upload photo of your workout</span>
                  </button>

                  {/* Link to routine — available for both lifting and conditioning */}
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors text-left"
                    onClick={() => {
                      setPtRoutineView(true);
                      setPtRoutinesLoading(true);
                      fetch('/api/workouts?routinesOnly=true')
                        .then((res) => res.ok ? res.json() : [])
                        .then((data: { id: string; name: string; displayId?: number | null; workoutType?: string | null }[]) => {
                          if (!Array.isArray(data)) { setPtRoutines([]); return; }
                          // Show all routines regardless of session type
                          const byType = data;
                          // Deduplicate by name: keep only the entry with the highest displayId per unique name
                          const byName = new Map<string, typeof byType[0]>();
                          for (const r of byType) {
                            const key = r.name.trim().toLowerCase();
                            const existing = byName.get(key);
                            if (!existing || (r.displayId ?? 0) > (existing.displayId ?? 0)) {
                              byName.set(key, r);
                            }
                          }
                          // Only show routines that have a displayId, sorted newest first
                          const deduped = Array.from(byName.values())
                            .filter((r) => r.displayId != null)
                            .sort((a, b) => (b.displayId ?? 0) - (a.displayId ?? 0));
                          setPtRoutines(deduped);
                        })
                        .catch(() => setPtRoutines([]))
                        .finally(() => setPtRoutinesLoading(false));
                    }}
                  >
                    <svg className="w-5 h-5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    <span className="text-sm font-semibold text-emerald-400">Link to routine</span>
                  </button>
                </div>
                <p className="text-xs text-slate-500">Coach Fit will extract the exercises and save them to your history.</p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
