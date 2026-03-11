import type { WorkoutExercise, ExerciseGroup } from '@/types';

/**
 * Group consecutive exercises by supersetGroup.
 * Standalone exercises (no supersetGroup) become a group of 1.
 * Superset pairs (same supersetGroup letter) become a group of 2+.
 * This gives the "logical exercise count" where each superset = 1.
 */
export function groupExercises(exercises: WorkoutExercise[]): ExerciseGroup[] {
  const groups: ExerciseGroup[] = [];
  const sorted = [...exercises].sort((a, b) => a.order - b.order);

  for (const ex of sorted) {
    const group = ex.supersetGroup ?? null;

    if (group) {
      // Try to find an existing group with this label
      const existing = groups.find((g) => g.supersetGroup === group);
      if (existing) {
        existing.exercises.push(ex);
      } else {
        groups.push({ supersetGroup: group, exercises: [ex] });
      }
    } else {
      // Standalone exercise — its own group
      groups.push({ supersetGroup: null, exercises: [ex] });
    }
  }

  return groups;
}
