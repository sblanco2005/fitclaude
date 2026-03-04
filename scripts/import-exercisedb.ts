/**
 * Import exercises from ExerciseDB API (https://github.com/ExerciseDB/exercisedb-api)
 *
 * Fetches all ~1,500 exercises from the free playground API and inserts
 * only NEW exercises (skips any whose name already exists in our DB).
 *
 * Usage:
 *   npx tsx scripts/import-exercisedb.ts
 *   npx tsx scripts/import-exercisedb.ts --dry-run   # preview without inserting
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env.local (Next.js convention)
try {
  const envPath = resolve(process.cwd(), '.env.local');
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    // Strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
} catch { /* .env.local not found, rely on existing env */ }

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');
const API_BASE = 'https://exercisedb-api.vercel.app/api/v1';
const PAGE_SIZE = 100;

// ─── Field mapping ───────────────────────────────────────────────────────────

/** Map ExerciseDB targetMuscle / bodyPart values to our muscleGroup values */
const MUSCLE_MAP: Record<string, string> = {
  // targetMuscles
  'upper back': 'back',
  'lats': 'back',
  'traps': 'back',
  'spine': 'back',
  'levator scapulae': 'back',
  'pectorals': 'chest',
  'quads': 'quadriceps',
  'quadriceps': 'quadriceps',
  'glutes': 'glutes',
  'hamstrings': 'hamstrings',
  'calves': 'calves',
  'adductors': 'legs',
  'abductors': 'legs',
  'abs': 'core',
  'serratus anterior': 'core',
  'delts': 'shoulders',
  'biceps': 'biceps',
  'triceps': 'triceps',
  'forearms': 'arms',
  'cardiovascular system': 'cardio',
  // bodyParts fallback
  'back': 'back',
  'chest': 'chest',
  'upper legs': 'legs',
  'lower legs': 'calves',
  'upper arms': 'arms',
  'lower arms': 'arms',
  'shoulders': 'shoulders',
  'waist': 'core',
  'cardio': 'cardio',
  'neck': 'shoulders',
};

/** Map ExerciseDB equipment to our equipmentRequired format */
const EQUIP_MAP: Record<string, string> = {
  'body weight': '',
  'barbell': 'barbell',
  'dumbbell': 'dumbbells',
  'cable': 'cables',
  'band': 'bands',
  'kettlebell': 'kettlebell',
  'medicine ball': 'medicine ball',
  'stability ball': 'stability ball',
  'ez barbell': 'ez bar',
  'olympic barbell': 'barbell',
  'smith machine': 'smith machine',
  'leverage machine': 'machine',
  'assisted': 'machine',
  'roller': 'foam roller',
  'rope': 'rope',
  'bosu ball': 'bosu ball',
  'resistance band': 'bands',
  'trap bar': 'trap bar',
  'tire': 'tire',
  'sled machine': 'sled',
  'upper body ergometer': 'machine',
  'elliptical machine': 'machine',
  'stationary bike': 'bike',
  'stepmill machine': 'machine',
  'skierg machine': 'skierg',
  'hammer': 'machine',
  'weighted': '',
};

/** Guess exerciseType from the exercise name + equipment */
function guessExerciseType(name: string, muscles: string[], equip: string[]): string {
  const n = name.toLowerCase();
  const isCardio = muscles.includes('cardiovascular system') || equip.some(e => ['stationary bike', 'elliptical machine', 'skierg machine', 'stepmill machine'].includes(e));
  if (isCardio) return 'cardio';

  const isStretch = n.includes('stretch') || n.includes('static hold') || n.includes('yoga');
  if (isStretch) return 'stretch';

  const isPlyo = n.includes('jump') || n.includes('plyo') || n.includes('box jump') || n.includes('burpee');
  if (isPlyo) return 'plyometric';

  // Compound = multi-joint
  const compoundKeywords = ['squat', 'deadlift', 'bench press', 'overhead press', 'row', 'pull-up', 'pullup', 'chin-up', 'chinup', 'lunge', 'clean', 'snatch', 'thruster', 'push-up', 'pushup', 'dip', 'press'];
  const isCompound = compoundKeywords.some(k => n.includes(k));
  if (isCompound) return 'compound';

  return 'isolation';
}

// ─── API fetching ────────────────────────────────────────────────────────────

interface ExerciseDBEntry {
  exerciseId: string;
  name: string;
  targetMuscles: string[];
  bodyParts: string[];
  equipments: string[];
  secondaryMuscles: string[];
  instructions: string[];
  gifUrl?: string;
}

