# Coach Notes — Nightly AI Briefing on Home Screen

## Context

The user wants a "Coach Notes" card on the dashboard that feels like an always-on agent watching their training. Every night, a job runs, looks at what they've done this week so far (sessions completed vs program target, muscles hit, missed days), and writes a short personalized briefing for the next morning. The user explicitly chose **week-so-far progress** as the primary frame, but the original ask also mentioned: today's sessions, comparison to last time the same workout was done, what's coming next, and inactivity nudges — those will be passed to the LLM as supporting context so the briefing can mention them naturally, while the headline framing stays on the week.

The codebase already has all the raw materials: workouts and activities are persisted in Postgres, there's a working `/api/analytics/insights` endpoint that calls Claude over recent workout data, and the home screen has a clean place to drop a new `<Card>`. What's missing is (a) persistence for the briefing, (b) a scheduled trigger, and (c) the UI card.

## Decisions (from clarifying questions)

- **Schedule**: Vercel Cron → `/api/cron/coach-notes` (frontend, no VPS work).
- **Persistence**: New Prisma `CoachNote` model, one row per night per user (history kept).
- **Content focus**: Week-so-far progress as the headline; today/last-time/next/inactivity available as context for the LLM but not required.

## Architecture

```
Vercel Cron (nightly, ~03:00 UTC)
   │
   ▼
POST /api/cron/coach-notes               [app/api/cron/coach-notes/route.ts]   NEW
   │   - auth via CRON_SECRET (Authorization: Bearer …)
   │   - iterate active users
   │   - for each user, build a "week snapshot" from Prisma
   │   - call Claude (Anthropic SDK, Haiku) with snapshot
   │   - upsert CoachNote row for "today" in user tz
   │
   ▼
CoachNote table (Prisma)                 [prisma/schema.prisma]                NEW MODEL
   │
   ▼
GET /api/coach-notes/latest              [app/api/coach-notes/latest/route.ts] NEW
   │   - returns the user's most recent CoachNote
   │
   ▼
<CoachNotesCard />                       [app/page.tsx]                         NEW SECTION
   - rendered between BLOCK 3 (Today) and Routines (insert at line 407)
```

## Files to add / modify

### 1. Prisma schema — new `CoachNote` model
File: `prisma/schema.prisma`

Add after `ConversationHistory` (`lines 247–263`). Mirrors existing CUID/camelCase convention used everywhere else (see Workout model at lines 149–173):

```prisma
model CoachNote {
  id           String   @id @default(cuid())
  userId       String
  generatedAt  DateTime @default(now())
  // Day this briefing is "for" — user's local calendar date at 00:00 in their tz, stored as UTC midnight of that local day.
  forDate      DateTime
  // Headline: 1-line punchy summary the card shows by default
  headline     String   @db.Text
  // Body: 2–4 short bullets, markdown-friendly
  body         String   @db.Text
  // Raw snapshot the LLM was given (debugging + future analytics)
  snapshot     String?  @db.Text
  // Period covered — Mon 00:00 → now in user tz (for "this week")
  periodStart  DateTime
  periodEnd    DateTime
  // Optional severity for UI styling: "ok" | "warn" | "celebrate"
  tone         String   @default("ok")
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, forDate])
  @@index([userId, generatedAt])
}
```

Also add the back-relation on `User` (line ~50):
```prisma
coachNotes   CoachNote[]
```

Then run `npx prisma migrate dev --name add_coach_note` locally and `npx prisma generate`.

### 2. Snapshot builder (server util)
File: `lib/coach/weekSnapshot.ts` — NEW

Pure function `buildWeekSnapshot(userId, tz)` that returns:

```ts
type WeekSnapshot = {
  user: { goal, experience, frequencyTarget, weightKg };
  today: { date, workouts: {name, durationMin, exercises, totalSets}[], activities: {name, durationMin}[] };
  weekSoFar: {
    weekStart: Date;          // Monday 00:00 in user tz
    sessionsCompleted: number;
    sessionsTarget: number;   // from User.trainingFrequency
    musclesHit: string[];     // distinct muscleGroup from Exercise via WorkoutExercise
    daysSinceLastWorkout: number | null;
  };
  nextUp: { dayLabel, dayType, weekday, exerciseTemplateSummary } | null;  // from /api/program/today logic, but for tomorrow
  recentSessions: { date, name, exercises: {name, topSet: {weight, reps}}[] }[];  // last 5 completed
};
```

