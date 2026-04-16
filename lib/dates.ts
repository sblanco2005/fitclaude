/**
 * Timezone helpers for resolving the user's local calendar day and weekday.
 *
 * All functions return values derived from an IANA tz string (e.g.
 * "America/Mexico_City"). When tz is missing or invalid, callers fall back
 * to the server's local clock.
 *
 * Weekday convention: **Mon = 0 … Sun = 6**, matching ProgramDay.weekday.
 */

// JavaScript Date.getDay(): 0=Sun, 1=Mon ... 6=Sat. We want 0=Mon ... 6=Sun.
export function getMondayWeekday(date: Date): number {
  const d = date.getDay();
  return d === 0 ? 6 : d - 1;
}

export type LocalDayParts = {
  weekday: number; // Mon-indexed
  year: number;
  month: number; // 0-indexed
  day: number;
};

/** Resolve the user's local Y/M/D + weekday for "now" in the given tz. */
export function resolveLocalDayParts(tz: string | null | undefined): LocalDayParts {
  const now = new Date();
  if (!tz) {
    return {
      weekday: getMondayWeekday(now),
      year: now.getFullYear(),
      month: now.getMonth(),
      day: now.getDate(),
    };
  }
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    const wdMap: Record<string, number> = {
      Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
    };
    const weekday = wdMap[get('weekday')] ?? getMondayWeekday(now);
    return {
      weekday,
      year: parseInt(get('year'), 10),
      month: parseInt(get('month'), 10) - 1,
      day: parseInt(get('day'), 10),
    };
  } catch {
    return {
      weekday: getMondayWeekday(now),
      year: now.getFullYear(),
      month: now.getMonth(),
      day: now.getDate(),
    };
  }
}

/**
 * Return the UTC instant corresponding to local midnight of `parts` in `tz`.
 *
 * We compute this by formatting an arbitrary UTC instant in the target tz
 * and measuring the offset.
 */
export function localMidnightToUtc(parts: LocalDayParts, tz: string | null | undefined): Date {
  // Start from a naive "midnight" Date built from the local components,
  // interpreted in the server's local tz.
  const naive = new Date(parts.year, parts.month, parts.day, 0, 0, 0, 0);

  if (!tz) return naive;

  // Adjust by the difference between the server's offset and the target tz's
  // offset at that calendar moment.
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const asPartsInTz = (d: Date) => {
      const p = dtf.formatToParts(d);
      const g = (t: string) => parseInt(p.find((x) => x.type === t)?.value || '0', 10);
      // Intl hour field may be "24" at midnight in some tzs; normalize.
      let hour = g('hour');
      if (hour === 24) hour = 0;
      return {
        year: g('year'),
        month: g('month'),
        day: g('day'),
        hour,
        minute: g('minute'),
        second: g('second'),
      };
    };
    // We want a UTC Date whose representation in tz equals (parts @ 00:00:00).
    // Binary search is overkill; a one-shot adjustment is exact for all
    // non-DST edge cases, and DST transitions are off by at most 1h which
    // we don't care about for day boundaries at midnight.
    const target = Date.UTC(parts.year, parts.month, parts.day, 0, 0, 0);
    const probe = new Date(target);
    const rep = asPartsInTz(probe);
    const repUtcMs = Date.UTC(rep.year, rep.month - 1, rep.day, rep.hour, rep.minute, rep.second);
    const offset = target - repUtcMs;
    return new Date(target + offset);
  } catch {
    return naive;
  }
}

/**
 * Return the UTC instants for the start of the given weekday (Mon=0).
 * `thisWeekStart` is the most recent Monday ≤ today in `tz`.
 */
export function weekBounds(tz: string | null | undefined) {
  const now = resolveLocalDayParts(tz);
  // Days to subtract to reach Monday of this week.
  const daysToMon = now.weekday; // Mon=0 → 0, Sun=6 → 6
  const thisWeekStart = localMidnightToUtc(
    shiftDays(now, -daysToMon),
    tz
  );
  const thisWeekEnd = localMidnightToUtc(
    shiftDays(now, -daysToMon + 7),
    tz
  );
  const lastWeekStart = localMidnightToUtc(
    shiftDays(now, -daysToMon - 7),
    tz
  );
  const lastWeekEnd = thisWeekStart;
  return { thisWeekStart, thisWeekEnd, lastWeekStart, lastWeekEnd };
}

function shiftDays(parts: LocalDayParts, delta: number): LocalDayParts {
  const d = new Date(parts.year, parts.month, parts.day);
  d.setDate(d.getDate() + delta);
  return {
    weekday: ((parts.weekday + delta) % 7 + 7) % 7,
    year: d.getFullYear(),
    month: d.getMonth(),
    day: d.getDate(),
  };
}
