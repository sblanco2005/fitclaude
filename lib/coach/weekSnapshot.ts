import { prisma } from '@/lib/prisma';
import { resolveLocalDayParts, weekBounds } from '@/lib/dates';
import { parseStoredSetLogs, topSetByE1RM, type SetLog } from './setLogs';

export type ExerciseProgression = {
  exerciseName: string;
  muscleGroup: string | null;
  thisWeekTop: { weight: number; reps: number };
  previousTop: { weight: number; reps: number } | null;
  delta: 'stronger' | 'same' | 'weaker' | 'new';
};

export type WeekSnapshot = {
  user: {
    goal: string | null;
    experience: string | null;
    frequencyTarget: number | null;
    weightKg: number | null;
  };
  weeks: {
    thisWeek: { start: string; end: string };
    lastWeek: { start: string; end: string };
  };
  training: {
    thisWeek: {
      sessionsCompleted: number;
      sessionsTarget: number | null;
      musclesHit: string[];
      totalSets: number;
      daysSinceLastWorkout: number | null;
    };
    lastWeek: {
      sessionsCompleted: number;
      musclesHit: string[];
      totalSets: number;
    };
    progression: ExerciseProgression[];
  };
  nutrition: {
    thisWeek: { avgCalories: number; avgProteinG: number; daysLogged: number };
    lastWeek: { avgCalories: number; avgProteinG: number; daysLogged: number };
    targets: { calories: number | null; proteinG: number | null };
  };
  nextUp: { dayLabel: string; dayType: string; weekday: number } | null;
};

function getExName(ex: { exercise?: { name: string } | null; notes?: string | null }): string {
  return ex.exercise?.name || ex.notes?.split('|')[0] || 'Exercise';
}

function getMuscleName(ex: { exercise?: { muscleGroup?: string } | null }): string | null {
  return ex.exercise?.muscleGroup ?? null;
}

