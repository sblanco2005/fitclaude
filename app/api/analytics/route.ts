import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';
import { getUserDayBounds } from '@/lib/timezone';

interface SetLog {
  set: number;
  weight: number;
  reps: number;
}

function parseSetLogs(raw: string | null): SetLog[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s: unknown) =>
        typeof s === 'object' &&
        s !== null &&
        typeof (s as SetLog).weight === 'number' &&
        typeof (s as SetLog).reps === 'number'
    );
  } catch {
    return [];
  }
}

function getISOWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function getWeekStartDate(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

export const GET = withAuth(async (request, user) => {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30d';
    const timezone = searchParams.get('tz') || 'UTC';

    // Compute "since" date
    let since: Date | undefined;
    if (period !== 'all') {
      const daysMap: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 };
      const days = daysMap[period] || 30;
      const now = new Date();
      let todayLocal: string;
      try {
        todayLocal = now.toLocaleDateString('en-CA', { timeZone: timezone });
      } catch {
        todayLocal = now.toISOString().split('T')[0];
      }
      const sinceDate = new Date(todayLocal + 'T00:00:00Z');
      sinceDate.setDate(sinceDate.getDate() - days);
      const sinceStr = sinceDate.toISOString().split('T')[0];
      since = getUserDayBounds(timezone, sinceStr).start;
    }

    // Query completed workouts within period
    const dateFilter = since ? { gte: since } : undefined;
    const workouts = await prisma.workout.findMany({
      where: {
        userId: user.id,
        completed: true,
        ...(dateFilter ? { date: dateFilter } : {}),
      },
      include: {
        exercises: {
          include: {
            exercise: {
              select: { name: true, muscleGroup: true, exerciseType: true },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { date: 'asc' },
    });

    // ── Volume by session ──
    const volumeBySession: { date: string; volume: number; name: string }[] = [];
    let totalVolume = 0;

    for (const w of workouts) {
      let sessionVolume = 0;
      for (const ex of w.exercises) {
        const logs = parseSetLogs(ex.setLogs);
        for (const log of logs) {
          sessionVolume += log.weight * log.reps;
        }
      }
      totalVolume += sessionVolume;
      volumeBySession.push({
        date: w.date.toISOString().split('T')[0],
        volume: Math.round(sessionVolume),
        name: w.name || w.workoutType,
      });
    }

    // ── Volume by week ──
    const weekMap = new Map<string, { weekStart: string; volume: number }>();
    for (const session of volumeBySession) {
      const d = new Date(session.date);
      const weekKey = getISOWeekKey(d);
      const weekStart = getWeekStartDate(d);
      const existing = weekMap.get(weekKey);
      if (existing) {
        existing.volume += session.volume;
      } else {
        weekMap.set(weekKey, { weekStart, volume: session.volume });
      }
    }
    const volumeByWeek = Array.from(weekMap.entries())
      .map(([week, data]) => ({ week, weekStart: data.weekStart, volume: data.volume }))
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart));

    // ── Progressive overload (compound exercises: max weight per session) ──
    const overloadMap = new Map<string, { date: string; maxWeight: number }[]>();
    for (const w of workouts) {
      const dateStr = w.date.toISOString().split('T')[0];
      for (const ex of w.exercises) {
        if (!ex.exercise || ex.exercise.exerciseType !== 'compound') continue;
        const logs = parseSetLogs(ex.setLogs);
        if (logs.length === 0) continue;
        const maxWeight = Math.max(...logs.map((l) => l.weight));
        const name = ex.exercise.name;
        if (!overloadMap.has(name)) overloadMap.set(name, []);
        overloadMap.get(name)!.push({ date: dateStr, maxWeight });
      }
    }
    const progressiveOverload = Array.from(overloadMap.entries())
      .filter(([, data]) => data.length >= 2)
      .map(([exerciseName, data]) => ({
        exerciseName,
        data: data.sort((a, b) => a.date.localeCompare(b.date)),
      }))
      .sort((a, b) => b.data.length - a.data.length);

    // ── Personal records (all-time, not limited by period) ──
    const allWorkouts = since
      ? await prisma.workout.findMany({
          where: { userId: user.id, completed: true },
          include: {
            exercises: {
              include: {
                exercise: { select: { name: true, muscleGroup: true } },
              },
            },
          },
          orderBy: { date: 'asc' },
        })
      : workouts;

    const prMap = new Map<
      string,
      { muscleGroup: string; prWeight: number; prReps: number; prDate: string }
    >();
    for (const w of allWorkouts) {
      const dateStr = w.date.toISOString().split('T')[0];
      for (const ex of w.exercises) {
        if (!ex.exercise) continue;
        const logs = parseSetLogs(ex.setLogs);
        for (const log of logs) {
          const name = ex.exercise.name;
          const existing = prMap.get(name);
          if (!existing || log.weight > existing.prWeight) {
            prMap.set(name, {
              muscleGroup: ex.exercise.muscleGroup,
              prWeight: log.weight,
              prReps: log.reps,
              prDate: dateStr,
            });
          }
        }
      }
    }
    const personalRecords = Array.from(prMap.entries())
      .map(([exerciseName, data]) => ({ exerciseName, ...data }))
      .sort((a, b) => b.prDate.localeCompare(a.prDate));

    // ── Plateau detection (compound exercises stuck for 4+ sessions) ──
    const plateaus: { exerciseName: string; stuckAtWeight: number; sessionCount: number; lastDate: string }[] = [];
    for (const [exerciseName, data] of overloadMap.entries()) {
      if (data.length < 4) continue;
      const recent = data.slice(-4);
      const maxWeights = recent.map((d) => d.maxWeight);
      const maxOfRecent = Math.max(...maxWeights);
      const allSame = maxWeights.every((w) => w <= maxWeights[0]);
      if (allSame || maxOfRecent <= maxWeights[0]) {
        plateaus.push({
          exerciseName,
          stuckAtWeight: maxWeights[0],
          sessionCount: recent.length,
          lastDate: recent[recent.length - 1].date,
        });
      }
    }

    // ── Rep range analysis ──
    const repRanges = [
      { range: '1-5', label: 'Strength', min: 1, max: 5 },
      { range: '6-8', label: 'Strength-Hypertrophy', min: 6, max: 8 },
      { range: '8-12', label: 'Hypertrophy', min: 8, max: 12 },
      { range: '12+', label: 'Endurance', min: 12, max: Infinity },
    ];
    const rangeCounts = repRanges.map((r) => ({
      ...r,
      totalSets: 0,
      totalWeight: 0,
    }));

    for (const w of workouts) {
      for (const ex of w.exercises) {
        const logs = parseSetLogs(ex.setLogs);
        for (const log of logs) {
          for (const bucket of rangeCounts) {
            if (
              (bucket.min <= log.reps && log.reps <= bucket.max) ||
              (bucket.max === Infinity && log.reps >= bucket.min)
            ) {
              bucket.totalSets++;
              bucket.totalWeight += log.weight;
              break;
            }
          }
        }
      }
    }

    const totalSets = rangeCounts.reduce((sum, r) => sum + r.totalSets, 0);
    const repRangeAnalysis = rangeCounts
      .filter((r) => r.totalSets > 0)
      .map((r) => ({
        range: r.range,
        totalSets: r.totalSets,
        avgWeight: r.totalSets > 0 ? Math.round(r.totalWeight / r.totalSets) : 0,
        percentage: totalSets > 0 ? Math.round((r.totalSets / totalSets) * 100) : 0,
      }));

    const totalWorkouts = workouts.length;
    const avgVolumePerSession = totalWorkouts > 0 ? Math.round(totalVolume / totalWorkouts) : 0;

    return NextResponse.json({
      period,
      totalWorkouts,
      totalVolume: Math.round(totalVolume),
      avgVolumePerSession,
      volumeBySession,
      volumeByWeek,
      progressiveOverload,
      personalRecords,
      plateaus,
      repRangeAnalysis,
    });
  } catch (error) {
    console.error('[analytics] GET error:', error);
    return NextResponse.json({ error: 'Failed to compute analytics' }, { status: 500 });
  }
});
