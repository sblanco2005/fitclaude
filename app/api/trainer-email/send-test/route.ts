import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/auth/middleware';
import { getUserDayBounds } from '@/lib/timezone';
import { buildTrainerEmailHtml } from '@/lib/email/trainerReport';
import { sendEmail } from '@/lib/email/send';
import type { WorkoutSession, KeyLift, MuscleVolume, ConditioningActivity } from '@/types';

interface SetLog { set: number; weight: number; reps: number }

function toLocalDate(date: Date, tz: string): string {
  return date.toLocaleDateString('en-CA', { timeZone: tz });
}

function parseSetLogs(raw: string | null): SetLog[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s: unknown) =>
        typeof s === 'object' && s !== null &&
        typeof (s as SetLog).weight === 'number' &&
        typeof (s as SetLog).reps === 'number'
    );
  } catch { return []; }
}

export const POST = withAuth(async (_request, user) => {
  if (!process.env.AGENTMAIL_API_KEY) {
    return NextResponse.json({ error: 'AGENTMAIL_API_KEY not configured' }, { status: 503 });
  }

  const userProfile = await prisma.user.findUnique({ where: { id: user.id }, select: { timezone: true } });
  const tz = userProfile?.timezone || 'UTC';
  const now = new Date();
  const todayLocal = now.toLocaleDateString('en-CA', { timeZone: tz });
  const todayDate = new Date(todayLocal + 'T12:00:00Z');
  const dayOfWeek = todayDate.getUTCDay();
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(todayDate);
  monday.setUTCDate(todayDate.getUTCDate() - daysSinceMonday);
  const since = getUserDayBounds(tz, monday.toISOString().split('T')[0]).start;

  const workouts = await prisma.workout.findMany({
    where: { userId: user.id, completed: true, date: { gte: since } },
    include: {
      exercises: {
        include: { exercise: { select: { name: true, muscleGroup: true, exerciseType: true } } },
        orderBy: { order: 'asc' },
      },
    },
    orderBy: { date: 'asc' },
  });

  const sessions: WorkoutSession[] = [];
  let totalVolume = 0, totalSets = 0;
  const muscleSetMap = new Map<string, number>();
  const overloadMap = new Map<string, { date: string; maxWeight: number; topReps: number; e1rm: number; muscleGroup: string }[]>();
  const workedMuscleGroupsSet = new Set<string>();

  for (const w of workouts) {
    const dateStr = toLocalDate(w.date, tz);
    let sessVol = 0, sessSets = 0;
    const musclesHit = new Set<string>();
    for (const ex of w.exercises) {
      const logs = parseSetLogs(ex.setLogs);
      if (ex.exercise?.muscleGroup) {
        workedMuscleGroupsSet.add(ex.exercise.muscleGroup);
        if (logs.length > 0) muscleSetMap.set(ex.exercise.muscleGroup, (muscleSetMap.get(ex.exercise.muscleGroup) || 0) + logs.length);
        musclesHit.add(ex.exercise.muscleGroup);
      }
      sessSets += logs.length;
      for (const log of logs) sessVol += log.weight * log.reps;
      if (ex.exercise?.exerciseType === 'compound' && logs.length > 0) {
        let bestE1rm = 0, bestW = 0, bestR = 0;
        for (const l of logs) {
          const e = l.weight * (1 + l.reps / 30);
          if (e > bestE1rm) { bestE1rm = e; bestW = l.weight; bestR = l.reps; }
        }
        const name = ex.exercise.name;
        if (!overloadMap.has(name)) overloadMap.set(name, []);
        overloadMap.get(name)!.push({ date: dateStr, maxWeight: bestW, topReps: bestR, e1rm: Math.round(bestE1rm), muscleGroup: ex.exercise.muscleGroup });
      }
    }
    totalVolume += sessVol; totalSets += sessSets;
    sessions.push({ date: dateStr, name: w.name || w.workoutType, volume: Math.round(sessVol), totalSets: sessSets, exerciseCount: w.exercises.length, fatigueRating: w.fatigueRating ?? null, musclesHit: Array.from(musclesHit) });
  }

  const keyLifts: KeyLift[] = Array.from(overloadMap.entries())
    .map(([exerciseName, data]) => {
      const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
      const latest = sorted[sorted.length - 1];
      const oldest = sorted[0];
      const deltaPercent = sorted.length >= 2 ? Math.round(((latest.e1rm - oldest.e1rm) / oldest.e1rm) * 1000) / 10 : null;
      return { exerciseName, muscleGroup: latest.muscleGroup, topSet: { weight: latest.maxWeight, reps: latest.topReps }, e1rm: latest.e1rm, prevE1rm: sorted.length >= 2 ? oldest.e1rm : null, deltaPercent };
    })
    .sort((a, b) => b.e1rm - a.e1rm).slice(0, 8);

  const setsByMuscle: MuscleVolume[] = Array.from(muscleSetMap.entries())
    .map(([muscleGroup, sets]) => ({ muscleGroup, sets })).sort((a, b) => b.sets - a.sets);

  const activityRows = await prisma.activity.findMany({
    where: { userId: user.id, date: { gte: since } },
    orderBy: { date: 'asc' },
    select: { id: true, name: true, durationMinutes: true, date: true, notes: true },
  });
  const conditioningActivities: ConditioningActivity[] = activityRows.map(a => ({
    id: a.id, date: toLocalDate(a.date, tz), name: a.name, durationMinutes: a.durationMinutes, notes: a.notes,
  }));

  const activeDays = new Set([
    ...workouts.map(w => toLocalDate(w.date, tz)),
    ...activityRows.map(a => toLocalDate(a.date, tz)),
  ]);
  const periodDays = Math.ceil((Date.now() - since.getTime()) / 86400000);
  const restDays = Math.max(0, periodDays - activeDays.size);

  const prMap = new Map<string, { muscleGroup: string; prWeight: number; prReps: number; prDate: string }>();
  for (const w of workouts) {
    const dateStr = toLocalDate(w.date, tz);
    for (const ex of w.exercises) {
      if (!ex.exercise) continue;
      for (const log of parseSetLogs(ex.setLogs)) {
        const existing = prMap.get(ex.exercise.name);
        if (!existing || log.weight > existing.prWeight)
          prMap.set(ex.exercise.name, { muscleGroup: ex.exercise.muscleGroup, prWeight: log.weight, prReps: log.reps, prDate: dateStr });
      }
    }
  }
  const personalRecords = Array.from(prMap.entries()).map(([exerciseName, d]) => ({ exerciseName, ...d })).sort((a, b) => b.prDate.localeCompare(a.prDate));

  const analyticsData = {
    period: 'week', totalWorkouts: workouts.length, totalVolume: Math.round(totalVolume), totalSets,
    avgVolumePerSession: workouts.length > 0 ? Math.round(totalVolume / workouts.length) : 0,
    sessions, volumeBySession: [], volumeByWeek: [], progressiveOverload: [],
    keyLifts, setsByMuscle, workedMuscleGroups: Array.from(workedMuscleGroupsSet),
    conditioningActivities, restDays, personalRecords, plateaus: [], repRangeAnalysis: [],
    musclesWorked: Array.from(workedMuscleGroupsSet),
    nutrition: { daysLogged: 0, avgCalories: 0, avgProteinG: 0, avgCarbsG: 0, avgFatG: 0, caloriesByDay: [], macrosByDay: [], targets: { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }, compliance: { calorie: 0, protein: 0 }, avgMealsPerDay: 0, mealTypeDistribution: [], topFoods: [] },
  };

  const userName = user.name || user.email?.split('@')[0] || 'Athlete';
  const html = buildTrainerEmailHtml(userName, analyticsData);
  const weekStart = sessions.length
    ? new Date(sessions[0].date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : 'this week';

  const toEmail = user.email!;
  await sendEmail({
    to: toEmail,
    subject: `[TEST] ${userName} — Weekly Training Report (${weekStart})`,
    html,
  });

  return NextResponse.json({ ok: true, sentTo: toEmail });
});
