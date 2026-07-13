import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  lbToKg, kgToLb, formatWeight, toDisplay, fromDisplay,
  perSideDisplay, totalLbFromPerSide, totalLbFromDisplay,
  buildSetLogs, sessionVolumeLb, type SetLike,
} from '../components/redesign/session/weightMath';

// ── Unit conversion ──────────────────────────────────────────────
test('lb↔kg conversion', () => {
  assert.equal(lbToKg(220), 99.8);       // 220 / 2.20462
  assert.equal(lbToKg(45), 20.4);
  assert.equal(kgToLb(100), 220);        // 100 * 2.20462 rounded
  assert.equal(kgToLb(20), 44);
  assert.equal(lbToKg(0), 0);
});

test('formatWeight renders the right unit', () => {
  assert.equal(formatWeight(185, 'lb'), '185lb');
  assert.equal(formatWeight(185, 'kg'), '83.9kg');
  assert.equal(formatWeight(0, 'lb'), '0lb');
});

test('toDisplay / fromDisplay are inverse in lb, convert in kg', () => {
  assert.equal(toDisplay(185, 'lb'), 185);
  assert.equal(fromDisplay(185, 'lb'), 185);
  assert.equal(toDisplay(220, 'kg'), 99.8);
  assert.equal(fromDisplay(100, 'kg'), 220);
});

// ── Per-side (barbell) plate math ────────────────────────────────
test('per-side in lb: 225 total on a 45 bar = 90/side', () => {
  assert.equal(perSideDisplay(225, 'lb', 45), 90);
  assert.equal(perSideDisplay(135, 'lb', 45), 45);
  assert.equal(perSideDisplay(45, 'lb', 45), 0);   // just the bar
});

test('per-side total round-trips: total → per-side → total', () => {
  assert.equal(totalLbFromPerSide(90, 'lb', 45), 225);
  assert.equal(totalLbFromPerSide(perSideDisplay(315, 'lb', 45), 'lb', 45), 315);
  assert.equal(totalLbFromPerSide(0, 'lb', 45), 45); // empty bar
});

test('per-side in KG: 60kg total on a 20kg bar = 20/side', () => {
  // 60kg total ≈ 132lb; bar shown as 20kg
  const totalLb = kgToLb(60);            // 132
  assert.equal(perSideDisplay(totalLb, 'kg', 20), 20);
  // inverse: 20/side + 20 bar = 60kg → back to lb
  assert.equal(totalLbFromPerSide(20, 'kg', 20), kgToLb(60));
});

// ── Entering weight in KG instead of LB ──────────────────────────
test('logging in KG stores canonical lb', () => {
  // User in kg mode types 100 (whole weight, not per-side)
  assert.equal(totalLbFromDisplay(100, 'kg'), 220);
  // and in lb mode types 185
  assert.equal(totalLbFromDisplay(185, 'lb'), 185);
  // negative / junk clamps to 0
  assert.equal(totalLbFromDisplay(-5, 'lb'), 0);
});

// ── Set logging payload ──────────────────────────────────────────
test('buildSetLogs: only logged sets, weights in lb, renumbered', () => {
  const sets: SetLike[] = [
    { weightLb: 225, reps: 5, done: true },
    { weightLb: 245, reps: 3, done: false }, // not logged → excluded
    { weightLb: 275, reps: 1, done: true },
  ];
  assert.deepEqual(buildSetLogs(sets), [
    { set: 1, weight: 225, reps: 5 },
    { set: 2, weight: 275, reps: 1 }, // renumbered 1,2 (not 1,3)
  ]);
});

test('buildSetLogs rounds kg-entered weights to whole lb', () => {
  const lb = totalLbFromDisplay(102.5, 'kg'); // 226 (rounded)
  assert.deepEqual(buildSetLogs([{ weightLb: lb, reps: 8, done: true }]), [
    { set: 1, weight: 226, reps: 8 },
  ]);
});

test('sessionVolumeLb sums only logged sets', () => {
  const sets: SetLike[] = [
    { weightLb: 100, reps: 10, done: true },  // 1000
    { weightLb: 100, reps: 10, done: false }, // excluded
    { weightLb: 50, reps: 20, done: true },   // 1000
  ];
  assert.equal(sessionVolumeLb(sets), 2000);
});
