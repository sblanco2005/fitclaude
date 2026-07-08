import { NextResponse } from 'next/server';
import { withAuth, AuthErrors } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';
import { pickForFocus, typeForFocus, titleCase, type Ex } from '@/lib/program/exercises';

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


export const POST = withAuth(async (request, user) => {
  try {
    const body = await request.json();
    const name: string = (typeof body.name === 'string' ? body.name.trim() : '').slice(0, 40) || 'New program';
    const totalWeeks = Math.max(1, Math.min(4, Number(body.totalWeeks) || 1));
    // Per-day assignments [{weekday, focus, weekNumber?}]. focus is free text
    // ("Push & Pull", "Deadlifts & Back"). An assignment WITH weekNumber applies
    // only to that week; WITHOUT weekNumber it applies to every week. Falls back
    // to a split rotation over trainingDays (legacy / safety).
    const perWeek = new Map<number, Map<number, string>>(); // week -> (weekday -> focus)
    const allWeeks = new Map<number, string>(); // weekday -> focus, applies to every week
    const focusOf = (a: { focus?: unknown; workoutType?: unknown }) =>
      (typeof a.focus === 'string' && a.focus.trim())
        ? a.focus.trim().slice(0, 60)
        : (typeof a.workoutType === 'string' && a.workoutType ? a.workoutType : 'full body');
    if (Array.isArray(body.assignments)) {
      for (const a of body.assignments) {
        if (a && Number.isInteger(a.weekday) && a.weekday >= 0 && a.weekday <= 6) {
          if (Number.isInteger(a.weekNumber) && a.weekNumber >= 1) {
            if (!perWeek.has(a.weekNumber)) perWeek.set(a.weekNumber, new Map());
            perWeek.get(a.weekNumber)!.set(a.weekday, focusOf(a));
          } else {
            allWeeks.set(a.weekday, focusOf(a));
          }
        }
      }
    } else {
      const splitType: SplitType = (['ppl', 'upper_lower', 'full_body'].includes(body.splitType) ? body.splitType : 'ppl');
      const trainingDays: number[] = Array.isArray(body.trainingDays)
        ? [...new Set(body.trainingDays.filter((d: unknown) => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6))].sort((a, b) => (a as number) - (b as number)) as number[]
        : [];
      const rotation = SPLIT_ROTATION[splitType];
      trainingDays.forEach((wd, i) => allWeeks.set(wd, rotation[i % rotation.length]));
    }

    if (!perWeek.size && !allWeeks.size) return NextResponse.json({ error: 'Pick at least one training day' }, { status: 400 });

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
          const focus = perWeek.get(w)?.get(wd) ?? allWeeks.get(wd);
          if (!focus) {
            await tx.programDay.create({
              data: { programId: program.id, weekday: wd, weekNumber: w, dayType: 'rest', dayLabel: 'Rest' },
            });
            continue;
          }
          const template = pickForFocus(focus, pool, exercises);
          // The day is labeled with the user's own focus text ("Deadlifts & Back").
          const dayLabel = titleCase(focus);
          const wtLabel = typeForFocus(focus);

          const day = await tx.programDay.create({
            data: {
              programId: program.id,
              weekday: wd,
              weekNumber: w,
              dayType: 'coached',
              dayLabel,
              workoutType: wtLabel,
              exerciseTemplate: JSON.stringify(template.map(({ _id, ...t }) => t)),
            },
            select: { id: true },
          });

          // Linked routine so "Hit It" works.
          const routine = await tx.workout.create({
            data: {
              userId: user.id,
              name: dayLabel.toLowerCase(),
              workoutType: wtLabel,
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
