# Tests

Run the unit suite (no DB, instant):

```bash
npm test          # tsx --test tests/*.test.ts
```

## Coverage

**`session-weights.test.ts`** — Hit It weight math (`components/redesign/session/weightMath.ts`):
- lb ↔ kg conversion and `formatWeight`
- per-side (barbell) plate math, both directions, in lb **and** kg
- entering weight in **KG instead of LB** → canonical lb storage
- `buildSetLogs` — only logged sets, weights in lb, sets renumbered
- session volume from logged sets

**`program-exercises.test.ts`** — Add-program builder (`lib/program/exercises.ts`):
- free-text focus → muscle groups (`Push & Pull`, `Deadlifts & Back`, `Legs`, …)
- `typeForFocus` classification
- deterministic exercise selection: ≤6, no dupes, on-target muscles, named lift as primary, sets/reps schemes, equipment-filter fallback

## Program lifecycle (integration — needs a disposable DB)

Exercises the multi-program invariants the `/api/program` endpoints enforce
(add multiple → secondary vs Main → cap of 3 → switch Main → rename → delete
keeps history / promotes a new Main).

```bash
# Point at a THROWAWAY database only (never production). It needs the schema:
#   TEST_DATABASE_URL=... npx prisma db push
TEST_DATABASE_URL="postgresql://…/test_db" npm run test:programs
```

It refuses to run if `TEST_DATABASE_URL` is unset or equals the production
`DATABASE_URL`, and cleans up the throwaway user/data when done.
