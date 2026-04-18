import type { AnalyticsData } from '@/types';

function fmtVolume(lbs: number): string {
  return lbs >= 1000 ? `${(lbs / 1000).toFixed(1)}K` : `${lbs}`;
}

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function fmtDuration(mins: number | null): string {
  if (!mins) return '—';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function deriveFocus(name: string, notes: string | null): string {
  if (notes) return notes.slice(0, 20);
  const n = name.toLowerCase();
  if (n.includes('alpha x') || n.includes('alphax')) return 'legs + cond';
  if (n.includes('alpha fit') || n.includes('alphafit')) return 'full body';
  if (n.includes('upper')) return 'upper body';
  if (n.includes('lower')) return 'lower body';
  if (n.includes('run') || n.includes('cardio')) return 'cardio';
  return '—';
}

function weekStartLabel(data: AnalyticsData): string {
  if (!data.sessions.length) return '';
  const sorted = [...data.sessions].sort((a, b) => a.date.localeCompare(b.date));
  const d = new Date(sorted[0].date + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function buildTrainerEmailHtml(userName: string, data: AnalyticsData): string {
  const weekStart = weekStartLabel(data);
  const totalCondMins = data.conditioningActivities.reduce((s, a) => s + (a.durationMinutes ?? 0), 0);

  // ── TL;DR ──
  const prThisPeriod = data.personalRecords.slice(0, 2);
  const parts: string[] = [];
  if (data.sessions.length)
    parts.push(`${data.sessions.length} lifting session${data.sessions.length !== 1 ? 's' : ''} (${fmtVolume(data.totalVolume)} lb)`);
  if (data.conditioningActivities.length)
    parts.push(`${data.conditioningActivities.length} class${data.conditioningActivities.length !== 1 ? 'es' : ''} (~${fmtDuration(totalCondMins)} conditioning)`);
  const tldrBase = parts.join(' + ') + '.';
  const prStr = prThisPeriod.length
    ? ` Hit ${prThisPeriod.map(p => `${p.exerciseName} PR (${p.prWeight}×${p.prReps})`).join(' and ')}.`
    : '';
  const tldr = tldrBase + prStr;

  // ── Lifting sessions rows ──
  const sessionRows = data.sessions
    .map(s => `
      <tr>
        <td style="padding:5px 8px;color:#94a3b8;font-size:12px;white-space:nowrap;">${fmtDate(s.date)}</td>
        <td style="padding:5px 8px;font-size:12px;">${s.name} · ${s.exerciseCount} lifts</td>
        <td style="padding:5px 8px;font-size:12px;color:#94a3b8;text-align:right;white-space:nowrap;">${s.fatigueRating != null ? `RPE ${s.fatigueRating.toFixed(1)}` : `${fmtVolume(s.volume)} lb`}</td>
      </tr>`)
    .join('');

  // ── Conditioning rows ──
  const condRows = data.conditioningActivities
    .map(a => `
      <tr>
        <td style="padding:5px 8px;color:#94a3b8;font-size:12px;white-space:nowrap;">${fmtDate(a.date)}</td>
        <td style="padding:5px 8px;font-size:12px;">${a.name}</td>
        <td style="padding:5px 8px;font-size:12px;color:#94a3b8;">${deriveFocus(a.name, a.notes)}</td>
        <td style="padding:5px 8px;font-size:12px;color:#94a3b8;text-align:right;">${fmtDuration(a.durationMinutes)}</td>
      </tr>`)
    .join('');

  // ── Key lifts rows ──
  const liftRows = data.keyLifts
    .map(l => {
      const delta = l.deltaPercent;
      const deltaColor = delta == null ? '#64748b' : delta > 1 ? '#10b981' : delta < -1 ? '#ef4444' : '#64748b';
      const deltaStr = delta == null ? '—' : Math.abs(delta) < 1 ? 'flat' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%`;
      return `
      <tr>
        <td style="padding:5px 8px;font-size:12px;">${l.exerciseName}</td>
        <td style="padding:5px 8px;font-size:12px;color:#94a3b8;">${l.topSet.weight}×${l.topSet.reps}</td>
        <td style="padding:5px 8px;font-size:12px;">${l.e1rm}</td>
        <td style="padding:5px 8px;font-size:12px;color:${deltaColor};text-align:right;font-weight:500;">${deltaStr}</td>
      </tr>`;
    })
    .join('');

  // ── Flags ──
  const flags: string[] = [];
  const totalLoad = data.sessions.length + data.conditioningActivities.length;
  if (data.restDays === 0 && totalLoad >= 5)
    flags.push(`Zero rest days — ${totalLoad} total sessions. Intentional push, or schedule recovery?`);
  const pushMuscles = ['chest', 'shoulders', 'triceps'];
  const pullMuscles = ['back', 'biceps'];
  const pushSets = data.setsByMuscle.filter(m => pushMuscles.includes(m.muscleGroup)).reduce((s, m) => s + m.sets, 0);
  const pullSets = data.setsByMuscle.filter(m => pullMuscles.includes(m.muscleGroup)).reduce((s, m) => s + m.sets, 0);
  if (pullSets > 0 && pushSets / pullSets > 1.5)
    flags.push(`Push:pull ratio is ${(pushSets / pullSets).toFixed(1)} this week.`);
  const MEV: Record<string, number> = { chest: 10, back: 10, shoulders: 8, biceps: 8, triceps: 8, quadriceps: 10, hamstrings: 10, glutes: 10, core: 8, calves: 8 };
  const lowMuscles = data.setsByMuscle.filter(m => m.sets > 0 && m.sets < (MEV[m.muscleGroup] ?? 8) * 0.5);
  if (lowMuscles.length)
    flags.push(`${lowMuscles.map(m => m.muscleGroup).join(', ')} below minimum lifting volume.`);
  const declining = data.keyLifts.filter(l => l.deltaPercent !== null && l.deltaPercent < -3);
  if (declining.length)
    flags.push(`${declining[0].exerciseName} e1RM down ${Math.abs(declining[0].deltaPercent!).toFixed(1)}% — fatigue or technique?`);

  const flagItems = flags.map(f => `<li style="margin-bottom:4px;">${f}</li>`).join('');

  const today = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f0f17;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e2e8f0;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:24px auto;background:#1a1a2e;border-radius:16px;overflow:hidden;">
  <tr><td style="padding:24px 24px 16px;">

    <!-- Header -->
    <p style="font-size:11px;color:#475569;margin:0 0 6px;letter-spacing:1px;">WEEKLY REPORT · ${today.toUpperCase()}</p>
    <p style="font-size:17px;font-weight:600;margin:0 0 2px;color:#f1f5f9;">
      ${userName} · Week of ${weekStart} — ${data.totalWorkouts} lift${data.totalWorkouts !== 1 ? 's' : ''}${data.conditioningActivities.length ? ` + ${data.conditioningActivities.length} class${data.conditioningActivities.length !== 1 ? 'es' : ''}` : ''}, ${data.personalRecords.length > 0 ? `${data.personalRecords.length} PRs` : 'no new PRs'}
    </p>

    <!-- TL;DR -->
    <div style="background:#0d1b2e;border-radius:10px;padding:14px 16px;margin:20px 0;border-left:3px solid #3b82f6;">
      <p style="font-size:10px;font-weight:600;color:#60a5fa;margin:0 0 6px;letter-spacing:1px;">TL;DR</p>
      <p style="font-size:13px;margin:0;line-height:1.7;color:#cbd5e1;">${tldr}</p>
    </div>

    ${data.sessions.length ? `
    <!-- Lifting Sessions -->
    <p style="font-size:11px;font-weight:600;color:#64748b;letter-spacing:1px;margin:0 0 8px;">LIFTING SESSIONS — ${data.sessions.length}</p>
    <div style="background:#111827;border-radius:10px;overflow:hidden;margin-bottom:20px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tbody>${sessionRows}</tbody>
      </table>
    </div>` : ''}

    ${data.conditioningActivities.length ? `
    <!-- Conditioning -->
    <p style="font-size:11px;font-weight:600;color:#64748b;letter-spacing:1px;margin:0 0 8px;">CONDITIONING / CLASSES — ${data.conditioningActivities.length}</p>
    <div style="background:#111827;border-radius:10px;overflow:hidden;margin-bottom:20px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <thead>
          <tr style="border-bottom:1px solid #1e293b;">
            <th style="padding:8px;font-size:10px;color:#475569;text-align:left;font-weight:500;">Day</th>
            <th style="padding:8px;font-size:10px;color:#475569;text-align:left;font-weight:500;">Class</th>
            <th style="padding:8px;font-size:10px;color:#475569;text-align:left;font-weight:500;">Focus</th>
            <th style="padding:8px;font-size:10px;color:#475569;text-align:right;font-weight:500;">Duration</th>
          </tr>
        </thead>
        <tbody>${condRows}</tbody>
      </table>
      ${totalCondMins > 0 ? `<div style="padding:8px 8px;border-top:1px solid #1e293b;font-size:10px;color:#475569;">Total class time: ${fmtDuration(totalCondMins)}</div>` : ''}
    </div>` : ''}

    <!-- Combined Load -->
    <p style="font-size:11px;font-weight:600;color:#64748b;letter-spacing:1px;margin:0 0 8px;">COMBINED LOAD</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr>
        <td width="33%" style="padding-right:6px;">
          <div style="background:#111827;border-radius:10px;padding:12px;">
            <p style="font-size:10px;color:#475569;margin:0 0 4px;">Strength</p>
            <p style="font-size:18px;font-weight:600;margin:0 0 2px;color:#f1f5f9;">${data.sessions.length}</p>
            <p style="font-size:10px;color:#475569;margin:0;">sessions</p>
          </div>
        </td>
        <td width="33%" style="padding-right:6px;">
          <div style="background:#111827;border-radius:10px;padding:12px;">
            <p style="font-size:10px;color:#475569;margin:0 0 4px;">Conditioning</p>
            <p style="font-size:18px;font-weight:600;margin:0 0 2px;color:#f1f5f9;">${data.conditioningActivities.length}</p>
            <p style="font-size:10px;color:#475569;margin:0;">classes</p>
          </div>
        </td>
        <td width="33%">
          <div style="background:#111827;border-radius:10px;padding:12px;">
            <p style="font-size:10px;color:#475569;margin:0 0 4px;">Rest days</p>
            <p style="font-size:18px;font-weight:600;margin:0 0 2px;color:${data.restDays === 0 ? '#f59e0b' : '#f1f5f9'};">${data.restDays}</p>
            <p style="font-size:10px;color:#475569;margin:0;">days</p>
          </div>
        </td>
      </tr>
    </table>

    ${data.keyLifts.length ? `
    <!-- Key Lifts -->
    <p style="font-size:11px;font-weight:600;color:#64748b;letter-spacing:1px;margin:0 0 8px;">KEY LIFTS</p>
    <div style="background:#111827;border-radius:10px;overflow:hidden;margin-bottom:20px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <thead>
          <tr style="border-bottom:1px solid #1e293b;">
            <th style="padding:8px;font-size:10px;color:#475569;text-align:left;font-weight:500;">Lift</th>
            <th style="padding:8px;font-size:10px;color:#475569;text-align:left;font-weight:500;">Top set</th>
            <th style="padding:8px;font-size:10px;color:#475569;text-align:left;font-weight:500;">e1RM</th>
            <th style="padding:8px;font-size:10px;color:#475569;text-align:right;font-weight:500;">Δ</th>
          </tr>
        </thead>
        <tbody>${liftRows}</tbody>
      </table>
    </div>` : ''}

    ${flags.length ? `
    <!-- Flags -->
    <p style="font-size:11px;font-weight:600;color:#64748b;letter-spacing:1px;margin:0 0 8px;">FLAGS & QUESTIONS</p>
    <div style="background:#431407;border-radius:10px;padding:14px 16px;border-left:3px solid #f59e0b;margin-bottom:20px;">
      <ul style="margin:0;padding-left:20px;font-size:12px;line-height:1.8;color:#fcd34d;">
        ${flagItems}
      </ul>
    </div>` : ''}

    <!-- Footer -->
    <p style="font-size:11px;color:#334155;margin:20px 0 0;text-align:center;">
      Sent by FitClaude · <a href="https://fitclaude.app/analytics" style="color:#475569;">View full analytics</a>
    </p>
  </td></tr>
</table>
</body>
</html>`;
}
