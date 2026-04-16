export type SetLog = { set: number; weight: number; reps: number };

export function parseStoredSetLogs(setLogsJson: string | null | undefined): SetLog[] {
  if (!setLogsJson) return [];
  try {
    const arr = JSON.parse(setLogsJson);
    if (!Array.isArray(arr)) return [];
    return arr.filter((l) =>
      l && typeof l.set === 'number' && typeof l.weight === 'number' && typeof l.reps === 'number'
    );
  } catch {
    return [];
  }
}

/**
 * "Top set" = the set with the highest estimated 1RM (Epley).
 * Returns null if the log has no valid sets with positive weight.
 */
export function topSetByE1RM(logs: SetLog[]): SetLog | null {
  let best: { set: SetLog; e1rm: number } | null = null;
  for (const l of logs) {
    if (l.weight <= 0 || l.reps <= 0) continue;
    const e1rm = l.weight * (1 + l.reps / 30);
    if (!best || e1rm > best.e1rm) best = { set: l, e1rm };
  }
  return best?.set ?? null;
}
