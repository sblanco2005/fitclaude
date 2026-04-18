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
      const now = new Date();
      let todayLocal: string;
      try {
        todayLocal = now.toLocaleDateString('en-CA', { timeZone: timezone });
      } catch {
        todayLocal = now.toISOString().split('T')[0];
      }

      if (period === 'week') {
        // This week: Monday to today
        const today = new Date(todayLocal + 'T12:00:00Z');
        const dayOfWeek = today.getUTCDay(); // 0=Sun, 1=Mon
        const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const monday = new Date(today);
        monday.setUTCDate(today.getUTCDate() - daysSinceMonday);
        const sinceStr = monday.toISOString().split('T')[0];
        since = getUserDayBounds(timezone, sinceStr).start;
      } else {
        const daysMap: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 };
        const days = daysMap[period] || 30;
        const sinceDate = new Date(todayLocal + 'T00:00:00Z');
        sinceDate.setDate(sinceDate.getDate() - days);
        const sinceStr = sinceDate.toISOString().split('T')[0];
        since = getUserDayBounds(timezone, sinceStr).start;
      }
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
    const sessions: {
      date: string;
      name: string;
      volume: number;
      totalSets: number;
      exerciseCount: number;
      fatigueRating: number | null;
      musclesHit: string[];
    }[] = [];
    let totalVolume = 0;
    let totalSets = 0;

    for (const w of workouts) {
      let sessionVolume = 0;
      let sessionSets = 0;
      const musclesHit = new Set<string>();
      for (const ex of w.exercises) {
        const logs = parseSetLogs(ex.setLogs);
        sessionSets += logs.length;
        for (const log of logs) {
          sessionVolume += log.weight * log.reps;
        }
        if (ex.exercise?.muscleGroup) musclesHit.add(ex.exercise.muscleGroup);
      }
      totalVolume += sessionVolume;
      totalSets += sessionSets;
      const dateStr = w.date.toISOString().split('T')[0];
      const sessionName = w.name || w.workoutType;
      volumeBySession.push({ date: dateStr, volume: Math.round(sessionVolume), name: sessionName });
      sessions.push({
        date: dateStr,
        name: sessionName,
        volume: Math.round(sessionVolume),
        totalSets: sessionSets,
        exerciseCount: w.exercises.length,
        fatigueRating: w.fatigueRating ?? null,
        musclesHit: Array.from(musclesHit),
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

    // ── Progressive overload (compound exercises: best e1RM set per session) ──
    const overloadMap = new Map<string, {
      date: string; maxWeight: number; topReps: number; e1rm: number; muscleGroup: string;
    }[]>();
    const muscleSetMap = new Map<string, number>();

    for (const w of workouts) {
      const dateStr = w.date.toISOString().split('T')[0];
      for (const ex of w.exercises) {
        // Accumulate sets per muscle group
        if (ex.exercise?.muscleGroup) {
          const mg = ex.exercise.muscleGroup;
          const logs = parseSetLogs(ex.setLogs);
          muscleSetMap.set(mg, (muscleSetMap.get(mg) || 0) + logs.length);
        }
        if (!ex.exercise || ex.exercise.exerciseType !== 'compound') continue;
        const logs = parseSetLogs(ex.setLogs);
        if (logs.length === 0) continue;
        let bestE1rm = 0, bestWeight = 0, bestReps = 0;
        for (const log of logs) {
          const e1rm = log.weight * (1 + log.reps / 30);
          if (e1rm > bestE1rm) { bestE1rm = e1rm; bestWeight = log.weight; bestReps = log.reps; }
        }
        const name = ex.exercise.name;
        if (!overloadMap.has(name)) overloadMap.set(name, []);
        overloadMap.get(name)!.push({
          date: dateStr,
          maxWeight: bestWeight,
          topReps: bestReps,
          e1rm: Math.round(bestE1rm),
          muscleGroup: ex.exercise.muscleGroup,
        });
      }
    }

    const progressiveOverload = Array.from(overloadMap.entries())
      .filter(([, data]) => data.length >= 2)
      .map(([exerciseName, data]) => ({
        exerciseName,
        data: data.sort((a, b) => a.date.localeCompare(b.date)).map(d => ({
          date: d.date, maxWeight: d.maxWeight,
        })),
      }))
      .sort((a, b) => b.data.length - a.data.length);

    // ── Key lifts (top compound exercises with e1RM + delta) ──
    const keyLifts = Array.from(overloadMap.entries())
      .map(([exerciseName, data]) => {
        const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
        const latest = sorted[sorted.length - 1];
        const oldest = sorted[0];
        const deltaPercent = sorted.length >= 2
          ? Math.round(((latest.e1rm - oldest.e1rm) / oldest.e1rm) * 1000) / 10
          : null;
        return {
          exerciseName,
          muscleGroup: latest.muscleGroup,
          topSet: { weight: latest.maxWeight, reps: latest.topReps },
          e1rm: latest.e1rm,
          prevE1rm: sorted.length >= 2 ? oldest.e1rm : null,
          deltaPercent,
        };
      })
      .sort((a, b) => b.e1rm - a.e1rm)
      .slice(0, 8);

    // ── Sets by muscle group ──
    const setsByMuscle = Array.from(muscleSetMap.entries())
      .map(([muscleGroup, sets]) => ({ muscleGroup, sets }))
      .sort((a, b) => b.sets - a.sets);

    // ── Conditioning activities (classes) ──
    const activityRows = await prisma.activity.findMany({
      where: {
        userId: user.id,
        ...(dateFilter ? { date: dateFilter } : {}),
      },
      orderBy: { date: 'asc' },
      select: { id: true, name: true, durationMinutes: true, date: true, notes: true },
    });
    const conditioningActivities = activityRows.map((a) => ({
      id: a.id,
      date: a.date.toISOString().split('T')[0],
      name: a.name,
      durationMinutes: a.durationMinutes,
      notes: a.notes,
    }));

    // ── Rest days ──
    const periodDays = since
      ? Math.ceil((Date.now() - since.getTime()) / 86400000)
      : 7;
    const activeDays = new Set([
      ...workouts.map((w) => w.date.toISOString().split('T')[0]),
      ...activityRows.map((a) => a.date.toISOString().split('T')[0]),
    ]);
    const restDays = Math.max(0, periodDays - activeDays.size);

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

    const totalRepRangeSets = rangeCounts.reduce((sum, r) => sum + r.totalSets, 0);
    const repRangeAnalysis = rangeCounts
      .filter((r) => r.totalSets > 0)
      .map((r) => ({
        range: r.range,
        totalSets: r.totalSets,
        avgWeight: r.totalSets > 0 ? Math.round(r.totalWeight / r.totalSets) : 0,
        percentage: totalRepRangeSets > 0 ? Math.round((r.totalSets / totalRepRangeSets) * 100) : 0,
      }));

    // ── Muscles worked in period ──
    const EXERCISE_TO_ANATOMY: Record<string, string[]> = {
      chest: ['chest'],
      back: ['back'],
      shoulders: ['shoulders'],
      biceps: ['biceps'],
      triceps: ['triceps'],
      core: ['core'],
      glutes: ['glutes'],
      hamstrings: ['hamstrings'],
      quadriceps: ['quadriceps'],
      calves: ['calves'],
      forearms: ['forearms'],
      legs: ['quadriceps', 'hamstrings', 'glutes', 'calves'],
      arms: ['biceps', 'triceps'],
      posterior_chain: ['back', 'glutes', 'hamstrings'],
      full_body: ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'core', 'glutes', 'hamstrings', 'quadriceps', 'calves'],
    };
    const musclesWorkedSet = new Set<string>();
    for (const w of workouts) {
      for (const ex of w.exercises) {
        if (!ex.exercise?.muscleGroup) continue;
        const mg = ex.exercise.muscleGroup.toLowerCase();
        const mapped = EXERCISE_TO_ANATOMY[mg];
        if (mapped) {
          for (const m of mapped) musclesWorkedSet.add(m);
        } else {
          musclesWorkedSet.add(mg);
        }
      }
    }
    const musclesWorked = Array.from(musclesWorkedSet);

    const totalWorkouts = workouts.length;
    const avgVolumePerSession = totalWorkouts > 0 ? Math.round(totalVolume / totalWorkouts) : 0;

    // ── Nutrition analytics ──
    const sinceDate = since
      ? new Date(since.toISOString().split('T')[0] + 'T00:00:00Z')
      : undefined;

    const nutritionSummaries = await prisma.dailyNutritionSummary.findMany({
      where: {
        userId: user.id,
        ...(sinceDate ? { date: { gte: sinceDate } } : {}),
      },
      orderBy: { date: 'asc' },
    });

    // User targets for compliance calculation
    const userProfile = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        dailyCalorieTarget: true,
        dailyProteinTarget: true,
        carbsPercent: true,
        fatPercent: true,
      },
    });

    const calTarget = userProfile?.dailyCalorieTarget ?? 0;
    const protTarget = userProfile?.dailyProteinTarget ?? 0;
    const carbsPct = userProfile?.carbsPercent ?? 50;
    const fatPct = userProfile?.fatPercent ?? 50;
    const remainingCal = Math.max(calTarget - protTarget * 4, 0);
    const carbsTarget = Math.round((remainingCal * (carbsPct / 100)) / 4);
    const fatTarget = Math.round((remainingCal * (fatPct / 100)) / 9);

    const daysLogged = nutritionSummaries.length;
    const totalCalories = nutritionSummaries.reduce((s, d) => s + d.calories, 0);
    const totalProtein = nutritionSummaries.reduce((s, d) => s + d.proteinG, 0);
    const totalCarbs = nutritionSummaries.reduce((s, d) => s + d.carbsG, 0);
    const totalFat = nutritionSummaries.reduce((s, d) => s + d.fatG, 0);

    const avgCalories = daysLogged > 0 ? Math.round(totalCalories / daysLogged) : 0;
    const avgProteinG = daysLogged > 0 ? Math.round(totalProtein / daysLogged) : 0;
    const avgCarbsG = daysLogged > 0 ? Math.round(totalCarbs / daysLogged) : 0;
    const avgFatG = daysLogged > 0 ? Math.round(totalFat / daysLogged) : 0;

    // Daily calories/macros for chart
    const caloriesByDay = nutritionSummaries.map((d) => ({
      date: d.date.toISOString().split('T')[0],
      calories: Math.round(d.calories),
      target: calTarget,
    }));

    const macrosByDay = nutritionSummaries.map((d) => ({
      date: d.date.toISOString().split('T')[0],
      protein: Math.round(d.proteinG),
      carbs: Math.round(d.carbsG),
      fat: Math.round(d.fatG),
    }));

    // Compliance: % of days meeting targets (within 10% tolerance)
    let daysCalorieHit = 0;
    let daysProteinHit = 0;
    for (const d of nutritionSummaries) {
      if (calTarget > 0 && d.calories >= calTarget * 0.9 && d.calories <= calTarget * 1.1) {
        daysCalorieHit++;
      }
      if (protTarget > 0 && d.proteinG >= protTarget * 0.9) {
        daysProteinHit++;
      }
    }
    const calorieCompliance = daysLogged > 0 ? Math.round((daysCalorieHit / daysLogged) * 100) : 0;
    const proteinCompliance = daysLogged > 0 ? Math.round((daysProteinHit / daysLogged) * 100) : 0;

    // Meal pattern: average meals per day, most common meal types
    const totalMeals = nutritionSummaries.reduce((s, d) => s + d.mealCount, 0);
    const avgMealsPerDay = daysLogged > 0 ? Math.round((totalMeals / daysLogged) * 10) / 10 : 0;

    // Most common foods (from raw logs within period)
    const nutritionLogs = await prisma.nutritionLog.findMany({
      where: {
        userId: user.id,
        ...(sinceDate ? { date: { gte: sinceDate } } : {}),
      },
      select: { rawInput: true, mealType: true, calories: true, proteinG: true },
      orderBy: { date: 'desc' },
    });

    // Count meal type distribution
    const mealTypeCounts: Record<string, number> = {};
    for (const log of nutritionLogs) {
      const type = log.mealType || 'unspecified';
      mealTypeCounts[type] = (mealTypeCounts[type] || 0) + 1;
    }
    const mealTypeDistribution = Object.entries(mealTypeCounts)
      .map(([type, count]) => ({
        type,
        count,
        percentage: nutritionLogs.length > 0 ? Math.round((count / nutritionLogs.length) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // Top foods by frequency (simple word extraction from rawInput)
    const foodCounts = new Map<string, { count: number; avgCalories: number; avgProtein: number; totalCal: number; totalProt: number }>();
    for (const log of nutritionLogs) {
      const key = log.rawInput.toLowerCase().trim().slice(0, 60);
      if (!key) continue;
      const existing = foodCounts.get(key);
      if (existing) {
        existing.count++;
        existing.totalCal += log.calories || 0;
        existing.totalProt += log.proteinG || 0;
      } else {
        foodCounts.set(key, {
          count: 1,
          avgCalories: 0,
          avgProtein: 0,
          totalCal: log.calories || 0,
          totalProt: log.proteinG || 0,
        });
      }
    }
    const topFoods = Array.from(foodCounts.entries())
      .map(([name, data]) => ({
        name,
        count: data.count,
        avgCalories: Math.round(data.totalCal / data.count),
        avgProtein: Math.round(data.totalProt / data.count),
      }))
      .filter((f) => f.count >= 2)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return NextResponse.json({
      period,
      totalWorkouts,
      totalVolume: Math.round(totalVolume),
      totalSets,
      avgVolumePerSession,
      musclesWorked,
      sessions,
      volumeBySession,
      volumeByWeek,
      progressiveOverload,
      keyLifts,
      setsByMuscle,
      conditioningActivities,
      restDays,
      personalRecords,
      plateaus,
      repRangeAnalysis,
      // Nutrition
      nutrition: {
        daysLogged,
        avgCalories,
        avgProteinG,
        avgCarbsG,
        avgFatG,
        caloriesByDay,
        macrosByDay,
        targets: {
          calories: calTarget,
          proteinG: protTarget,
          carbsG: carbsTarget,
          fatG: fatTarget,
        },
        compliance: {
          calorie: calorieCompliance,
          protein: proteinCompliance,
        },
        avgMealsPerDay,
        mealTypeDistribution,
        topFoods,
      },
    });
  } catch (error) {
    console.error('[analytics] GET error:', error);
    return NextResponse.json({ error: 'Failed to compute analytics' }, { status: 500 });
  }
});
