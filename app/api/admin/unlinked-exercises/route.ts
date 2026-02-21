import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdmin } from '@/lib/auth/admin';

/**
 * GET /api/admin/unlinked-exercises
 * Returns two lists:
 * 1. Exercises in the library that have no approved video
 * 2. Exercises that appear in workouts but aren't in the Exercise library at all
 */
export const GET = withAdmin(async () => {
  // 1. Exercises in library without approved videos
  const exercises = await prisma.exercise.findMany({
    select: {
      id: true,
      name: true,
      muscleGroup: true,
      videos: {
        select: {
          id: true,
          status: true,
          videoType: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  const noApprovedVideo = exercises
    .filter((ex) => !ex.videos.some((v) => v.status === 'approved'))
    .map((ex) => ({
      id: ex.id,
      name: ex.name,
      muscleGroup: ex.muscleGroup,
      pendingCount: ex.videos.filter((v) => v.status === 'pending').length,
      rejectedCount: ex.videos.filter((v) => v.status === 'rejected').length,
      source: 'library' as const,
    }));

  // 2. WorkoutExercises with no exerciseId (not linked to library at all)
  //    These have exercise info stored in the notes field as "name|muscleGroup|tip"
  const orphanedWorkoutExercises = await prisma.workoutExercise.findMany({
    where: { exerciseId: null },
    select: { id: true, notes: true },
  });

  // Extract unique exercise names from orphaned workout exercises
  const libraryNames = new Set(exercises.map((e) => e.name.toLowerCase()));
  const seenOrphans = new Map<string, { name: string; muscleGroup: string }>();

  for (const we of orphanedWorkoutExercises) {
    if (!we.notes || !we.notes.includes('|')) continue;
    const [name, muscleGroup] = we.notes.split('|');
    const trimmedName = name?.trim();
    if (!trimmedName) continue;
    // Skip if already in library (case-insensitive)
    if (libraryNames.has(trimmedName.toLowerCase())) continue;
    // Skip duplicates
    if (seenOrphans.has(trimmedName.toLowerCase())) continue;
    seenOrphans.set(trimmedName.toLowerCase(), {
      name: trimmedName,
      muscleGroup: muscleGroup?.trim() || 'unknown',
    });
  }

  const orphans = Array.from(seenOrphans.values()).map((o) => ({
    id: null,
    name: o.name,
    muscleGroup: o.muscleGroup,
    pendingCount: 0,
    rejectedCount: 0,
    source: 'workout' as const, // Not in library — only in workout notes
  }));

  return NextResponse.json([...noApprovedVideo, ...orphans]);
});