export async function buildWeekSnapshot(userId: string, tz: string | null): Promise<WeekSnapshot> {
  const { thisWeekStart, thisWeekEnd, lastWeekStart, lastWeekEnd } = weekBounds(tz);

  // Fetch user profile, workouts (2 weeks), nutrition summaries, and program
  const [user, workouts, summaries, todayLogs, program] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        fitnessGoal: true,
        experienceLevel: true,
        trainingFrequency: true,
        weightKg: true,
        dailyCalorieTarget: true,
        dailyProteinTarget: true,
      },
    }),
    prisma.workout.findMany({
      where: {
        userId,
        completed: true,
        date: { gte: lastWeekStart, lt: thisWeekEnd },
      },
      include: {
        exercises: { include: { exercise: { select: { name: true, muscleGroup: true } } } },
      },
      orderBy: { date: 'desc' },
    }),
    prisma.dailyNutritionSummary.findMany({
      where: { userId, date: { gte: lastWeekStart, lt: thisWeekEnd } },
    }),
    // Live nutrition for today (may not be closed yet)
    prisma.nutritionLog.findMany({
      where: {
        userId,
        date: { gte: thisWeekStart, lt: thisWeekEnd },
      },
      select: { calories: true, proteinG: true, date: true },
    }),
    prisma.trainingProgram.findFirst({
      where: { userId, isActive: true },
      include: { days: true },
    }),
  ]);

  // Split workouts by week
  const thisWeekWorkouts = workouts.filter((w) => w.date >= thisWeekStart && w.date < thisWeekEnd);
  const lastWeekWorkouts = workouts.filter((w) => w.date >= lastWeekStart && w.date < lastWeekEnd);

  // -- Training stats --
  const musclesHit = (wks: typeof workouts) => {
    const set = new Set<string>();
    for (const w of wks) {
      for (const ex of w.exercises) {
        const m = getMuscleName(ex);
        if (m) set.add(m.toLowerCase());
      }
    }
    return Array.from(set);
  };

  const totalSets = (wks: typeof workouts) => {
    let count = 0;
    for (const w of wks) {
      for (const ex of w.exercises) {
        const logs = parseStoredSetLogs(ex.setLogs);
        count += logs.length || ex.sets;
      }
    }
    return count;
  };

  // Days since last workout
  let daysSinceLastWorkout: number | null = null;
  if (workouts.length > 0) {
    const most = workouts[0].date;
    daysSinceLastWorkout = Math.floor((Date.now() - most.getTime()) / (1000 * 60 * 60 * 24));
  }

  // -- Strength progression --
  // "Top set" = set with the highest estimated 1RM using the Epley formula:
  //   e1RM = weight × (1 + reps / 30)
  // This is compared across sessions (not just highest weight), so a 185×8
  // correctly ranks above a 200×1 attempt.  The ±2% threshold avoids noise.
  const exerciseMap = new Map<string, { muscle: string | null; topSet: SetLog }>();
  for (const w of thisWeekWorkouts) {
    for (const ex of w.exercises) {
      const name = getExName(ex);
      const logs = parseStoredSetLogs(ex.setLogs);
      const top = topSetByE1RM(logs);
      if (!top) continue;
      const existing = exerciseMap.get(name);
      const newE1rm = top.weight * (1 + top.reps / 30);
      const existingE1rm = existing ? existing.topSet.weight * (1 + existing.topSet.reps / 30) : -Infinity;
      if (newE1rm > existingE1rm) {
        exerciseMap.set(name, { muscle: getMuscleName(ex), topSet: top });
      }
    }
  }

  // Gather historical top sets from before this week
  const historicalBests = new Map<string, { weight: number; reps: number }>();
  const olderWorkouts = await prisma.workout.findMany({
    where: {
      userId,
      completed: true,
      date: { lt: thisWeekStart },
    },
    include: { exercises: { include: { exercise: { select: { name: true } } } } },
    orderBy: { date: 'desc' },
    take: 50,
  });

  for (const w of olderWorkouts) {
    for (const ex of w.exercises) {
      const name = getExName(ex);
      if (!exerciseMap.has(name)) continue;
      if (historicalBests.has(name)) continue;
      const logs = parseStoredSetLogs(ex.setLogs);
      const top = topSetByE1RM(logs);
      if (top) {
        historicalBests.set(name, { weight: top.weight, reps: top.reps });
      }
    }
  }

  const progression: ExerciseProgression[] = [];
  for (const [name, { muscle, topSet }] of exerciseMap.entries()) {
    const prev = historicalBests.get(name);
    let delta: ExerciseProgression['delta'] = 'new';
    if (prev) {
      const thisE1rm = topSet.weight * (1 + topSet.reps / 30);
      const prevE1rm = prev.weight * (1 + prev.reps / 30);
      const diff = ((thisE1rm - prevE1rm) / prevE1rm) * 100;
      if (diff > 2) delta = 'stronger';
      else if (diff < -2) delta = 'weaker';
      else delta = 'same';
    }
    progression.push({
      exerciseName: name,
      muscleGroup: muscle,
      thisWeekTop: { weight: topSet.weight, reps: topSet.reps },
      previousTop: prev ?? null,
      delta,
    });
  }

  // -- Nutrition --
  // Combine DailyNutritionSummary (closed days) + live NutritionLog (open days)
  // by grouping per calendar day.
  const nutDayMap = new Map<string, { cal: number; pro: number }>();

  for (const s of summaries) {
    const key = new Date(s.date).toISOString().slice(0, 10);
    nutDayMap.set(key, { cal: s.calories, pro: s.proteinG });
  }

  // Add live logs (grouped by date string) for open days not in summaries
  for (const log of todayLogs) {
    const key = log.date.toISOString().slice(0, 10);
    if (nutDayMap.has(key)) continue;
    const existing = nutDayMap.get(key) || { cal: 0, pro: 0 };
    existing.cal += log.calories ?? 0;
    existing.pro += log.proteinG ?? 0;
    nutDayMap.set(key, existing);
  }

  const thisWeekStartStr = thisWeekStart.toISOString().slice(0, 10);
  const lastWeekStartStr = lastWeekStart.toISOString().slice(0, 10);
  const lastWeekEndStr = lastWeekEnd.toISOString().slice(0, 10);

  const avgNut = (startStr: string, endStr: string) => {
    let days = 0, cal = 0, pro = 0;
    for (const [dateStr, vals] of nutDayMap.entries()) {
      // Only count days with actual data — avoids deflating the average with an
      // empty current day (cron runs at 3am; today's logs haven't happened yet).
      if (dateStr >= startStr && dateStr < endStr && (vals.cal > 0 || vals.pro > 0)) {
        days++;
        cal += vals.cal;
        pro += vals.pro;
      }
    }
    return {
      avgCalories: days > 0 ? Math.round(cal / days) : 0,
      avgProteinG: days > 0 ? Math.round(pro / days) : 0,
      daysLogged: days,
    };
  };

  const thisWeekEndStr = thisWeekEnd.toISOString().slice(0, 10);

  // -- Next up (tomorrow's program day) --
  let nextUp: WeekSnapshot['nextUp'] = null;
  if (program) {
    const local = resolveLocalDayParts(tz);
    const tomorrowWeekday = (local.weekday + 1) % 7;
    const day = program.days.find(
      (d) => d.weekday === tomorrowWeekday && d.weekNumber === program.currentWeek
    );
    if (day && day.dayType !== 'rest') {
      nextUp = { dayLabel: day.dayLabel, dayType: day.dayType, weekday: day.weekday };
    }
  }

  return {
    user: {
      goal: user?.fitnessGoal ?? null,
      experience: user?.experienceLevel ?? null,
      frequencyTarget: user?.trainingFrequency ?? null,
      weightKg: user?.weightKg ?? null,
    },
    weeks: {
      thisWeek: { start: thisWeekStart.toISOString(), end: thisWeekEnd.toISOString() },
      lastWeek: { start: lastWeekStart.toISOString(), end: lastWeekEnd.toISOString() },
    },
    training: {
      thisWeek: {
        sessionsCompleted: thisWeekWorkouts.length,
        sessionsTarget: user?.trainingFrequency ?? null,
        musclesHit: musclesHit(thisWeekWorkouts),
        totalSets: totalSets(thisWeekWorkouts),
        daysSinceLastWorkout,
      },
      lastWeek: {
        sessionsCompleted: lastWeekWorkouts.length,
        musclesHit: musclesHit(lastWeekWorkouts),
        totalSets: totalSets(lastWeekWorkouts),
      },
      progression,
    },
    nutrition: {
      thisWeek: avgNut(thisWeekStartStr, thisWeekEndStr),
      lastWeek: avgNut(lastWeekStartStr, lastWeekEndStr),
      targets: {
        calories: user?.dailyCalorieTarget ?? null,
        proteinG: user?.dailyProteinTarget ?? null,
      },
    },
    nextUp,
  };
}
