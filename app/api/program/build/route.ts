import { NextResponse } from 'next/server';
import { withAuth, AuthErrors } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';

// Deterministic program builder — no LLM in the save path. MiniMax reliably
// *designs* a split but won't emit the generate_program tool call (even forced),
// so program creation is built in code here: assign day types from a split +
// training days, pick exercises from the seeded library by muscle group (and,
// loosely, the user's equipment), and persist the program + per-day routines.

type SplitType = 'ppl' | 'upper_lower' | 'full_body';

const SPLIT_ROTATION: Record<SplitType, string[]> = {
  ppl: ['push', 'pull', 'legs'],
  upper_lower: ['upper', 'lower'],
  full_body: ['full_body'],
};

// workout_type → target muscle groups, in selection priority order.
const WT_MUSCLES: Record<string, string[]> = {
  push: ['chest', 'shoulders', 'triceps'],
  pull: ['back', 'biceps'],
  legs: ['quadriceps', 'hamstrings', 'glutes', 'calves'],
  upper: ['chest', 'back', 'shoulders', 'biceps', 'triceps'],
  lower: ['quadriceps', 'hamstrings', 'glutes', 'calves'],
  full_body: ['full_body', 'chest', 'back', 'quadriceps', 'shoulders'],
};

const TARGET_COUNT = 6;
const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

type Ex = { id: string; name: string; muscleGroup: string; exerciseType: string; equipmentRequired: string | null };
type TemplateItem = { name: string; muscle_group: string; sets: number; reps: string; is_primary: boolean; notes: string; _id: string | null };

// Pick a coherent set of exercises for a workout_type. `pool` is equipment-filtered;
// `all` is the fallback so a filter never leaves a muscle group empty.
function pickExercises(wt: string, pool: Ex[], all: Ex[]): TemplateItem[] {
  const muscles = WT_MUSCLES[wt] ?? ['full_body'];
  const chosen: { e: Ex; primary: boolean }[] = [];
  const used = new Set<string>();

  const forMuscle = (m: string, src: Ex[]) => src.filter((e) => e.muscleGroup === m && !used.has(e.id));

  // Pass 1 — one compound per muscle group as the primary lift.
  for (const m of muscles) {
    let compounds = forMuscle(m, pool).filter((e) => e.exerciseType === 'compound');
    if (!compounds.length) compounds = forMuscle(m, all).filter((e) => e.exerciseType === 'compound');
    if (!compounds.length) compounds = forMuscle(m, pool);
    if (!compounds.length) compounds = forMuscle(m, all);
    if (compounds.length) { chosen.push({ e: compounds[0], primary: true }); used.add(compounds[0].id); }
  }

  // Pass 2 — fill with accessories, round-robin across the muscle groups.
  let guard = 0;
  while (chosen.length < TARGET_COUNT && guard < muscles.length * 5) {
    const m = muscles[guard % muscles.length];
    guard++;
    let rest = forMuscle(m, pool);
    if (!rest.length) rest = forMuscle(m, all);
    if (rest.length) { chosen.push({ e: rest[0], primary: rest[0].exerciseType === 'compound' }); used.add(rest[0].id); }
  }

  return chosen.map(({ e, primary }) => {
    const isCore = e.muscleGroup === 'core';
    return {
      name: e.name,
      muscle_group: e.muscleGroup,
      sets: primary ? 4 : 3,
      reps: isCore ? '12-15' : primary ? '6-8' : '10-12',
      is_primary: primary,
      notes: '',
      _id: e.id,
    };
  });
}

