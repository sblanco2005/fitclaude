import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserDayBounds } from '@/lib/timezone';
import { buildTrainerEmailHtml } from '@/lib/email/trainerReport';
import { sendEmail } from '@/lib/email/send';
import type { AnalyticsData, WorkoutSession, KeyLift, MuscleVolume, ConditioningActivity } from '@/types';

interface SetLog { set: number; weight: number; reps: number }

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

async function buildWeekAnalytics(userId: string, tz: string): Promise<AnalyticsData | null> {
  try {
    const now = new Date();
    const todayLocal = now.toLocaleDateString('en-CA', { timeZone: tz });
    const todayDate = new Date(todayLocal + 'T12:00:00Z');
    const dayOfWeek = todayDate.getUTCDay();
    const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(todayDate);
    monday.setUTCDate(todayDate.getUTCDate() - daysSinceMonday);
    const since = getUserDayBounds(tz, monday.toISOString().split('T')[0]).start;

    const workouts = await prisma.workout.findMany({
      where: { userId, completed: true, date: { gte: since } },
      include: {
        exercises: {
          include: { exercise: { select: { name: true, muscleGroup: true, exerciseType: true } } },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { date: 'asc' },
    });

    const sessions: WorkoutSession[] = [];
    let totalVolume = 0;
    let totalSets = 0;
    const muscleSetMap = new Map<string, number>();
    const overloadMap = new Map<string, { date: string; maxWeight: number; topReps: number; e1rm: number; muscleGroup: string }[]>();

    for (const w of workouts) {
      const dateStr = w.date.toISOString().split('T')[0];
      let sessVol = 0, sessSets = 0;
      const musclesHit = new Set<string>();
      for (const ex of w.exercises) {
        const logs = parseSetLogs(ex.setLogs);
        sessSets += logs.length;
        for (const log of logs) sessVol += log.weight * log.reps;
        if (ex.exercise?.muscleGroup) {
          musclesHit.add(ex.exercise.muscleGroup);
          const mg = ex.exercise.muscleGroup;
          muscleSetMap.set(mg, (muscleSetMap.get(mg) || 0) + logs.length);
        }
        if (ex.exercise?.exerciseType === 'compound') {
          const logs2 = parseSetLogs(ex.setLogs);
          let bestE1rm = 0, bestW = 0, bestR = 0;
          for (const l of logs2) {
            const e = l.weight * (1 + l.reps / 30);
            if (e > bestE1rm) { bestE1rm = e; bestW = l.weight; bestR = l.reps; }
          }
          if (bestE1rm > 0) {
            const name = ex.exercise.name;
            if (!overloadMap.has(name)) overloadMap.set(name, []);
            overloadMap.get(name)!.push({ date: dateStr, maxWeight: bestW, topReps: bestR, e1rm: Math.round(bestE1rm), muscleGroup: ex.exercise.muscleGroup });
          }
        }
      }
      totalVolume += sessVol;
      totalSets += sessSets;
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
      .sort((a, b) => b.e1rm - a.e1rm)
      .slice(0, 8);

    const setsByMuscle: MuscleVolume[] = Array.from(muscleSetMap.entries())
      .map(([muscleGroup, sets]) => ({ muscleGroup, sets }))
      .sort((a, b) => b.sets - a.sets);

    const activityRows = await prisma.activity.findMany({
      where: { userId, date: { gte: since } },
      orderBy: { date: 'asc' },
      select: { id: true, name: true, durationMinutes: true, date: true, notes: true },
    });
    const conditioningActivities: ConditioningActivity[] = activityRows.map(a => ({
      id: a.id, date: a.date.toISOString().split('T')[0], name: a.name, durationMinutes: a.durationMinutes, notes: a.notes,
    }));

    const activeDays = new Set([
      ...workouts.map(w => w.date.toISOString().split('T')[0]),
      ...activityRows.map(a => a.date.toISOString().split('T')[0]),
    ]);
    const periodDays = Math.ceil((Date.now() - since.getTime()) / 86400000);
    const restDays = Math.max(0, periodDays - activeDays.size);

    const musclesWorkedSet = new Set<string>();
    for (const s of sessions) for (const m of s.musclesHit) musclesWorkedSet.add(m);

    // PRs (all-time)
    const prMap = new Map<string, { muscleGroup: string; prWeight: number; prReps: number; prDate: string }>();
    for (const w of workouts) {
      const dateStr = w.date.toISOString().split('T')[0];
      for (const ex of w.exercises) {
        if (!ex.exercise) continue;
        const logs = parseSetLogs(ex.setLogs);
        for (const log of logs) {
          const existing = prMap.get(ex.exercise.name);
          if (!existing || log.weight > existing.prWeight) {
            prMap.set(ex.exercise.name, { muscleGroup: ex.exercise.muscleGroup, prWeight: log.weight, prReps: log.reps, prDate: dateStr });
          }
        }
      }
    }
    const personalRecords = Array.from(prMap.entries()).map(([exerciseName, d]) => ({ exerciseName, ...d })).sort((a, b) => b.prDate.localeCompare(a.prDate));

    return {
      period: 'week', totalWorkouts: workouts.length, totalVolume: Math.round(totalVolume), totalSets,
      avgVolumePerSession: workouts.length > 0 ? Math.round(totalVolume / workouts.length) : 0,
      sessions, volumeBySession: [], volumeByWeek: [], progressiveOverload: [],
      keyLifts, setsByMuscle, workedMuscleGroups: Array.from(musclesWorkedSet), conditioningActivities, restDays,
      personalRecords, plateaus: [], repRangeAnalysis: [],
      musclesWorked: Array.from(musclesWorkedSet),
      nutrition: { daysLogged: 0, avgCalories: 0, avgProteinG: 0, avgCarbsG: 0, avgFatG: 0, caloriesByDay: [], macrosByDay: [], targets: { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }, compliance: { calorie: 0, protein: 0 }, avgMealsPerDay: 0, mealTypeDistribution: [], topFoods: [] },
    };
  } catch (err) {
    console.error('[trainer-email] buildWeekAnalytics error', err);
    return null;
  }
}

export async function POST(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Find users with a trainer email and activity in the last 14 days
  const since14d = new Date();
  since14d.setDate(since14d.getDate() - 14);

  const users = await prisma.user.findMany({
    where: {
      trainerEmail: { not: null },
      OR: [
        { workouts: { some: { date: { gte: since14d }, completed: true } } },
        { activities: { some: { date: { gte: since14d } } } },
      ],
    },
    select: { id: true, name: true, email: true, timezone: true, trainerEmail: true },
  });

  let sent = 0;
  for (const u of users) {
    if (!u.trainerEmail) continue;
    const analyticsData = await buildWeekAnalytics(u.id, u.timezone || 'UTC');
    if (!analyticsData || (analyticsData.totalWorkouts === 0 && analyticsData.conditioningActivities.length === 0)) continue;

    const userName = u.name || u.email?.split('@')[0] || 'Athlete';
    const html = buildTrainerEmailHtml(userName, analyticsData);
    const weekStart = analyticsData.sessions.length
      ? new Date(analyticsData.sessions[0].date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : 'this week';

    try {
      await sendEmail({
        to: u.trainerEmail,
        subject: `${userName} — Weekly Training Report (${weekStart})`,
        html,
      });
      sent++;
    } catch (err) {
      console.error(`[trainer-email] failed to send for user ${u.id}`, err);
    }
  }

  return NextResponse.json({ ok: true, sent, total: users.length });
}
