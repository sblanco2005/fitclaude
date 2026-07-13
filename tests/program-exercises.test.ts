import { test } from 'node:test';
import assert from 'node:assert/strict';
import { musclesForFocus, typeForFocus, pickForFocus, type Ex } from '../lib/program/exercises';

// A compact exercise library fixture (mirrors the shape of the seeded DB rows).
const c = (id: string, name: string, muscleGroup: string, exerciseType: string, equipmentRequired: string | null = null): Ex =>
  ({ id, name, muscleGroup, exerciseType, equipmentRequired });
const POOL: Ex[] = [
  c('e1', 'Barbell Bench Press', 'chest', 'compound', 'barbell'),
  c('e2', 'Cable Chest Flyes', 'chest', 'isolation', 'cables'),
  c('e3', 'Barbell Deadlift', 'back', 'compound', 'barbell'),
  c('e4', 'Lat Pulldown', 'back', 'compound', 'cables'),
  c('e5', 'Barbell Row', 'back', 'compound', 'barbell'),
  c('e6', 'Overhead Press', 'shoulders', 'compound', 'barbell'),
  c('e7', 'Lateral Raises', 'shoulders', 'isolation', 'dumbbells'),
  c('e8', 'Barbell Curl', 'biceps', 'isolation', 'barbell'),
  c('e9', 'Tricep Pushdown', 'triceps', 'isolation', 'cables'),
  c('e10', 'Close-Grip Bench Press', 'triceps', 'compound', 'barbell'),
  c('e11', 'Barbell Back Squat', 'quadriceps', 'compound', 'barbell'),
  c('e12', 'Leg Press', 'quadriceps', 'compound', 'machine'),
  c('e13', 'Romanian Deadlift', 'hamstrings', 'compound', 'barbell'),
  c('e14', 'Hip Thrust', 'glutes', 'compound', 'barbell'),
  c('e15', 'Standing Calf Raise', 'calves', 'isolation', 'machine'),
  c('e16', 'Plank', 'core', 'isolation', null),
];

// ── Focus → muscle groups ────────────────────────────────────────
test('musclesForFocus maps categories', () => {
  assert.deepEqual(new Set(musclesForFocus('Push & Pull')), new Set(['chest', 'shoulders', 'triceps', 'back', 'biceps']));
  assert.deepEqual(new Set(musclesForFocus('Legs')), new Set(['quadriceps', 'hamstrings', 'glutes', 'calves']));
  assert.deepEqual(new Set(musclesForFocus('Chest & Triceps')), new Set(['chest', 'triceps']));
});

test('musclesForFocus picks up named lifts + direct muscles', () => {
  assert.ok(musclesForFocus('Deadlifts & Back').includes('back'));
  assert.ok(musclesForFocus('Bench & Shoulders').includes('chest'));
  assert.ok(musclesForFocus('Bench & Shoulders').includes('shoulders'));
});

test('musclesForFocus falls back to full body when unrecognized', () => {
  assert.deepEqual(musclesForFocus('zzzz'), ['full_body', 'chest', 'back', 'quadriceps', 'shoulders']);
});

test('typeForFocus classifies', () => {
  assert.equal(typeForFocus('Push day'), 'push');
  assert.equal(typeForFocus('Pull & arms'), 'pull');
  assert.equal(typeForFocus('Full Body'), 'full_body');
  assert.equal(typeForFocus('Deadlifts & Back'), 'custom'); // not a bare category word
});

// ── Exercise selection ───────────────────────────────────────────
test('pickForFocus returns a coherent set (≤6, no dupes)', () => {
  const t = pickForFocus('Push & Pull', POOL, POOL);
  assert.ok(t.length >= 3 && t.length <= 6, `got ${t.length}`);
  const ids = t.map((x) => x._id);
  assert.equal(new Set(ids).size, ids.length, 'no duplicate exercises');
  // every chosen exercise belongs to a push/pull muscle
  const target = new Set(musclesForFocus('Push & Pull'));
  assert.ok(t.every((x) => target.has(x.muscle_group)));
});

test('pickForFocus includes an explicitly named lift as primary', () => {
  const t = pickForFocus('Deadlifts & Back', POOL, POOL);
  const dl = t.find((x) => x.name === 'Barbell Deadlift');
  assert.ok(dl, 'deadlift is included');
  assert.equal(dl!.is_primary, true);
});

test('pickForFocus sets sensible sets/reps', () => {
  const t = pickForFocus('Legs', POOL, POOL);
  const primary = t.find((x) => x.is_primary)!;
  assert.equal(primary.sets, 4);
  assert.equal(primary.reps, '6-8');
  const accessory = t.find((x) => !x.is_primary);
  if (accessory) {
    assert.equal(accessory.sets, 3);
    assert.ok(accessory.reps === '10-12' || accessory.reps === '12-15');
  }
});

test('core exercises get higher-rep scheme', () => {
  const t = pickForFocus('Core', POOL, POOL);
  const plank = t.find((x) => x.muscle_group === 'core');
  if (plank) assert.equal(plank.reps, '12-15');
});

test('pickForFocus falls back to `all` when the filtered pool is empty', () => {
  // Simulate an over-aggressive equipment filter → empty pool, full `all`.
  const t = pickForFocus('Push', [], POOL);
  assert.ok(t.length >= 3, 'still builds from the fallback library');
});
