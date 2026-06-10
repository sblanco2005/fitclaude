'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import type { TrainingProgram, ProgramDay, DayType } from '@/types';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKDAYS_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const DAY_TYPE_COLORS: Record<DayType, string> = {
  coached: 'bg-primary/20 text-primary border-primary/40',
  pt_session: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
  class: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
  rest: 'bg-slate-700/40 text-slate-400 border-slate-700',
};

const DAY_TYPE_LABELS: Record<DayType, string> = {
  coached: 'Coach Fit',
  pt_session: 'My Own',
  class: 'My Own',
  rest: 'Rest',
};

const MUSCLE_GROUPS = [
  { value: 'chest', label: 'Chest' },
  { value: 'back', label: 'Back' },
  { value: 'shoulders', label: 'Shoulders' },
  { value: 'biceps', label: 'Biceps' },
  { value: 'triceps', label: 'Triceps' },
  { value: 'quads', label: 'Quads' },
  { value: 'hamstrings', label: 'Hamstrings' },
  { value: 'glutes', label: 'Glutes' },
  { value: 'calves', label: 'Calves' },
  { value: 'core', label: 'Core' },
];

// Capitalize a muscle name for display
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Infer workout type from selected muscles
function inferWorkoutType(muscles: string[]): string {
  if (muscles.length === 0) return '';
  const set = new Set(muscles);
  const pushMuscles = ['chest', 'shoulders', 'triceps'];
  const pullMuscles = ['back', 'biceps'];
  const legMuscles = ['quads', 'hamstrings', 'glutes', 'calves'];
  const isPush = muscles.every((m) => pushMuscles.includes(m));
  const isPull = muscles.every((m) => pullMuscles.includes(m));
  const isLegs = muscles.every((m) => legMuscles.includes(m));
  if (isPush) return 'push';
  if (isPull) return 'pull';
  if (isLegs) return 'legs';
  const hasUpper = muscles.some((m) => [...pushMuscles, ...pullMuscles].includes(m));
  const hasLower = muscles.some((m) => legMuscles.includes(m));
  if (hasUpper && !hasLower) return 'upper';
  if (hasLower && !hasUpper) return 'lower';
  if (hasUpper && hasLower) return 'full_body';
  return 'custom';
}

interface DayDraft {
  weekday: number;
  weekNumber: number;
  dayType: DayType;
  dayLabel: string;
  workoutType?: string;
  focusMuscles?: string[];
  exerciseCount?: number;
}

/** Stable fingerprint for detecting whether a day's config has changed. */
function dayFingerprint(d: DayDraft): string {
  return [
    d.dayType,
    d.dayLabel.trim().toLowerCase(),
    (d.focusMuscles || []).slice().sort().join(','),
    d.exerciseCount ?? '',
    d.workoutType ?? '',
  ].join('|');
}

