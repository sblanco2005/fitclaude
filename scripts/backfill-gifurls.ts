/**
 * Backfill gifUrl for existing exercises from ExerciseDB API.
 *
 * Fetches all exercises from ExerciseDB, matches by normalized name,
 * and updates gifUrl for any exercise that doesn't already have one.
 *
 * Usage:
 *   npx tsx scripts/backfill-gifurls.ts
 *   npx tsx scripts/backfill-gifurls.ts --dry-run
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env.local
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
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
} catch { /* .env.local not found */ }

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');
const API_BASE = 'https://exercisedb-api.vercel.app/api/v1';
const PAGE_SIZE = 100;

interface ExerciseDBEntry {
  name: string;
  gifUrl?: string;
}

function normalizeName(name: string): string {
  return name
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
    .trim();
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

    await new Promise(r => setTimeout(r, 1500));
  }

  console.log(`\nFetched ${all.length} exercises from ExerciseDB.`);
  return all;
}

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN ===' : '=== Backfilling gifUrls ===');

  const apiExercises = await fetchAllExercises();

  // Build a map: normalized name -> gifUrl
  const gifMap = new Map<string, string>();
  for (const ex of apiExercises) {
    if (ex.gifUrl) {
      gifMap.set(normalizeName(ex.name).toLowerCase(), ex.gifUrl);
    }
  }
  console.log(`ExerciseDB entries with gifUrl: ${gifMap.size}`);

  // Get exercises missing gifUrl
  const exercises = await prisma.exercise.findMany({
    where: { gifUrl: null },
    select: { id: true, name: true },
  });
  console.log(`Exercises in DB without gifUrl: ${exercises.length}`);

  let updated = 0;
  let noMatch = 0;

  for (const ex of exercises) {
    const gif = gifMap.get(ex.name.toLowerCase());
    if (!gif) {
      noMatch++;
      continue;
    }

    if (!DRY_RUN) {
      await prisma.exercise.update({
        where: { id: ex.id },
        data: { gifUrl: gif },
      });
    }
    updated++;
    if (updated % 50 === 0) process.stdout.write(`  ${updated} updated...\r`);
  }

  console.log(`\nDone! Updated: ${updated}, No match in API: ${noMatch}`);

  const withGif = await prisma.exercise.count({ where: { gifUrl: { not: null } } });
  const total = await prisma.exercise.count();
  console.log(`Exercises with gifUrl: ${withGif}/${total}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  prisma.$disconnect();
  process.exit(1);
});
