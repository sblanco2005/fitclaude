import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdmin } from '@/lib/auth/admin';

export const POST = withAdmin(async (request: NextRequest) => {
  const { ids, action } = await request.json();

  if (action === 'delete-all') {
    await prisma.pendingVariation.deleteMany({});
    const count = await prisma.pendingExercise.deleteMany({});
    return NextResponse.json({ deleted: count.count });
  }

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids required' }, { status: 400 });
  }

  if (action === 'approve') {
    // Process each one individually to handle exercise creation
    const results = { approved: 0, skipped: 0, errors: [] as string[] };

    for (const id of ids) {
      const pending = await prisma.pendingExercise.findUnique({
        where: { id },
        include: { pendingVariations: true },
      });
      if (!pending) {
        results.errors.push(`${id}: not found`);
        continue;
      }

      const existing = await prisma.exercise.findUnique({
        where: { name: pending.name },
      });
      if (existing) {
        results.skipped++;
        await prisma.pendingExercise.update({
          where: { id },
          data: { status: 'rejected', reviewedAt: new Date() },
        });
        continue;
      }

      await prisma.$transaction(async (tx) => {
        const exercise = await tx.exercise.create({
          data: {
            name: pending.name,
            muscleGroup: pending.muscleGroup,
            secondaryMuscles: pending.secondaryMuscles,
            equipmentRequired: pending.equipmentRequired,
            difficulty: pending.difficulty,
            exerciseType: pending.exerciseType,
            instructions: pending.instructions,
          },
        });

        if (pending.pendingVariations.length > 0) {
          await tx.exerciseVariation.createMany({
            data: pending.pendingVariations.map((v) => ({
              baseExerciseId: exercise.id,
              name: v.name,
              spicyLevel: v.spicyLevel,
              modificationType: v.modificationType,
              description: v.description,
              additionalEquipment: v.additionalEquipment,
            })),
          });
        }

        await tx.pendingExercise.update({
          where: { id },
          data: { status: 'approved', reviewedAt: new Date() },
        });
      });

      results.approved++;
    }

    return NextResponse.json(results);
  }

  if (action === 'reject') {
    await prisma.pendingExercise.updateMany({
      where: { id: { in: ids } },
      data: { status: 'rejected', reviewedAt: new Date() },
    });
    return NextResponse.json({ rejected: ids.length });
  }

  if (action === 'delete') {
    await prisma.pendingExercise.deleteMany({
      where: { id: { in: ids } },
    });
    return NextResponse.json({ deleted: ids.length });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
});
