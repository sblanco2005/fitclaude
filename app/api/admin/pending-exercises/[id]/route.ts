import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdmin } from '@/lib/auth/admin';
import { AuthErrors } from '@/lib/auth/middleware';

export const PATCH = withAdmin(
  async (request: NextRequest, _user, params) => {
    const id = params?.id;
    if (!id) return AuthErrors.notFound('Pending exercise');

    const { action } = await request.json();

    if (action === 'approve') {
      // Get the pending exercise with variations
      const pending = await prisma.pendingExercise.findUnique({
        where: { id },
        include: { pendingVariations: true },
      });
      if (!pending) return AuthErrors.notFound('Pending exercise');

      // Check for duplicate name in main exercises table
      const existing = await prisma.exercise.findUnique({
        where: { name: pending.name },
      });
      if (existing) {
        return NextResponse.json(
          { error: `Exercise "${pending.name}" already exists` },
          { status: 409 }
        );
      }

      // Create the exercise + variations in a transaction
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

        // Create variations if any
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

        // Mark pending as approved
        await tx.pendingExercise.update({
          where: { id },
          data: { status: 'approved', reviewedAt: new Date() },
        });
      });

      return NextResponse.json({ status: 'approved', id });
    }

    if (action === 'reject') {
      await prisma.pendingExercise.update({
        where: { id },
        data: { status: 'rejected', reviewedAt: new Date() },
      });
      return NextResponse.json({ status: 'rejected', id });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }
);

export const DELETE = withAdmin(
  async (_request: NextRequest, _user, params) => {
    const id = params?.id;
    if (!id) return AuthErrors.notFound('Pending exercise');

    await prisma.pendingExercise.delete({ where: { id } });
    return NextResponse.json({ deleted: true, id });
  }
);