export const POST = withAuth(async (request, user) => {
  try {
    const body = await request.json();
    const name: string = (typeof body.name === 'string' ? body.name.trim() : '').slice(0, 40) || 'New program';
    const totalWeeks = Math.max(1, Math.min(4, Number(body.totalWeeks) || 1));
    // Preferred: explicit per-day assignments [{weekday, workoutType}]. Falls back
    // to a split rotation over trainingDays (legacy / safety).
    const validWt = (wt: unknown): wt is string => typeof wt === 'string' && wt in WT_MUSCLES;
    const assignByWeekday = new Map<number, string>();
    if (Array.isArray(body.assignments)) {
      for (const a of body.assignments) {
        if (a && Number.isInteger(a.weekday) && a.weekday >= 0 && a.weekday <= 6) {
          assignByWeekday.set(a.weekday, validWt(a.workoutType) ? a.workoutType : 'full_body');
        }
      }
    } else {
      const splitType: SplitType = (['ppl', 'upper_lower', 'full_body'].includes(body.splitType) ? body.splitType : 'ppl');
      const trainingDays: number[] = Array.isArray(body.trainingDays)
        ? [...new Set(body.trainingDays.filter((d: unknown) => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6))].sort((a, b) => (a as number) - (b as number)) as number[]
        : [];
      const rotation = SPLIT_ROTATION[splitType];
      trainingDays.forEach((wd, i) => assignByWeekday.set(wd, rotation[i % rotation.length]));
    }

    if (!assignByWeekday.size) return NextResponse.json({ error: 'Pick at least one training day' }, { status: 400 });

    // Cap: 3 programs per user.
    const existing = await prisma.trainingProgram.findMany({ where: { userId: user.id }, select: { id: true } });
    if (existing.length >= 3) return NextResponse.json({ error: 'You already have the max of 3 programs. Delete one first.' }, { status: 400 });

    const [profile, exercises, maxDisplay] = await Promise.all([
      prisma.user.findUnique({ where: { id: user.id }, select: { gymType: true, equipmentText: true } }),
      prisma.exercise.findMany({ select: { id: true, name: true, muscleGroup: true, exerciseType: true, equipmentRequired: true } }),
      prisma.workout.aggregate({ where: { userId: user.id }, _max: { displayId: true } }),
    ]);

    // Equipment for THIS program: request values override the profile, so a
    // "Vacation / hotel gym" program can use limited equipment without changing
    // the user's default. full_gym → no filter; own_gym → filter by equipmentText.
    const gymType = body.gymType === 'own_gym' ? 'own_gym' : body.gymType === 'full_gym' ? 'full_gym' : (profile?.gymType ?? 'full_gym');
    const equipmentText = (typeof body.equipmentText === 'string' && body.equipmentText.trim()) ? body.equipmentText : (profile?.equipmentText ?? '');
    const eqText = gymType === 'own_gym' && equipmentText ? equipmentText.toLowerCase() : null;
    const allowed = (e: Ex) => {
      if (!eqText) return true;
      const req = (e.equipmentRequired ?? '').toLowerCase().trim();
      if (!req || req === 'none' || req.includes('body')) return true;
      return req.split(/[,/&]/).some((tok) => tok.trim() && eqText.includes(tok.trim()));
    };
    const pool = exercises.filter(allowed);
    let displayId = (maxDisplay._max.displayId ?? 0) + 1;

    const result = await prisma.$transaction(async (tx) => {
      // Keep the current Main as-is: a new program becomes the active Main only
      // if the user has none yet; otherwise it's created as a switchable secondary.
      const hasActive = await tx.trainingProgram.findFirst({ where: { userId: user.id, isActive: true }, select: { id: true } });
      const makeActive = !hasActive;

      const program = await tx.trainingProgram.create({
        data: { userId: user.id, name, totalWeeks, currentWeek: 1, isActive: makeActive },
        select: { id: true, isActive: true },
      });

      for (let w = 1; w <= totalWeeks; w++) {
        for (let wd = 0; wd <= 6; wd++) {
          const wt = assignByWeekday.get(wd);
          if (!wt) {
            await tx.programDay.create({
              data: { programId: program.id, weekday: wd, weekNumber: w, dayType: 'rest', dayLabel: 'Rest' },
            });
            continue;
          }
          const template = pickExercises(wt, pool, exercises);
          const muscles = [...new Set(template.filter((t) => t.is_primary).map((t) => t.muscle_group))].slice(0, 3);
          const dayLabel = (muscles.length ? muscles : [wt]).map(titleCase).join(' + ');

          const day = await tx.programDay.create({
            data: {
              programId: program.id,
              weekday: wd,
              weekNumber: w,
              dayType: 'coached',
              dayLabel,
              workoutType: wt,
              exerciseTemplate: JSON.stringify(template.map(({ _id, ...t }) => t)),
            },
            select: { id: true },
          });

          // Linked routine so "Hit It" works.
          const routine = await tx.workout.create({
            data: {
              userId: user.id,
              name: dayLabel.toLowerCase(),
              workoutType: wt,
              category: 'lifting',
              source: 'coach',
              displayId: displayId++,
              programDayId: day.id,
              completed: false,
            },
            select: { id: true },
          });
          await tx.workoutExercise.createMany({
            data: template.map((t, i) => ({
              workoutId: routine.id,
              exerciseId: t._id,
              order: i + 1,
              sets: t.sets,
              reps: t.reps,
              restSeconds: t.is_primary ? 120 : 75,
              notes: `${t.name}|${t.muscle_group}|`,
            })),
          });
        }
      }
      return program;
    }, { timeout: 25000 });

    return NextResponse.json({ ok: true, programId: result.id, name, isActive: result.isActive });
  } catch (error) {
    console.error('Failed to build program:', error);
    return NextResponse.json({ error: 'Failed to build program' }, { status: 500 });
  }
});
