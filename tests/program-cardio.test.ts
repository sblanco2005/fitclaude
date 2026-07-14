import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCardioSegments, segmentLabel } from '../lib/program/cardio';
import type { Ex } from '../lib/program/exercises';

const CARDIO: Ex[] = [
  { id: 'r1', name: 'Rower', muscleGroup: 'full_body', exerciseType: 'cardio', equipmentRequired: 'rower' },
  { id: 'a1', name: 'Air Bike', muscleGroup: 'full_body', exerciseType: 'cardio', equipmentRequired: 'air bike' },
  { id: 'run1', name: 'Run', muscleGroup: 'full_body', exerciseType: 'cardio', equipmentRequired: null },
];

test('multi-segment: rower + air bike + run', () => {
  const segs = parseCardioSegments('rower 5min + air bike 2min + run 400m', CARDIO);
  assert.equal(segs.length, 3);
  assert.deepEqual([segs[0].name, segs[0].durationSeconds], ['Rower', 300]);
  assert.equal(segs[0].exerciseId, 'r1'); // linked to seeded modality
  assert.deepEqual([segs[1].name, segs[1].durationSeconds], ['Air Bike', 120]);
  assert.deepEqual([segs[2].name, segs[2].distance, segs[2].distanceUnit], ['Run', 400, 'm']);
});

test('mm:ss duration + km + reps', () => {
  const segs = parseCardioSegments('row 500m, 20 burpees, run 0:45', CARDIO);
  assert.deepEqual([segs[0].distance, segs[0].distanceUnit], [500, 'm']);
  assert.deepEqual([segs[1].name, segs[1].reps], ['Burpees', '20']);
  assert.equal(segs[2].durationSeconds, 45);
});

test('single modality, no metrics', () => {
  const segs = parseCardioSegments('running', CARDIO);
  assert.equal(segs.length, 1);
  assert.equal(segs[0].name, 'Running');
  assert.equal(segs[0].durationSeconds, null);
  assert.equal(segs[0].distance, null);
});

test('walk N min and 5k', () => {
  assert.equal(parseCardioSegments('walk 30 min')[0].durationSeconds, 1800);
  const fivek = parseCardioSegments('5k run')[0];
  assert.deepEqual([fivek.distance, fivek.distanceUnit], [5, 'km']);
});

test('does not mis-parse "min" as meters or "squats" as seconds', () => {
  const s = parseCardioSegments('bike 5min', CARDIO)[0];
  assert.equal(s.durationSeconds, 300);
  assert.equal(s.distance, null); // "5min" is not "5 m"
});

test('calories: air bike 8 cal + ski erg', () => {
  const segs = parseCardioSegments('air bike 8 cal, ski erg 10 cals', CARDIO);
  assert.deepEqual([segs[0].name, segs[0].calories], ['Air Bike', 8]);
  assert.equal(segs[0].reps, null); // "8" is calories, not reps
  assert.equal(segs[1].calories, 10);
});

test('segmentLabel formats', () => {
  assert.equal(segmentLabel({ durationSeconds: 300, distance: null, distanceUnit: null, reps: null }), '5:00');
  assert.equal(segmentLabel({ durationSeconds: null, distance: 400, distanceUnit: 'm', reps: null }), '400 m');
  assert.equal(segmentLabel({ durationSeconds: null, distance: null, distanceUnit: null, calories: 12, reps: null }), '12 cal');
  assert.equal(segmentLabel({ durationSeconds: null, distance: null, distanceUnit: null, reps: '20' }), '×20');
});