export default function ProgramPage() {
  const { toast } = useToast();
  const [program, setProgram] = useState<TrainingProgram | null>(null);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [selectedDay, setSelectedDay] = useState<ProgramDay | null>(null);
  const [sharingProgram, setSharingProgram] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [programComment, setProgramComment] = useState('');

  // Builder state — start with 2 weeks, all rest days
  const [totalWeeks, setTotalWeeks] = useState(2);
  const [draftDays, setDraftDays] = useState<DayDraft[]>([]);
  // Snapshot of the days as they were when the builder was opened — used to
  // detect which days are unchanged so we can skip regenerating them.
  const [originalDrafts, setOriginalDrafts] = useState<DayDraft[]>([]);
  const [editingDay, setEditingDay] = useState<DayDraft | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetch('/api/program')
      .then((r) => r.json())
      .then((data) => {
        if (data?.id) {
          setProgram(data);
          setBuilding(false);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Initialize draft days when user enters build mode
  const startBuilding = () => {
    const days: DayDraft[] = [];
    for (let w = 1; w <= totalWeeks; w++) {
      for (let d = 0; d < 7; d++) {
        days.push({
          weekday: d,
          weekNumber: w,
          dayType: 'rest',
          dayLabel: 'Rest',
        });
      }
    }
    setDraftDays(days);
    setOriginalDrafts([]); // No baseline — brand-new program, everything is "new"
    setBuilding(true);
  };

  const updateDay = (weekday: number, weekNumber: number, updates: Partial<DayDraft>) => {
    setDraftDays((prev) =>
      prev.map((d) =>
        d.weekday === weekday && d.weekNumber === weekNumber ? { ...d, ...updates } : d
      )
    );
  };

  const handleTotalWeeksChange = (newWeeks: number) => {
    setTotalWeeks(newWeeks);
    // Rebuild draft days preserving any existing entries
    const days: DayDraft[] = [];
    for (let w = 1; w <= newWeeks; w++) {
      for (let d = 0; d < 7; d++) {
        const existing = draftDays.find((x) => x.weekday === d && x.weekNumber === w);
        days.push(
          existing || {
            weekday: d,
            weekNumber: w,
            dayType: 'rest',
            dayLabel: 'Rest',
          }
        );
      }
    }
    setDraftDays(days);
  };

  const generateProgram = async () => {
    setGenerating(true);
    try {
      // Build a fingerprint map of the original so we can detect unchanged days
      const originalByKey = new Map<string, DayDraft>();
      originalDrafts.forEach((d) => {
        originalByKey.set(`${d.weekday}-${d.weekNumber}`, d);
      });

      // Classify each draft day as unchanged / changed / new
      const classified = draftDays.map((d) => {
        const original = originalByKey.get(`${d.weekday}-${d.weekNumber}`);
        const unchanged = !!original && dayFingerprint(d) === dayFingerprint(original);
        return { day: d, unchanged };
      });

      // Short-circuit: nothing changed
      const anyChanged = classified.some((c) => !c.unchanged);
      if (!anyChanged && originalDrafts.length > 0) {
        toast('No changes to save');
        setBuilding(false);
        setGenerating(false);
        return;
      }

      const unchangedDays = classified.filter((c) => c.unchanged).map((c) => c.day);
      const changedDays = classified.filter((c) => !c.unchanged).map((c) => c.day);

      let message = `Save my training program. Call ONLY the generate_program tool — do NOT call generate_workout or any other tool. Use total_weeks=${totalWeeks}.\n\n`;

      if (unchangedDays.length > 0) {
        message += `KEEP THESE DAYS EXACTLY AS THEY ARE (pass keep_existing=true for each, no exercises array needed — omit the 'exercises' field):\n`;
        unchangedDays.forEach((d) => {
          if (d.dayType === 'rest') {
            message += `- Week ${d.weekNumber}, ${WEEKDAYS_LONG[d.weekday]} (weekday=${d.weekday}): Rest (day_type=rest, keep_existing=true)\n`;
          } else {
            message += `- Week ${d.weekNumber}, ${WEEKDAYS_LONG[d.weekday]} (weekday=${d.weekday}): ${DAY_TYPE_LABELS[d.dayType]} — "${d.dayLabel}" (day_type=${d.dayType}, keep_existing=true`;
            if (d.workoutType) message += `, workout_type=${d.workoutType}`;
            message += `)\n`;
          }
        });
        message += `\n`;
      }

      if (changedDays.length > 0) {
        message += `GENERATE OR REPLACE THESE DAYS (do NOT pass keep_existing, generate fresh exercises for coached days):\n`;
        changedDays.forEach((d) => {
          if (d.dayType === 'rest') {
            message += `- Week ${d.weekNumber}, ${WEEKDAYS_LONG[d.weekday]} (weekday=${d.weekday}): Rest (day_type=rest)\n`;
            return;
          }
          message += `- Week ${d.weekNumber}, ${WEEKDAYS_LONG[d.weekday]} (weekday=${d.weekday}): ${DAY_TYPE_LABELS[d.dayType]} — "${d.dayLabel}" (day_type=${d.dayType}`;
          if (d.workoutType) message += `, workout_type=${d.workoutType}`;
          message += `)`;
          if (d.dayType === 'coached' && d.focusMuscles && d.focusMuscles.length > 0) {
            message += ` — target muscles: ${d.focusMuscles.join(', ')}`;
          }
          if (d.dayType === 'coached' && d.exerciseCount) {
            message += ` — EXACTLY ${d.exerciseCount} exercises`;
          }
          message += '\n';
        });

        const coachedChanged = changedDays.filter((d) => d.dayType === 'coached');
        if (coachedChanged.length > 0) {
          message += `\nFor each Coach Fit day in the GENERATE section, produce EXACTLY the number of exercises specified. Target ONLY the listed muscles. Include 1-2 primary compound lifts (is_primary=true) from the top of the exercise hierarchy, then fill the rest with accessories. Respect my equipment.`;
        }
      }

      message += `\n\nCRITICAL:
- Include BOTH the keep-existing days and the generate-new days in the same 'days' array in ONE generate_program tool call.
- Do NOT call generate_workout. Do NOT create any standalone routines. The exercise templates inside generate_program are what become routines automatically.
- After the generate_program tool returns, respond with a brief confirmation — do not list out every exercise.`;

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, topic: 'workout' }),
      });

      if (res.ok) {
        const progRes = await fetch('/api/program');
        const progData = await progRes.json();
        if (progData?.id) {
          setProgram(progData);
          setBuilding(false);
          toast('Program created!');
        } else {
          toast('Coach responded but program was not saved', 'error');
        }
      } else {
        toast('Failed to generate program', 'error');
      }
    } catch {
      toast('Failed to generate program', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const deleteProgram = async () => {
    if (!confirm('Delete your training program? This cannot be undone.')) return;
    try {
      await fetch('/api/program', { method: 'DELETE' });
      setProgram(null);
      toast('Program deleted');
    } catch {
      toast('Failed to delete program', 'error');
    }
  };

  const openShareModal = () => {
    setProgramComment('');
    setShowShareModal(true);
  };

  const shareProgram = async () => {
    if (!program || sharingProgram || !programComment.trim()) return;
    setSharingProgram(true);
    try {
      const res = await fetch('/api/social/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemType: 'program', sourceId: program.id, caption: programComment }),
      });
      if (res.ok) {
        toast('Program shared with your followers!');
        setShowShareModal(false);
      } else {
        toast('Failed to share program', 'error');
      }
    } catch {
      toast('Failed to share program', 'error');
    } finally {
      setSharingProgram(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4 max-w-lg mx-auto">
        <div className="h-7 w-48 bg-slate-800 rounded animate-pulse" />
        <div className="bg-slate-800/60 rounded-xl h-64 animate-pulse" />
      </div>
    );
  }

  // ── Existing program view ────────────────────────────────────────────────
  if (program && !building) {
    const daysByWeek: Record<number, ProgramDay[]> = {};
    program.days.forEach((d) => {
      if (!daysByWeek[d.weekNumber]) daysByWeek[d.weekNumber] = [];
      daysByWeek[d.weekNumber].push(d);
    });

    return (
      <div className="p-4 space-y-4 max-w-lg mx-auto pb-24">
        {showShareModal && (
          <>
            <div className="fixed inset-0 bg-black/60 z-50" onClick={() => !sharingProgram && setShowShareModal(false)} />
            <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-[320px] w-[90%] shadow-2xl">
              <p className="text-base font-bold text-white">Share this program?</p>
              <p className="text-xs text-muted mt-1">
                Your followers will see it in their feed and can recreate it in their own account.
              </p>
              <textarea
                value={programComment}
                onChange={(e) => setProgramComment(e.target.value)}
                placeholder="Add a comment (required)"
                rows={2}
                className="w-full mt-3 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary resize-none"
              />
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => setShowShareModal(false)}
                  disabled={sharingProgram}
                  className="flex-1 py-2 rounded-lg bg-slate-700 text-slate-300 text-xs font-bold disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  onClick={shareProgram}
                  disabled={sharingProgram || !programComment.trim()}
                  className="flex-1 py-2 rounded-lg bg-primary text-white text-xs font-bold disabled:opacity-60"
                >
                  {sharingProgram ? 'Sharing…' : 'Share'}
                </button>
              </div>
            </div>
          </>
        )}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Training Program</h2>
          <Link href="/" className="text-xs text-muted hover:text-white">← Back</Link>
        </div>

        <Card>
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm text-muted">Current week</div>
              <div className="text-lg font-bold text-white">
                Week {program.currentWeek} of {program.totalWeeks}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={openShareModal}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 active:scale-95 transition"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Share
              </button>
              <button
                onClick={deleteProgram}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Delete program
              </button>
            </div>
          </div>
        </Card>

        {Object.keys(daysByWeek)
          .map(Number)
          .sort((a, b) => a - b)
          .map((weekNum) => {
            // Mon-indexed weekday (0=Mon … 6=Sun) for today
            const jsDay = new Date().getDay();
            const todayWeekday = jsDay === 0 ? 6 : jsDay - 1;

            const openBuilder = () => {
              setTotalWeeks(program.totalWeeks);
              const loaded = program.days.map((d) => {
                const muscles = d.exerciseTemplate
                  ? Array.from(new Set(d.exerciseTemplate.map((e) => e.muscle_group)))
                  : [];
                return {
                  weekday: d.weekday,
                  weekNumber: d.weekNumber,
                  dayType: d.dayType,
                  dayLabel: d.dayLabel,
                  workoutType: d.workoutType ?? undefined,
                  focusMuscles: muscles,
                  exerciseCount: d.exerciseTemplate?.length || 5,
                };
              });
              setDraftDays(loaded);
              setOriginalDrafts(loaded);
              setSelectedDay(null);
              setBuilding(true);
            };

            return (
            <div key={weekNum} className="space-y-2">
              <h3 className={`text-xs font-bold uppercase tracking-widest px-1 ${
                weekNum === program.currentWeek ? 'text-primary' : 'text-slate-500'
              }`}>
                Week {weekNum}{weekNum === program.currentWeek && ' — current'}
              </h3>
              <div className="space-y-2">
                {WEEKDAYS.map((label, wd) => {
                  const day = daysByWeek[weekNum].find((d) => d.weekday === wd);
                  const dayType: DayType = day?.dayType || 'rest';
                  const exerciseCount = day?.exerciseTemplate?.length || 0;
                  const primaryLifts = day?.exerciseTemplate?.filter((e) => e.is_primary) || [];
                  const clickable = dayType !== 'rest' && !!day;
                  const isToday = weekNum === program.currentWeek && wd === todayWeekday;

                  const handleDayClick = () => {
                    if (!clickable || !day) return;
                    setSelectedDay(day);
                  };

                  return (
                    <button
                      key={wd}
                      onClick={handleDayClick}
                      disabled={!clickable}
                      className={`w-full flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-all ${DAY_TYPE_COLORS[dayType]} ${
                        clickable ? 'hover:brightness-125 active:scale-[0.99]' : 'cursor-default opacity-70'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="text-xs font-bold opacity-60 w-10 shrink-0">{label}</div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold truncate">{day?.dayLabel || 'Rest'}</div>
                          {dayType === 'coached' && exerciseCount > 0 && (
                            <div className="text-xs opacity-70 truncate">
                              {primaryLifts.length > 0
                                ? `${primaryLifts.map((e) => e.name).join(', ')} + ${exerciseCount - primaryLifts.length} more`
                                : `${exerciseCount} exercise${exerciseCount !== 1 ? 's' : ''}`}
                            </div>
                          )}
                          {dayType === 'pt_session' && (
                            <div className="text-xs opacity-70">Log your own workout</div>
                          )}
                          {dayType === 'class' && (
                            <div className="text-xs opacity-70">Log when done</div>
                          )}
                        </div>
                      </div>
                      {clickable && (
                        <svg className="w-4 h-4 shrink-0 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            );
          })}

        {/* Day detail modal */}
        {selectedDay && (() => {
          const jsDay = new Date().getDay();
          const todayWeekday = jsDay === 0 ? 6 : jsDay - 1;
          const isToday = selectedDay.weekNumber === program.currentWeek && selectedDay.weekday === todayWeekday;
          const openBuilder = () => {
            setTotalWeeks(program.totalWeeks);
            const loaded = program.days.map((d) => {
              const muscles = d.exerciseTemplate
                ? Array.from(new Set(d.exerciseTemplate.map((e) => e.muscle_group)))
                : [];
              return {
                weekday: d.weekday,
                weekNumber: d.weekNumber,
                dayType: d.dayType,
                dayLabel: d.dayLabel,
                workoutType: d.workoutType ?? undefined,
                focusMuscles: muscles,
                exerciseCount: d.exerciseTemplate?.length || 5,
              };
            });
            setDraftDays(loaded);
            setOriginalDrafts(loaded);
            setSelectedDay(null);
            setBuilding(true);
          };
          return (
            <DayDetailModal
              day={selectedDay}
              isToday={isToday}
              onClose={() => setSelectedDay(null)}
              onEdit={openBuilder}
            />
          );
        })()}

        <Card>
          <Button
            onClick={() => {
              setBuilding(true);
              // Load current program into draft
              setTotalWeeks(program.totalWeeks);
              const loaded = program.days.map((d) => {
                // Derive focusMuscles from exercise template
                const muscles = d.exerciseTemplate
                  ? Array.from(new Set(d.exerciseTemplate.map((e) => e.muscle_group)))
                  : [];
                return {
                  weekday: d.weekday,
                  weekNumber: d.weekNumber,
                  dayType: d.dayType,
                  dayLabel: d.dayLabel,
                  workoutType: d.workoutType ?? undefined,
                  focusMuscles: muscles,
                  exerciseCount: d.exerciseTemplate?.length || 5,
                };
              });
              setDraftDays(loaded);
              // Deep clone the snapshot so later edits don't mutate it
              setOriginalDrafts(loaded.map((d) => ({ ...d, focusMuscles: [...(d.focusMuscles || [])] })));
            }}
            variant="ghost"
            className="w-full"
          >
            Edit Program
          </Button>
        </Card>
      </div>
    );
  }

  // ── Builder view ─────────────────────────────────────────────────────────
  if (building) {
    return (
      <div className="p-4 space-y-4 max-w-lg mx-auto pb-24">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Build Program</h2>
          <button
            onClick={() => setBuilding(false)}
            className="text-xs text-muted hover:text-white"
          >
            Cancel
          </button>
        </div>

        <Card>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
            Rotation length
          </h3>
          <div className="flex gap-2">
            {[1, 2, 3].map((w) => (
              <button
                key={w}
                onClick={() => handleTotalWeeksChange(w)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                  totalWeeks === w
                    ? 'bg-primary text-white'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {w} week{w > 1 ? 's' : ''}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted mt-2">
            How many weeks before the schedule repeats. Use 2+ for weekly rotation on coached days.
          </p>
        </Card>

        {Array.from({ length: totalWeeks }, (_, i) => i + 1).map((weekNum) => (
          <div key={weekNum} className="space-y-2">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">
              Week {weekNum}
            </h3>
            <Card>
              <div className="space-y-2">
                {WEEKDAYS.map((label, wd) => {
                  const day = draftDays.find(
                    (d) => d.weekday === wd && d.weekNumber === weekNum
                  );
                  if (!day) return null;
                  return (
                    <button
                      key={wd}
                      onClick={() => setEditingDay(day)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-left ${DAY_TYPE_COLORS[day.dayType]}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-xs font-bold opacity-60 w-8">{label}</div>
                        <div className="text-sm font-medium">{day.dayLabel}</div>
                      </div>
                      <div className="text-xs opacity-60">{DAY_TYPE_LABELS[day.dayType]}</div>
                    </button>
                  );
                })}
              </div>
            </Card>
          </div>
        ))}

        <Button
          onClick={generateProgram}
          disabled={generating}
          className="w-full"
        >
          {generating ? 'Generating...' : 'Save Program'}
        </Button>

        {/* Day edit modal */}
        {editingDay && (
          <DayEditor
            day={editingDay}
            onSave={(updates) => {
              updateDay(editingDay.weekday, editingDay.weekNumber, updates);
              setEditingDay(null);
            }}
            onCancel={() => setEditingDay(null)}
          />
        )}
      </div>
    );
  }

  // ── Empty state: no program yet ─────────────────────────────────────────
  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Training Program</h2>
        <Link href="/" className="text-xs text-muted hover:text-white">← Back</Link>
      </div>

      <Card>
        <div className="text-center py-6 space-y-3">
          <div className="text-4xl">📅</div>
          <h3 className="text-base font-bold text-white">No program yet</h3>
          <p className="text-xs text-muted max-w-xs mx-auto">
            Set up a weekly training schedule with coached workouts, PT sessions, classes, and rest days.
          </p>
          <Button onClick={startBuilding} className="mt-2">
            Build Program
          </Button>
        </div>
      </Card>
    </div>
  );
}

// ── Day editor modal ─────────────────────────────────────────────────────────

function DayEditor({
  day,
  onSave,
  onCancel,
}: {
  day: DayDraft;
  onSave: (updates: Partial<DayDraft>) => void;
  onCancel: () => void;
}) {
  const [dayType, setDayType] = useState<DayType>(day.dayType);
  const [focusMuscles, setFocusMuscles] = useState<string[]>(day.focusMuscles || []);
  const [dayLabel, setDayLabel] = useState(day.dayLabel);
  const [exerciseCount, setExerciseCount] = useState(day.exerciseCount || 5);

  const toggleMuscle = (muscle: string) => {
    const muscleName = capitalize(muscle);
    const isSelected = focusMuscles.includes(muscle);

    setFocusMuscles((prev) =>
      isSelected ? prev.filter((m) => m !== muscle) : [...prev, muscle]
    );

    setDayLabel((current) => {
      if (isSelected) {
        // Remove the muscle from the label (handle separators)
        return current
          .replace(new RegExp(`\\s*\\+\\s*${muscleName}\\b`, 'g'), '')
          .replace(new RegExp(`\\b${muscleName}\\s*\\+\\s*`, 'g'), '')
          .replace(new RegExp(`\\b${muscleName}\\b`, 'g'), '')
          .trim();
      } else {
        // Append the muscle
        const trimmed = current.trim();
        if (!trimmed) return muscleName;
        if (trimmed.endsWith('+')) return `${trimmed} ${muscleName}`;
        return `${trimmed} + ${muscleName}`;
      }
    });
  };

  const handleLabelChange = (value: string) => {
    setDayLabel(value);
  };

  const handleSave = () => {
    const finalLabel = dayLabel.trim() || DAY_TYPE_LABELS[dayType];
    onSave({
      dayType,
      dayLabel: finalLabel,
      workoutType: dayType === 'coached' ? inferWorkoutType(focusMuscles) : undefined,
      focusMuscles: dayType === 'coached' ? focusMuscles : undefined,
      exerciseCount: dayType === 'coached' ? exerciseCount : undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
      <Card className="w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-base font-bold text-white">
          {WEEKDAYS_LONG[day.weekday]} — Week {day.weekNumber}
        </h3>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-2">Day type</label>
          <div className="grid grid-cols-3 gap-2">
            {([
              { type: 'coached' as DayType, label: 'Coach Fit' },
              { type: 'pt_session' as DayType, label: 'My Own' },
              { type: 'rest' as DayType, label: 'Rest' },
            ]).map((opt) => (
              <button
                key={opt.type}
                onClick={() => {
                  setDayType(opt.type);
                  if (opt.type === 'rest') {
                    setDayLabel('Rest');
                    setFocusMuscles([]);
                  } else {
                    // Clear "Rest" placeholder when switching to an active day type
                    if (dayLabel === 'Rest') setDayLabel('');
                    if (opt.type !== 'coached') setFocusMuscles([]);
                  }
                }}
                className={`px-3 py-2 rounded-lg text-sm font-medium border ${
                  dayType === opt.type ? DAY_TYPE_COLORS[opt.type] : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {dayType === 'coached' && (
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">
              Target muscles <span className="text-slate-600">(pick any combination)</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {MUSCLE_GROUPS.map((m) => {
                const selected = focusMuscles.includes(m.value);
                return (
                  <button
                    key={m.value}
                    onClick={() => toggleMuscle(m.value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      selected
                        ? 'bg-primary/20 text-primary border-primary/60'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                    }`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {dayType === 'coached' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-slate-400">
                Number of exercises
              </label>
              <span className="text-sm font-bold text-primary">{exerciseCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setExerciseCount(Math.max(3, exerciseCount - 1))}
                className="w-9 h-9 rounded-lg bg-slate-800 text-white font-bold hover:bg-slate-700 active:scale-95"
              >
                −
              </button>
              <input
                type="range"
                min={3}
                max={10}
                value={exerciseCount}
                onChange={(e) => setExerciseCount(parseInt(e.target.value))}
                className="flex-1 h-2 rounded-full appearance-none cursor-pointer bg-slate-800 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
              />
              <button
                onClick={() => setExerciseCount(Math.min(10, exerciseCount + 1))}
                className="w-9 h-9 rounded-lg bg-slate-800 text-white font-bold hover:bg-slate-700 active:scale-95"
              >
                +
              </button>
            </div>
          </div>
        )}

        {dayType !== 'rest' && (
          <Input
            label="Label"
            placeholder={
              dayType === 'coached'
                ? 'Auto-filled from muscles — edit to customize'
                : 'e.g. PT Session, Alpha X, Yoga class'
            }
            value={dayLabel}
            onChange={(e) => handleLabelChange(e.target.value)}
          />
        )}

        <div className="flex gap-2">
          <Button variant="ghost" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="flex-1"
            disabled={dayType === 'coached' && focusMuscles.length === 0}
          >
            Save
          </Button>
        </div>
      </Card>
    </div>
  );
}

// ── Day detail modal (read-only view of a day's routine) ──────────────────────

function DayDetailModal({ day, isToday, onClose, onEdit }: { day: ProgramDay; isToday: boolean; onClose: () => void; onEdit: () => void }) {
  const exercises = day.exerciseTemplate || [];
  const primary = exercises.filter((e) => e.is_primary);
  const accessories = exercises.filter((e) => !e.is_primary);

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-4">
      <Card className="w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs text-muted">{WEEKDAYS_LONG[day.weekday]} — Week {day.weekNumber}</div>
            <h3 className="text-lg font-bold text-white">{day.dayLabel}</h3>
            <div className="text-xs text-muted mt-0.5">{DAY_TYPE_LABELS[day.dayType]}</div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {day.dayType === 'coached' && exercises.length > 0 && (
          <div className="space-y-3">
            {primary.length > 0 && (
              <div>
                <div className="text-xs font-bold text-primary uppercase tracking-wider mb-2">Primary lifts</div>
                <div className="space-y-1.5">
                  {primary.map((e, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg bg-slate-800/60 px-3 py-2">
                      <div>
                        <div className="text-sm font-semibold text-white">{e.name}</div>
                        <div className="text-xs text-muted capitalize">{e.muscle_group}</div>
                      </div>
                      <div className="text-sm text-slate-300 font-medium">
                        {e.sets}×{e.reps}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {accessories.length > 0 && (
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Accessories</div>
                <div className="space-y-1.5">
                  {accessories.map((e, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg bg-slate-800/40 px-3 py-2">
                      <div>
                        <div className="text-sm font-medium text-white">{e.name}</div>
                        <div className="text-xs text-muted capitalize">{e.muscle_group}</div>
                      </div>
                      <div className="text-xs text-slate-400">
                        {e.sets}×{e.reps}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {day.dayType === 'coached' && exercises.length === 0 && (
          <p className="text-xs text-muted text-center py-4">
            No exercises saved for this day yet.
          </p>
        )}

        {(day.dayType === 'pt_session' || day.dayType === 'class') && (
          <p className="text-xs text-muted">
            {isToday ? 'Log this session when you\'re done.' : 'My Own session — no Coach Fit exercises.'}
          </p>
        )}

        {/* ── Context-aware actions ── */}
        <div className="space-y-2 pt-1">
          {isToday ? (
            /* TODAY: action-first */
            <>
              {day.dayType === 'coached' && day.routineName && (
                <Link
                  href={`/workouts?routine=${encodeURIComponent(day.routineName)}`}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-primary text-white font-bold text-sm tracking-wide uppercase transition-all hover:bg-primary/90 active:scale-[0.98] shadow-[0_2px_12px_rgba(16,185,129,0.3)]"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Start Workout
                </Link>
              )}
              {(day.dayType === 'pt_session' || day.dayType === 'class') && (
                <Link
                  href="/chat"
                  className="flex items-center gap-3 rounded-xl bg-primary/15 text-primary px-4 py-3 hover:bg-primary/25 transition-colors"
                >
                  <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <span className="text-sm font-semibold">Chat with Coach Fit</span>
                </Link>
              )}
              <button
                onClick={onEdit}
                className="w-full text-center text-xs text-slate-500 hover:text-slate-300 transition-colors py-1"
              >
                Edit program day →
              </button>
            </>
          ) : (
            /* OTHER DAY: edit-first */
            <>
              <button
                onClick={onEdit}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-slate-700 text-white font-bold text-sm tracking-wide uppercase transition-all hover:bg-slate-600 active:scale-[0.98]"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Day
              </button>
              {day.dayType === 'coached' && day.routineName && (
                <Link
                  href={`/workouts?routine=${encodeURIComponent(day.routineName)}`}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-primary/10 text-primary font-bold text-sm tracking-wide uppercase transition-all hover:bg-primary/20 active:scale-[0.98]"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  View Routine
                </Link>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
