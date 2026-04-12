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
  class: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
  rest: 'bg-slate-700/40 text-slate-400 border-slate-700',
};

const DAY_TYPE_LABELS: Record<DayType, string> = {
  coached: 'Coached',
  pt_session: 'PT Session',
  class: 'Class',
  rest: 'Rest',
};

interface DayDraft {
  weekday: number;
  weekNumber: number;
  dayType: DayType;
  dayLabel: string;
  workoutType?: string;
}

export default function ProgramPage() {
  const { toast } = useToast();
  const [program, setProgram] = useState<TrainingProgram | null>(null);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);

  // Builder state — start with 2 weeks, all rest days
  const [totalWeeks, setTotalWeeks] = useState(2);
  const [draftDays, setDraftDays] = useState<DayDraft[]>([]);
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
    if (building) {
      // Rebuild draft days
      const days: DayDraft[] = [];
      for (let w = 1; w <= newWeeks; w++) {
        for (let d = 0; d < 7; d++) {
          const existing = draftDays.find((x) => x.weekday === d && x.weekNumber === w);
          days.push(existing || {
            weekday: d,
            weekNumber: w,
            dayType: 'rest',
            dayLabel: 'Rest',
          });
        }
      }
      setDraftDays(days);
    }
  };

  const generateProgram = async () => {
    setGenerating(true);
    try {
      // Filter out rest days with no info, and build a description of what we want
      const coachedDays = draftDays.filter((d) => d.dayType === 'coached');
      const nonCoachedDays = draftDays.filter((d) => d.dayType !== 'coached' && d.dayType !== 'rest');

      let message = `Set up my training program. Use the generate_program tool with total_weeks=${totalWeeks} and these days:\n\n`;

      draftDays.forEach((d) => {
        if (d.dayType === 'rest') return;
        message += `- Week ${d.weekNumber}, ${WEEKDAYS_LONG[d.weekday]} (weekday=${d.weekday}): ${DAY_TYPE_LABELS[d.dayType]} — "${d.dayLabel}"`;
        if (d.workoutType) message += ` (workout_type=${d.workoutType})`;
        message += '\n';
      });

      if (coachedDays.length > 0) {
        message += `\nFor each coached day, generate 4-5 exercises with 1-2 primary lifts (is_primary=true) from the top of the exercise hierarchy. Respect my equipment.`;
      }
      if (nonCoachedDays.length > 0) {
        message += `\nFor PT sessions, classes, and rest days, do NOT generate exercises — just save them as the day label.`;
      }

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
            <button
              onClick={deleteProgram}
              className="text-xs text-red-400 hover:text-red-300"
            >
              Delete program
            </button>
          </div>
        </Card>

        {Object.keys(daysByWeek)
          .map(Number)
          .sort((a, b) => a - b)
          .map((weekNum) => (
            <div key={weekNum} className="space-y-2">
              <h3 className={`text-xs font-bold uppercase tracking-widest px-1 ${
                weekNum === program.currentWeek ? 'text-primary' : 'text-slate-500'
              }`}>
                Week {weekNum}{weekNum === program.currentWeek && ' — current'}
              </h3>
              <div className="grid grid-cols-7 gap-1.5">
                {WEEKDAYS.map((label, wd) => {
                  const day = daysByWeek[weekNum].find((d) => d.weekday === wd);
                  const dayType = day?.dayType || 'rest';
                  return (
                    <div
                      key={wd}
                      className={`aspect-square rounded-lg border text-center flex flex-col items-center justify-center p-1 ${DAY_TYPE_COLORS[dayType]}`}
                    >
                      <div className="text-[10px] font-medium opacity-60">{label}</div>
                      <div className="text-[10px] font-bold truncate w-full" title={day?.dayLabel || 'Rest'}>
                        {day?.dayLabel || 'Rest'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

        <Card>
          <Button
            onClick={() => {
              setBuilding(true);
              // Load current program into draft
              setTotalWeeks(program.totalWeeks);
              setDraftDays(
                program.days.map((d) => ({
                  weekday: d.weekday,
                  weekNumber: d.weekNumber,
                  dayType: d.dayType,
                  dayLabel: d.dayLabel,
                  workoutType: d.workoutType ?? undefined,
                }))
              );
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
  const [dayLabel, setDayLabel] = useState(day.dayLabel);
  const [workoutType, setWorkoutType] = useState(day.workoutType || '');

  const workoutTypes = ['push', 'pull', 'legs', 'upper', 'lower', 'full_body', 'custom'];

  const handleSave = () => {
    onSave({
      dayType,
      dayLabel: dayLabel.trim() || DAY_TYPE_LABELS[dayType],
      workoutType: dayType === 'coached' ? workoutType : undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
      <Card className="w-full max-w-md space-y-4">
        <h3 className="text-base font-bold text-white">
          {WEEKDAYS_LONG[day.weekday]} — Week {day.weekNumber}
        </h3>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-2">Day type</label>
          <div className="grid grid-cols-2 gap-2">
            {(['coached', 'pt_session', 'class', 'rest'] as DayType[]).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setDayType(t);
                  if (t === 'rest' && !dayLabel) setDayLabel('Rest');
                }}
                className={`px-3 py-2 rounded-lg text-sm font-medium border ${
                  dayType === t ? DAY_TYPE_COLORS[t] : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {DAY_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        {dayType !== 'rest' && (
          <Input
            label="Label"
            placeholder={
              dayType === 'coached'
                ? 'e.g. Deadlifts + Glutes'
                : dayType === 'pt_session'
                ? 'e.g. PT Session'
                : 'e.g. Alpha X'
            }
            value={dayLabel}
            onChange={(e) => setDayLabel(e.target.value)}
          />
        )}

        {dayType === 'coached' && (
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">Workout type</label>
            <select
              value={workoutType}
              onChange={(e) => setWorkoutType(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
            >
              <option value="">Select type</option>
              {workoutTypes.map((t) => (
                <option key={t} value={t}>
                  {t.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="ghost" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSave} className="flex-1">
            Save
          </Button>
        </div>
      </Card>
    </div>
  );
}
