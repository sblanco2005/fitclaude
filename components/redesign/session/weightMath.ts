// Pure weight math for the Hit It session — unit conversion, per-side plate math,
// and the set-log payload. Kept dependency-free so it's unit-testable and shared
// by the session hook + screen (single source of truth for the numbers).

export const LB_PER_KG = 2.20462;
export type Unit = 'lb' | 'kg';

// Canonical storage is POUNDS (matches V1). Weights are stored in lb, so kg is
// always a conversion — round it to the nearest 0.5 kg (standard plate step) so
// it reads cleanly (e.g. 152.5kg) instead of drifting to 152.4kg. lb → whole.
export const lbToKg = (lb: number) => Math.round((lb / LB_PER_KG) * 2) / 2;
export const kgToLb = (kg: number) => Math.round(kg * LB_PER_KG);
export const formatWeight = (lb: number, unit: Unit) => (unit === 'lb' ? `${Math.round(lb)}lb` : `${lbToKg(lb)}kg`);

// Canonical (lb) <-> the value shown in the current unit.
export const toDisplay = (lb: number, unit: Unit) => (unit === 'lb' ? lb : lbToKg(lb));
export const fromDisplay = (v: number, unit: Unit) => (unit === 'lb' ? v : kgToLb(v));

// Plates PER SIDE for a barbell, given the total lifted. `barDisplay` is the bar
// weight expressed in the current display unit.
export const perSideDisplay = (totalLb: number, unit: Unit, barDisplay: number) => {
  const raw = (toDisplay(totalLb, unit) - barDisplay) / 2;
  const q = unit === 'kg' ? 2 : 10; // 0.5 kg or 0.1 lb increments
  return Math.max(0, Math.round(raw * q) / q);
};

// Inverse of perSideDisplay: a per-side value (in display units) → total in lb.
export const totalLbFromPerSide = (perSideVal: number, unit: Unit, barDisplay: number) => {
  const clamped = Math.max(0, Math.round(perSideVal * 10) / 10);
  return fromDisplay(clamped * 2 + barDisplay, unit);
};

// Setting the whole-weight field directly (not per-side) → total in lb.
export const totalLbFromDisplay = (v: number, unit: Unit) => {
  const clamped = Math.max(0, Math.round(v * 10) / 10);
  return fromDisplay(clamped, unit);
};

export type SetLike = { weightLb: number; reps: number; done: boolean };

// The setLogs payload persisted to the server — only logged sets, weights in lb.
export const buildSetLogs = (sets: SetLike[]) =>
  sets.filter((s) => s.done).map((s, i) => ({ set: i + 1, weight: Math.round(s.weightLb), reps: s.reps }));

// Total volume (lb) across logged sets.
export const sessionVolumeLb = (sets: SetLike[]) =>
  sets.filter((s) => s.done).reduce((v, s) => v + s.weightLb * s.reps, 0);