async function fetchAllExercises(): Promise<ExerciseDBEntry[]> {
  const all: ExerciseDBEntry[] = [];
  let offset = 0;
  let totalExercises = Infinity;

  console.log('Fetching exercises from ExerciseDB...');

  while (offset < totalExercises) {
    const url = `${API_BASE}/exercises?limit=${PAGE_SIZE}&offset=${offset}`;

    let res: Response;
    let retries = 0;
    while (true) {
      res = await fetch(url);
      if (res.status === 429) {
        retries++;
        const wait = Math.min(retries * 3000, 15000);
        process.stdout.write(`  Rate limited, waiting ${wait / 1000}s...\r`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      break;
    }

    if (!res.ok) {
      console.error(`  API error at offset ${offset}: ${res.status}`);
      break;
    }
    const json = await res.json();
    totalExercises = json.metadata?.totalExercises ?? 1500;
    const data: ExerciseDBEntry[] = json.data ?? [];
    if (data.length === 0) break;

    all.push(...data);
    offset += data.length;
    process.stdout.write(`  ${all.length}/${totalExercises} fetched\r`);

    // Delay between pages to avoid rate limiting
    await new Promise(r => setTimeout(r, 1500));
  }

  console.log(`\nFetched ${all.length} exercises from ExerciseDB.`);
  return all;
}

// ─── Import ──────────────────────────────────────────────────────────────────

function normalizeName(name: string): string {
  // Title-case and trim
  return name
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
    .trim();
}

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN (no inserts) ===' : '=== Importing ExerciseDB ===');

  // 1. Fetch all exercises from API
  const apiExercises = await fetchAllExercises();

  // 2. Get existing exercise names from our DB
  const existing = await prisma.exercise.findMany({ select: { name: true } });
  const existingNames = new Set(existing.map(e => e.name.toLowerCase()));
  console.log(`\nExisting exercises in DB: ${existingNames.size}`);

  // 3. Filter to new exercises only
  const newExercises = apiExercises.filter(e => {
    const normalized = normalizeName(e.name);
    return !existingNames.has(normalized.toLowerCase());
  });

  console.log(`New exercises to import: ${newExercises.length}`);
  console.log(`Duplicates skipped: ${apiExercises.length - newExercises.length}`);

  if (DRY_RUN) {
    // Show sample of what would be imported
    console.log('\nSample of first 20 new exercises:');
    for (const ex of newExercises.slice(0, 20)) {
      const muscle = MUSCLE_MAP[ex.targetMuscles[0]?.toLowerCase()] ?? MUSCLE_MAP[ex.bodyParts[0]?.toLowerCase()] ?? 'other';
      console.log(`  - ${normalizeName(ex.name)} (${muscle})`);
    }
    await prisma.$disconnect();
    return;
  }

  // 4. Insert new exercises
  let inserted = 0;
  let failed = 0;

  for (const ex of newExercises) {
    const name = normalizeName(ex.name);
    const primaryTarget = ex.targetMuscles[0]?.toLowerCase() ?? '';
    const bodyPart = ex.bodyParts[0]?.toLowerCase() ?? '';
    const muscleGroup = MUSCLE_MAP[primaryTarget] ?? MUSCLE_MAP[bodyPart] ?? 'other';

    const secondaryMuscles = ex.secondaryMuscles
      .map(m => MUSCLE_MAP[m.toLowerCase()] ?? m)
      .filter((v, i, arr) => arr.indexOf(v) === i && v !== muscleGroup)
      .join(', ') || null;

    const equipmentRequired = ex.equipments
      .map(e => EQUIP_MAP[e.toLowerCase()] ?? e)
      .filter(e => e !== '')
      .join(', ') || null;

    const exerciseType = guessExerciseType(name, ex.targetMuscles, ex.equipments);
    const instructions = ex.instructions.join('\n') || null;

    try {
      await prisma.exercise.create({
        data: {
          name,
          muscleGroup,
          secondaryMuscles,
          equipmentRequired,
          difficulty: 'intermediate',
          exerciseType,
          instructions,
          gifUrl: ex.gifUrl ?? null,
        },
      });
      inserted++;
      if (inserted % 50 === 0) process.stdout.write(`  ${inserted} inserted...\r`);
    } catch (err: unknown) {
      // Unique constraint violation = duplicate name (race condition or case difference)
      const prismaError = err as { code?: string };
      if (prismaError.code === 'P2002') {
        // Skip silently
      } else {
        console.error(`  Failed to insert "${name}":`, err);
        failed++;
      }
    }
  }

  console.log(`\nDone! Inserted: ${inserted}, Failed: ${failed}`);

  // 5. Final count
  const totalCount = await prisma.exercise.count();
  console.log(`Total exercises in DB: ${totalCount}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Import failed:', err);
  prisma.$disconnect();
  process.exit(1);
});