It uses Prisma directly (`@/lib/prisma`) and the same Mon-indexed weekday helper logic already in [app/api/program/today/route.ts:10](app/api/program/today/route.ts#L10) (`getMondayWeekday` + `resolveLocalDayParts`). **Refactor that file to also export those helpers from a shared `lib/dates.ts`** so we don't duplicate the timezone logic — they were just added in the previous turn for the program/today tz fix.

### 3. LLM call — Claude on Vercel (frontend)
File: `lib/coach/generateCoachNote.ts` — NEW

```ts
import Anthropic from '@anthropic-ai/sdk';
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function generateCoachNote(snapshot: WeekSnapshot) {
  const sys = `You are FitClaude's morning briefing coach. Write a short note the user will see when they open the app.
PRIMARY frame: how the user is doing this week vs their target.
You MAY also reference: today's session, comparison to recent sessions, what's coming up, or an inactivity warning if they haven't trained in 3+ days.
Tone: direct, motivating, never preachy. No emojis unless celebrating a PR or week complete.
Format JSON ONLY: {"headline": "...", "body": "...", "tone": "ok"|"warn"|"celebrate"}.
- headline: ≤80 chars, one line
- body: 2–4 short markdown bullets, ≤200 chars total`;

  const res = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    system: sys,
    messages: [{ role: 'user', content: JSON.stringify(snapshot) }],
  });
  // parse JSON, tolerate code-fenced output
}
```

Reuse the Anthropic key already in env (`ANTHROPIC_API_KEY`). Haiku is fast and cheap; this runs once/user/night.

### 4. Cron route
File: `app/api/cron/coach-notes/route.ts` — NEW

```ts
export async function POST(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  // Find users active in last 14 days (have any workout/activity)
  const users = await prisma.user.findMany({
    where: { OR: [{ workouts: { some: { date: { gte: ... } } } }, { activities: { some: { date: { gte: ... } } } }] },
    select: { id: true, timezone: true, ... },
  });
  for (const u of users) {
    const snapshot = await buildWeekSnapshot(u.id, u.timezone);
    const note = await generateCoachNote(snapshot);
    const forDate = todayInTz(u.timezone); // start of next morning in user tz
    await prisma.coachNote.upsert({
      where: { userId_forDate: { userId: u.id, forDate } },
      create: { ... }, update: { ... },
    });
  }
  return Response.json({ ok: true, count: users.length });
}
```

Loop is sequential and small (single-digit users right now); upgrade to `Promise.all` with concurrency cap when scale matters.

### 5. Vercel cron config
File: `vercel.json` — NEW (root)

```json
{
  "crons": [
    { "path": "/api/cron/coach-notes", "schedule": "0 3 * * *" }
  ]
}
```

Runs nightly at 03:00 UTC. The route picks each user's tz internally so the briefing is correct regardless of UTC drift — same pattern we just used to fix the program/today bug. Add `CRON_SECRET` to Vercel env vars.

### 6. Read endpoint
File: `app/api/coach-notes/latest/route.ts` — NEW

```ts
export const GET = withAuth(async (request, user) => {
  const tz = new URL(request.url).searchParams.get('tz');
  const note = await prisma.coachNote.findFirst({
    where: { userId: user.id },
    orderBy: { generatedAt: 'desc' },
  });
  return NextResponse.json(note);
});
```

Uses `withAuth` from `lib/auth/middleware.ts` like every other route.

### 7. Home screen card
File: `app/page.tsx`

- Add state `const [coachNote, setCoachNote] = useState<CoachNote | null>(null);` (~line 25).
- In `fetchDashboard` (~line 54) add: `fetch(\`/api/coach-notes/latest?tz=${encodeURIComponent(tz)}\`)…`.
- Insert a new `<Card>` between line 405 (close of TODAY block) and line 407 (Routines header). Pattern matches the existing nutrition/today cards — section header `text-xs font-bold text-slate-400 uppercase tracking-widest`, then headline + bullets. Style by `coachNote.tone`:
  - `ok` → emerald accent
  - `warn` → amber (inactivity nudge)
  - `celebrate` → primary + sparkle icon (week complete or PR)
- Empty state: small muted "Your first briefing arrives tomorrow morning."

### 8. Type
File: `types/index.ts`

Export `CoachNote` mirroring the Prisma fields (existing convention — see `Workout`, `TrainingProgram`, `TodayWorkout` already there).

## What we are NOT doing (out of scope for v1)

- No backend (FastAPI) involvement. Everything runs on Vercel + Neon. The existing backend coach.py is left alone.
- No fan-out / queue. Sequential loop is fine for current user count.
- No multi-day briefing history page. The model supports it, but the UI shows latest only.
- No push notifications.
- No on-demand "regenerate" button. Add later if needed.

## Critical files to know

| Purpose | Path |
|---|---|
| Schema | [prisma/schema.prisma](../prisma/schema.prisma) |
| Home screen | [app/page.tsx:351-405](../app/page.tsx#L351-L405) (TODAY block, insertion point at L407) |
| Existing tz helpers (extract & reuse) | [app/api/program/today/route.ts:10-50](../app/api/program/today/route.ts#L10-L50) |
| Existing analytics LLM call (reference for prompt + JSON parsing pattern) | `fitclaude-backend/app/routers/analytics.py:51-140` (do not call from frontend — copy the prompt shape only) |
| Workout save (where data originates) | [app/api/workouts/[id]/log/route.ts:7-61](../app/api/workouts/[id]/log/route.ts#L7-L61) |
| Auth wrapper for new routes | [lib/auth/middleware.ts](../lib/auth/middleware.ts) (`withAuth`) |
| Anthropic key env | already configured for the existing analytics call |

## Verification

1. **Schema**: `npx prisma migrate dev --name add_coach_note` — confirm migration applies cleanly to local Neon dev DB.
2. **Snapshot**: write a one-off `node -r tsx/cjs scripts/coach-note-dryrun.ts <userId>` script that calls `buildWeekSnapshot` and prints JSON. Sanity-check sessions count, week boundary, muscles hit.
3. **LLM**: same script, pipe snapshot into `generateCoachNote`. Confirm JSON parses, headline ≤80 chars, body has bullets.
4. **Cron route locally**: `curl -X POST http://localhost:3000/api/cron/coach-notes -H "Authorization: Bearer <CRON_SECRET>"` → expect `{ ok: true, count: N }`. Verify a `CoachNote` row exists for each user.
5. **Read endpoint**: log in to the app, hit `/api/coach-notes/latest?tz=America/Mexico_City`, expect JSON.
6. **Home screen**: visit `/` — confirm new card renders between Today and Routines, headline + bullets visible, tone styling matches.
7. **Tz correctness**: temporarily set a test user's `timezone` to a far-from-UTC zone, run the cron, verify `forDate` and `weekStart` reflect that tz (not server UTC). This is the same class of bug we just fixed for program/today.
8. **Vercel deploy**: push to `master`, set `CRON_SECRET` in Vercel env, confirm the cron appears in the Vercel dashboard's Crons tab and runs at 03:00 UTC.
