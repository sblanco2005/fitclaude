import { PrismaClient } from '@prisma/client';
import exercisesData from './exercises.json';

const prisma = new PrismaClient();

interface Variation {
  name: string;
  spicy_level: number;
  modification_type: string;
  description: string;
  additional_equipment?: string;
}

interface ExerciseData {
  name: string;
  muscle_group: string;
  secondary_muscles: string | null;
  equipment_required: string | null;
  difficulty: string;
  exercise_type: string;
  instructions: string;
  variations: Variation[];
}

async function main() {
  console.log('Seeding exercises...');

  const exercises = (exercisesData as { exercises: ExerciseData[] }).exercises;
  let exerciseCount = 0;
  let variationCount = 0;

  for (const ex of exercises) {
    const exercise = await prisma.exercise.upsert({
      where: { name: ex.name },
      update: {},
      create: {
        name: ex.name,
        muscleGroup: ex.muscle_group,
        secondaryMuscles: ex.secondary_muscles,
        equipmentRequired: ex.equipment_required,
        difficulty: ex.difficulty,
        exerciseType: ex.exercise_type,
        instructions: ex.instructions,
      },
    });

    exerciseCount++;

    for (const v of ex.variations) {
      await prisma.exerciseVariation.create({
        data: {
          baseExerciseId: exercise.id,
          name: v.name,
          spicyLevel: v.spicy_level,
          modificationType: v.modification_type,
          description: v.description,
          additionalEquipment: v.additional_equipment || null,
        },
      });
      variationCount++;
    }
  }

  console.log(`Seeded ${exerciseCount} exercises with ${variationCount} variations.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
