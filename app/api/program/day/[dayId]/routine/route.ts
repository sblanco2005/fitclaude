import { NextResponse } from 'next/server';
import { withAuth, AuthErrors } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';
import { pickForFocus, typeForFocus, titleCase, type Ex } from '@/lib/program/exercises';
import { parseCardioSegments, segmentLabel } from '@/lib/program/cardio';

// POST /api/program/day/[dayId]/routine — set a program day's routine, either by
// linking an EXISTING routine ({ routineId }) or CREATING a new one from a
// free-text focus ({ focus }). Updates the day (→ coached) and rebuilds its
// linked routine (the Hit-It workout) to match.
type Row = { exerciseId: string | null; sets: number; reps: string | null; restSeconds: number; name: string; muscle_group: string; is_primary: boolean };

export const POST = withAuth(async (request, user, params) => {
  try {
    const dayId = params?.dayId;
    if (!dayId) return AuthErrors.notFound('Day');
    const body = await request.json();

    const day = await prisma.programDay.findFirst({ where: { id: dayId, program: { userId: user.id } }, select: { id: true } });
    if (!day) return AuthErrors.notFound('Day');

    // Override the day to Rest — clear its routine template (incomplete workout)
    // and reset the day. Completed sessions stay as history.
    if (body.rest === true) {
      await prisma.$transaction(async (tx) => {
        await tx.workout.deleteMany({ where: { programDayId: day.id, completed: false } });
        await tx.programDay.update({ where: { id: day.id }, data: { dayType: 'rest', dayLabel: 'Rest', workoutType: null, exerciseTemplate: null } });
      });
      return NextResponse.json({ ok: true });
    }

    // Create a new CARDIO routine from a free-text focus ("rower 5min + run 400m").
    if ((body.mode === 'cardio' || body.cardio === true) && typeof body.focus === 'string' && body.focus.trim()) {
      const focus = body.focus.trim().slice(0, 120);
      const cardioPool = (await prisma.exercise.findMany({ where: { exerciseType: 'cardio' }, select: { id: true, name: true, muscleGroup: true, exerciseType: true, equipmentRequired: true } })) as Ex[];
      const segments = parseCardioSegments(focus, cardioPool);
      const label = titleCase(focus).slice(0, 60);
      await prisma.$transaction(async (tx) => {
        await tx.programDay.update({
          where: { id: day.id },
          data: { dayType: 'coached', dayLabel: label, workoutType: 'cardio', exerciseTemplate: JSON.stringify(segments.map((s) => ({ name: s.name, durationSeconds: s.durationSeconds, distance: s.distance, distanceUnit: s.distanceUnit, reps: s.reps, rounds: s.rounds }))) },
        });
        const existing = await tx.workout.findFirst({ where: { programDayId: day.id, completed: false }, select: { id: true } });
        let routineId = existing?.id;
        if (routineId) {
          await tx.workoutExercise.deleteMany({ where: { workoutId: routineId } });
          await tx.workout.update({ where: { id: routineId }, data: { name: label.toLowerCase(), workoutType: 'cardio', category: 'cardio' } });
        } else {
          const maxD = await tx.workout.aggregate({ where: { userId: user.id }, _max: { displayId: true } });
          const wk = await tx.workout.create({ data: { userId: user.id, name: label.toLowerCase(), workoutType: 'cardio', category: 'cardio', source: 'coach', displayId: (maxD._max.displayId ?? 0) + 1, programDayId: day.id, completed: false }, select: { id: true } });
          routineId = wk.id;
        }
        await tx.workoutExercise.createMany({
          data: segments.map((s, i) => ({ workoutId: routineId!, exerciseId: s.exerciseId, order: i + 1, sets: s.rounds, reps: s.reps, restSeconds: s.restSeconds, durationSeconds: s.durationSeconds, distance: s.distance, distanceUnit: s.distanceUnit, notes: `${s.name}||${segmentLabel(s)}` })),
        });
      }, { timeout: 20000 });
      return NextResponse.json({ ok: true });
    }

    let rows: Row[] = [];
    let dayLabel = 'Workout';
    let workoutType = 'custom';

    if (typeof body.routineId === 'string') {
      // Link an existing routine — copy its exercises into this day.
      const src = await prisma.workout.findFirst({
        where: { id: body.routineId, userId: user.id },
        include: { exercises: { orderBy: { order: 'asc' }, include: { exercise: { select: { name: true, muscleGroup: true } } } } },
      });
      if (!src) return AuthErrors.notFound('Routine');
      rows = src.exercises.map((x) => ({
        exerciseId: x.exerciseId,
        sets: x.sets,
        reps: x.reps ?? null,
        restSeconds: x.restSeconds ?? 90,
        name: x.exercise?.name ?? (x.notes?.split('|')[0] || 'Exercise'),
        muscle_group: x.exercise?.muscleGroup ?? (x.notes?.split('|')[1] || ''),
        is_primary: false,
      }));
      if (!rows.length) return NextResponse.json({ error: 'That routine has no exercises' }, { status: 400 });
      dayLabel = titleCase(src.name?.trim() || src.workoutType || 'Workout');
      workoutType = src.workoutType || 'custom';
    } else if (typeof body.focus === 'string' && body.focus.trim()) {
      // Create a new routine deterministically from the focus text.
      const focus = body.focus.trim().slice(0, 60);
      const [profile, exercises] = await Promise.all([
        prisma.user.findUnique({ where: { id: user.id }, select: { gymType: true, equipmentText: true } }),
        prisma.exercise.findMany({ select: { id: true, name: true, muscleGroup: true, exerciseType: true, equipmentRequired: true } }),
      ]);
      const eqText = profile?.gymType === 'own_gym' && profile.equipmentText ? profile.equipmentText.toLowerCase() : null;
      const allowed = (e: Ex) => {
        if (!eqText) return true;
        const req = (e.equipmentRequired ?? '').toLowerCase().trim();
        if (!req || req === 'none' || req.includes('body')) return true;
        return req.split(/[,/&]/).some((t) => t.trim() && eqText.includes(t.trim()));
      };
      const pool = (exercises as Ex[]).filter(allowed);
      const template = pickForFocus(focus, pool, exercises as Ex[]);
      rows = template.map((t) => ({ exerciseId: t._id, sets: t.sets, reps: t.reps, restSeconds: t.is_primary ? 120 : 75, name: t.name, muscle_group: t.muscle_group, is_primary: t.is_primary }));
      dayLabel = titleCase(focus);
      workoutType = typeForFocus(focus);
    } else {
      return NextResponse.json({ error: 'Provide routineId or focus' }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.programDay.update({
        where: { id: day.id },
        data: {
          dayType: 'coached',
          dayLabel,
          workoutType,
          exerciseTemplate: JSON.stringify(rows.map((r) => ({ name: r.name, muscle_group: r.muscle_group, sets: r.sets, reps: r.reps, is_primary: r.is_primary, notes: '' }))),
        },
      });

      const existing = await tx.workout.findFirst({ where: { programDayId: day.id, completed: false }, select: { id: true } });
      let routineId = existing?.id;
      if (routineId) {
        await tx.workoutExercise.deleteMany({ where: { workoutId: routineId } });
        await tx.workout.update({ where: { id: routineId }, data: { name: dayLabel.toLowerCase(), workoutType } });
      } else {
        const maxD = await tx.workout.aggregate({ where: { userId: user.id }, _max: { displayId: true } });
        const wk = await tx.workout.create({
          data: { userId: user.id, name: dayLabel.toLowerCase(), workoutType, category: 'lifting', source: 'coach', displayId: (maxD._max.displayId ?? 0) + 1, programDayId: day.id, completed: false },
          select: { id: true },
        });
        routineId = wk.id;
      }
      await tx.workoutExercise.createMany({
        data: rows.map((r, i) => ({ workoutId: routineId!, exerciseId: r.exerciseId, order: i + 1, sets: r.sets, reps: r.reps, restSeconds: r.restSeconds, notes: `${r.name}|${r.muscle_group}|` })),
      });
    }, { timeout: 20000 });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Failed to set day routine:', error);
    return NextResponse.json({ error: 'Failed to set routine' }, { status: 500 });
  }
});
