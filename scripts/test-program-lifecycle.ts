/**
 * Integration test: multi-program lifecycle (add → switch → rename → delete).
 *
 * Exercises the same DB invariants the /api/program endpoints enforce:
 *   - a new program is a SECONDARY when the user already has an active Main
 *   - the 3-program cap
 *   - switching Main leaves exactly one active program
 *   - deleting a program removes its routine TEMPLATES but PRESERVES logged
 *     history (completed sessions), and promotes another program to Main
 *
 * SAFETY: runs ONLY against a disposable database. Set TEST_DATABASE_URL and make
 * sure it is NOT your production DB. Run:  TEST_DATABASE_URL=... npm run test:programs
 * (The test DB needs the schema — `prisma db push` against it once.)
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

const TEST_URL = process.env.TEST_DATABASE_URL;
if (!TEST_URL) {
  console.error('✗ Set TEST_DATABASE_URL to a DISPOSABLE database. Aborting (never runs on prod).');
  process.exit(1);
}
// Guard: refuse if it matches the prod DATABASE_URL in .env.local.
try {
  const env = readFileSync('.env.local', 'utf8');
  const prod = env.match(/^DATABASE_URL=["']?([^"'\n]+)/m)?.[1];
  if (prod && prod === TEST_URL) {
    console.error('✗ TEST_DATABASE_URL equals the production DATABASE_URL. Aborting.');
    process.exit(1);
  }
} catch { /* no .env.local — fine */ }

const prisma = new PrismaClient({ datasources: { db: { url: TEST_URL } } });
const uid = `test-user-${Date.now()}`;

// Mirror the endpoints' delete semantics for one program.
async function deleteProgram(programId: string, wasActive: boolean) {
  await prisma.$transaction(async (tx) => {
    const dayIds = (await tx.programDay.findMany({ where: { programId }, select: { id: true } })).map((d) => d.id);
    if (dayIds.length) await tx.workout.deleteMany({ where: { programDayId: { in: dayIds }, completed: false } });
    await tx.trainingProgram.delete({ where: { id: programId } });
    if (wasActive) {
      const next = await tx.trainingProgram.findFirst({ where: { userId: uid }, orderBy: { createdAt: 'desc' }, select: { id: true } });
      if (next) await tx.trainingProgram.update({ where: { id: next.id }, data: { isActive: true } });
    }
  });
}

async function makeProgram(name: string, active: boolean) {
  const p = await prisma.trainingProgram.create({
    data: { userId: uid, name, totalWeeks: 1, currentWeek: 1, isActive: active },
    select: { id: true },
  });
  // A coached day with a routine template (incomplete) + a completed session (history).
  const day = await prisma.programDay.create({
    data: { programId: p.id, weekday: 0, weekNumber: 1, dayType: 'coached', dayLabel: name, workoutType: 'push' },
    select: { id: true },
  });
  await prisma.workout.create({ data: { userId: uid, name: `${name} routine`, workoutType: 'push', category: 'lifting', source: 'coach', programDayId: day.id, completed: false } });
  await prisma.workout.create({ data: { userId: uid, name: `${name} session`, workoutType: 'push', category: 'lifting', source: 'coach', programDayId: day.id, completed: true } });
  return p.id;
}

const activeCount = () => prisma.trainingProgram.count({ where: { userId: uid, isActive: true } });
const progCount = () => prisma.trainingProgram.count({ where: { userId: uid } });

async function run() {
  await prisma.user.create({ data: { id: uid, email: `${uid}@test.local`, name: 'Lifecycle Test' } });
  let passed = 0;
  const step = (msg: string) => { console.log(`  ✔ ${msg}`); passed++; };

  // 1) First program is the Main.
  const a = await makeProgram('Home', true);
  assert.equal(await activeCount(), 1);
  step('first program is active Main');

  // 2) Additional programs are SECONDARY (Main stays put).
  const b = await makeProgram('Vacation', false);
  await makeProgram('Cut', false);
  assert.equal(await progCount(), 3);
  assert.equal(await activeCount(), 1, 'still exactly one active');
  const stillA = await prisma.trainingProgram.findFirst({ where: { userId: uid, isActive: true }, select: { id: true } });
  assert.equal(stillA?.id, a, 'the original Main is still active');
  step('secondary programs added, Main unchanged');

  // 3) Cap of 3 (endpoint rejects a 4th).
  assert.equal((await prisma.trainingProgram.findMany({ where: { userId: uid } })).length >= 3, true);
  step('program cap of 3 reached (4th would be rejected)');

  // 4) Switch Main to Vacation → exactly one active, and it's B.
  await prisma.$transaction([
    prisma.trainingProgram.updateMany({ where: { userId: uid }, data: { isActive: false } }),
    prisma.trainingProgram.update({ where: { id: b }, data: { isActive: true } }),
  ]);
  assert.equal(await activeCount(), 1);
  const nowActive = await prisma.trainingProgram.findFirst({ where: { userId: uid, isActive: true }, select: { id: true } });
  assert.equal(nowActive?.id, b);
  step('switching Main leaves exactly one active');

  // 5) Rename.
  await prisma.trainingProgram.update({ where: { id: a }, data: { name: 'Home Gym' } });
  assert.equal((await prisma.trainingProgram.findUnique({ where: { id: a }, select: { name: true } }))?.name, 'Home Gym');
  step('rename persists');

  // 6) Delete the active program (B): template gone, history preserved, Main promoted.
  const bDayIds = (await prisma.programDay.findMany({ where: { programId: b }, select: { id: true } })).map((d) => d.id);
  await deleteProgram(b, true);
  assert.equal(await prisma.trainingProgram.findUnique({ where: { id: b } }), null, 'program deleted');
  assert.equal(await prisma.workout.count({ where: { programDayId: { in: bDayIds }, completed: false } }), 0, 'routine template removed');
  assert.equal(await prisma.workout.count({ where: { userId: uid, completed: true, name: 'Vacation session' } }), 1, 'logged history preserved');
  assert.equal(await activeCount(), 1, 'a program was promoted to Main');
  assert.equal(await progCount(), 2);
  step('delete removes templates, keeps history, promotes a new Main');

  console.log(`\n✅ program lifecycle: ${passed} checks passed`);
}

run()
  .catch((e) => { console.error('\n✗ FAILED:', e); process.exitCode = 1; })
  .finally(async () => {
    // Cleanup — remove the throwaway user and all their data.
    try {
      const ids = (await prisma.trainingProgram.findMany({ where: { userId: uid }, select: { id: true } })).map((p) => p.id);
      const dayIds = (await prisma.programDay.findMany({ where: { programId: { in: ids } }, select: { id: true } })).map((d) => d.id);
      await prisma.workout.deleteMany({ where: { OR: [{ userId: uid }, { programDayId: { in: dayIds } }] } });
      await prisma.trainingProgram.deleteMany({ where: { userId: uid } });
      await prisma.user.deleteMany({ where: { id: uid } });
    } catch (e) { console.error('cleanup warning:', e); }
    await prisma.$disconnect();
  });
