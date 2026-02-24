/**
 * Get the start and end of "today" in the user's timezone, as UTC Date objects.
 *
 * Example: user in America/New_York (UTC-5)
 *   "today" = 2026-02-24 → starts at 2026-02-24T05:00:00Z, ends at 2026-02-25T05:00:00Z
 *
 * This ensures DB queries match the user's local day, not the server's UTC day.
 */
export function getUserDayBounds(timezone: string, dateStr?: string): { start: Date; end: Date } {
  // 1. Figure out today's date string in the user's timezone
  let localDateStr: string;
  if (dateStr) {
    localDateStr = dateStr; // Already "YYYY-MM-DD"
  } else {
    const now = new Date();
    try {
      localDateStr = now.toLocaleDateString('en-CA', { timeZone: timezone }); // "YYYY-MM-DD"
    } catch {
      localDateStr = now.toISOString().split('T')[0];
    }
  }

  // 2. Get the UTC offset for midnight of that date in the user's timezone
  //    We create a formatter that outputs hour/minute in UTC for the given timezone
  const midnight = new Date(localDateStr + 'T12:00:00Z'); // use noon to avoid DST ambiguity
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  // Parse the formatted parts to find the offset
  const parts = formatter.formatToParts(midnight);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '0';
  const localYear = parseInt(get('year'));
  const localMonth = parseInt(get('month'));
  const localDay = parseInt(get('day'));
  const localHour = parseInt(get('hour') === '24' ? '0' : get('hour'));
  const localMinute = parseInt(get('minute'));
  const localSecond = parseInt(get('second'));

  // Reconstruct what UTC time "midnight" represents as a local time
  const localAsUtc = new Date(Date.UTC(localYear, localMonth - 1, localDay, localHour, localMinute, localSecond));
  const offsetMs = localAsUtc.getTime() - midnight.getTime();

  // 3. midnight of the target date in user's timezone = that date at 00:00 user-local
  const targetMidnightUtc = new Date(localDateStr + 'T00:00:00Z');
  const start = new Date(targetMidnightUtc.getTime() - offsetMs);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  return { start, end };
}

/**
 * Get today's date string (YYYY-MM-DD) in the user's timezone.
 */
export function getUserTodayStr(timezone: string): string {
  const now = new Date();
  try {
    return now.toLocaleDateString('en-CA', { timeZone: timezone });
  } catch {
    return now.toISOString().split('T')[0];
  }
}
