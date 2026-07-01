# Handoff: FitClaude — Redesign v1

## Overview
FitClaude is an AI-coached fitness app: an in-app Claude coach that generates workout
routines and logs nutrition through chat, plus structured tracking for workouts, macros,
exercise video tutorials, and programs. This package is a **high-fidelity visual redesign**
("Redesign v1") — a bolder, higher-energy restyle around a deep near-black base with an
ember→lime energy palette, oversized numerals, and live/kinetic feedback. It covers 16
screens spanning the full app: dashboard, AI coach chat, live workout ("Hit It"), nutrition,
workouts, exercise library, onboarding, settings, workout/exercise detail, finish-and-rate,
a persistent coach drawer, nutrition history, program creation/builder, and an admin tool.

## About the Design Files
The files in this bundle are **design references created in HTML** — a prototype showing the
intended look and behavior. They are **not production code to copy directly**. The HTML is a
single static "spec sheet" laying out all 16 screens inside iPhone frames, side by side, so
you can see the whole system at once.

Your task is to **recreate these designs in the target codebase's existing environment**
(React, Vue, SwiftUI, React Native, native iOS, etc.) using its established patterns,
component libraries, routing, and state management. If no codebase exists yet, choose the
most appropriate framework for a mobile-first fitness app and implement the designs there.
Do **not** ship the HTML directly or treat the iPhone-bezel markup as app structure — the
bezels, status bars, and side-by-side layout are presentation scaffolding for the spec only.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, radii, and interaction intent are
all specified. Recreate the UI pixel-accurately using the codebase's own primitives. Exact
hex values, font stacks, and sizes are given in the Design Tokens section below; per-screen
specifics are in Screens. Where this README and the HTML disagree, the **HTML is the source
of truth** — measure against it.

## How to Open the Reference
`FitClaude.dc.html` is a self-contained HTML file. Open it directly in a browser (it loads
its sibling `support.js` runtime from the same folder — keep them together). It renders all
16 phone frames on a single scrolling page with captions under each. There is no build step
and no network dependency except Google Fonts.

---

## Design Language

- **Surface:** near-black app canvas `#0A0C10` (page chrome `#07080B`). Screens use subtle
  radial-gradient glows tinted by the screen's accent (ember / violet / lime), e.g.
  `radial-gradient(120% 55% at 50% -6%, rgba(255,107,69,.16), transparent 55%)`.
- **Cards:** translucent white fills `rgba(255,255,255,.04–.05)` with `1px solid
  rgba(255,255,255,.08)` borders; corner radius 16–24px.
- **Accents are semantic:** ember/orange = energy, training, primary CTAs; lime = nutrition,
  success, "go", PRs; violet = the AI coach; amber = fat macro / tertiary.
- **Numerals are heroes:** big stats use Space Grotesk 700 (calorie counters up to 46px,
  stat tiles 19–24px). Mono (JetBrains Mono) is used for labels, units, counts, timers.
- **Energy motifs:** pulsing "live" dots, a sheen sweep across primary buttons, gentle float
  on the floating coach button, ember pulse-rings on the active day/set.
- **Spicy 🌶 system:** exercises have 3 "spicy" (harder) variation levels, badged LVL 1/2/3
  in escalating ember tones. The chili emoji is intentional, brand-level vocabulary here.

## Typography
Loaded from Google Fonts:
- **Space Grotesk** (400/500/600/700) — display, headings, all large numerals.
- **DM Sans** (400/500/600/700) — body and UI text.
- **JetBrains Mono** (500/600/700) — labels, units, counts, timers, eyebrow tags.

Common roles (font: weight size/line-height family):
- Screen title: `700 25px/1.1 Space Grotesk`
- Cover H1: `700 60px/.98 Space Grotesk`, letter-spacing -.03em
- Hero calorie number: `700 46px/.9 Space Grotesk`
- Stat tile number: `700 19–24px Space Grotesk`
- Body / UI: `400–600 13–15px DM Sans`
- Eyebrow / label: `600 10–11px JetBrains Mono`, letter-spacing .10–.18em
- Timer: `700 18px JetBrains Mono`

## Design Tokens

### Colors
| Token | Hex | Use |
|---|---|---|
| Base canvas | `#0A0C10` | screen background |
| Page chrome | `#07080B` | area behind frames |
| Card base alt | `#0C0E12` | swatch / deep card |
| Ember (light) | `#FF8A5B` | gradient start, ember text |
| Ember (mid) | `#FF6B45` | ember solid / borders |
| Ember (deep) | `#FF5A2C` | gradient end, CTAs |
| Ember (LVL3) | `#E8542E` | hottest spicy level |
| Lime (light) | `#D6FF6B` | gradient start |
| Lime (primary) | `#C8FF4D` | success, nutrition, PRs, "go" |
| Lime (deep) | `#A8F000` | gradient end |
| Violet (light) | `#9B7BFF` | coach accent / gradient start |
| Violet (blue) | `#6A8BFF` | coach gradient end |
| Amber | `#FFB23E` | fat macro / tertiary |
| Text primary | `#F4F5F7` | headings, numerals |
| Text secondary | `#C9CDD6` / `#DDE0E6` | body strong |
| Text muted | `#9AA0AC` / `#8A8F9A` | body muted |
| Text faint | `#7A808C` / `#6B7280` | captions, units |
| Text disabled | `#5F6470` | inactive nav/labels |
| Macro: protein | `#FF6B45` (ember) | |
| Macro: carbs | `#C8FF4D` (lime) | |
| Macro: fat | `#FFB23E` (amber) | |

Signature gradients:
- Ember CTA: `linear-gradient(135deg, #FF8A5B, #FF5A2C)`
- Lime CTA: `linear-gradient(135deg, #D6FF6B, #A8F000)`
- Coach/violet: `linear-gradient(140deg, #9B7BFF, #6A8BFF)`
- Device bezel: `linear-gradient(160deg, #1a1c22, #000)`

### Spacing & Radius
- Screen content padding: 20px horizontal; top inset ~58–66px (under notch), bottom inset
  ~92–104px (above tab bar).
- Card radius: 16–24px; pills/chips: 8–11px; full pills: 99px; CTA buttons: 12–15px.
- Element gaps: 6–14px within cards, 13–15px between sections.

### Device frame (reference only — do not ship)
Bezel `412×866`, padding 11px, radius 56px; inner screen `390×844`, radius 46px; notch
`118×33` pill; status bar height 50px showing "9:41" + signal/wifi/battery glyphs.

### Shadows
- Device: `0 50px 90px -28px rgba(0,0,0,.85), 0 0 0 1px rgba(255,255,255,.06)`
- Ember CTA glow: `0 8px 22px -6px rgba(255,90,44,.7)` (and similar tinted glows per accent)
- Coach button: `0 10px 26px -6px rgba(139,107,255,.8)`

### Animations (keyframes in the HTML `<head>` style block)
- `livedot` (2–2.2s) — pulsing ring on live status dots.
- `floaty` (4s ease-in-out) — gentle vertical bob on the floating coach button & success badges.
- `sheen` (3.4s) — diagonal highlight sweep across primary CTAs.
- `restpulse` / ember pulse — ring on active set / rest timer.
- `pulse`, `spinslow`, `fadeup` — utility (opacity pulse, slow spin, fade-up entrance).

---

## Navigation Model
Bottom tab bar with 5 destinations: **Home**, **Train**, **Coach** (center, raised floating
violet button), **Fuel** (nutrition), **Library**. The Coach is also reachable as a
**persistent drawer** that slides over any screen (Screen 12). During an active "Hit It"
workout, the tab bar is replaced by a full-width "Finish & rate workout" bar (focus mode).

## Screens

### 01 · Dashboard ("Home") — accent: ember
- **Purpose:** daily home; macro progress at a glance + this week's training.
- **Layout:** greeting row (date + "Good morning, Sam" + streak pill "12" + avatar "S");
  macro **hero card** (concentric triple progress ring 128px — protein/carbs/fat — with
  "1,480 / 2,200 kcal" centered, plus three labeled macro bars); "This week" 7-day strip
  (each day a pill: done = lime check, today = ember pulse dot, planned = colored dot,
  rest = faint dot) with an "Add program" link; (continues with more cards).
- **Key components:** triple concentric SVG ring (radii 56/43/30, stroke 9, round caps,
  ember/lime/amber, drop-shadow on protein ring); streak pill; day strip.

### 02 · AI Coach Chat — accent: violet
- **Purpose:** chat with Claude; tool calls render as rich inline cards.
- **Layout:** blurred chat header (violet sparkle avatar, "Coach", "Online · knows your
  plan" with live dot); message list bottom-aligned; rounded pill input with ember send FAB.
- **Tool-call cards:** (a) **Logged meal** card — lime-tinted, "LOGGED · BREAKFAST", big
  kcal, 3 macro tiles (P/C/F). (b) **Generated routine** card — violet-tinted, "Spicy Push ·
  5 moves", 🌶 LVL 2 badge, exercise rows (name + sets×reps), "Save routine" / "Spin"
  buttons. User bubbles = ember gradient, dark text, radius `18 18 5 18`; coach bubbles =
  translucent, radius `18 18 18 5`.

### 03 · Hit It (live workout) — accent: ember
- **Purpose:** focused, one-exercise-at-a-time logging during a workout.
- **Layout:** top row = close X + "IN PROGRESS / Push Day · A" + running timer "24:18".
  **Current-exercise card:** Prev / "EXERCISE 2 / 6" / Next; exercise title "Bench Press"
  + meta + muscle tag; **how-to video** row (thumbnail + "Watch how-to" + red YouTube badge
  "0:48"); **sets table** (grid: SET | LAST TIME | THIS SET | check) with completed sets in
  lime and the **active set** as an ember card showing per-side weight stepper (− 20kg +),
  reps stepper, bar-weight selector, kg/lb toggle, computed total "= 60 kg total · 20kg bar
  + 2×20kg", and a lime "Log set 3 ✓" button. **Next up** card below. Tab bar replaced by
  "Finish & rate workout" bar.
- **Notable logic:** "last time" weights per set; per-side barbell math (bar + plates → total).

### 04 · Nutrition ("Fuel") — accent: lime
- **Purpose:** macro tracking; type meals in plain English instead of tapping.
- **Layout:** header ("Nutrition" + "720 left" lime pill); oversized counter card
  ("1,480 / 2,200 kcal", segmented macro bar P/C/F, macro gram legend); "Today's meals"
  list ("3 logged"); plain-English quick-log bar.

### 05 · Workouts ("Train") — accent: ember
- **Purpose:** browse/regenerate routines.
- **Layout:** featured next-up card; one-tap **Spin** to regenerate the routine; filterable
  routine list.

### 06 · Exercise Library — accent: violet
- **Purpose:** browse 35+ exercises with video.
- **Layout:** YouTube tutorial thumbnails, muscle-group filters, spicy-variation meter per
  exercise.

### 07 · Onboarding — accent: ember
- **Purpose:** 6-step setup wizard (showing step 2 of 6).
- **Layout:** segmented progress bar (filled ember) + "2/6"; eyebrow "YOUR GOAL"; big
  question "What are you training for?"; three selectable **goal cards** (Build muscle =
  selected ember w/ check; Lose fat; Stay healthy) each with icon + title + subtitle; bottom
  back (‹) + ember "Continue" (with sheen) buttons.

### 08 · Settings — accent: violet
- **Purpose:** profile & training targets.
- **Layout:** "Settings" title; profile card (violet avatar "S", "Sam Rivera",
  "sam@email.com · Build muscle"); "DAILY TARGETS" three tiles (2,200 KCAL / 160 PROTEIN /
  5 DAYS/WK); rows list (Goal & experience, Gym & equipment = "Home gym", Injuries to avoid =
  "Left knee"); ember-outline "Sign out" button. Standard 5-item tab bar.

### 09 · Workout Detail — accent: ember
- **Purpose:** routine breakdown before training.
- **Layout:** back + "#PD-A · WED / Push Day · A" + regenerate icon; chips (6 exercises,
  ~52 min, "Fits home gym" lime check); numbered exercise rows (name + "4 × 8 · 60 kg ·
  rest 90s" + swap icon) — each move swappable; ember "Hit it" CTA (with sheen). Tab bar.

### 10 · Exercise Detail (+ spicy) — accent: violet
- **Purpose:** single-exercise reference.
- **Layout:** back + bookmark; video hero (play button, "Tutorial · 0:48" YouTube badge);
  "Bench Press" + "Barbell · compound · intermediate"; muscle tags (Chest/Triceps/Front
  delts); **Spicy variations** section "3 levels harder" — three rows each with mini video
  thumb, name, description, and LVL 1/2/3 badge in escalating ember.

### 11 · Finish & Rate — accent: lime
- **Purpose:** post-workout summary + fatigue capture.
- **Layout:** lime success badge (floaty); "Workout complete" + "Push Day · A · finished in
  52:14"; 2×2 stat grid (52:14 DURATION / 4,820 kg TOTAL VOLUME / 22 SETS LOGGED / 2 NEW PRs
  in lime); "How did that feel?" 5-step fatigue scale (Easy/Light/Solid/Hard[selected
  ember]/Brutal); note-for-coach field; lime "Save workout" + text "Discard".
- **Notable logic:** fatigue rating feeds the next session's difficulty.

### 12 · Coach Drawer (persistent) — accent: violet
- **Purpose:** coach overlay available on every page.
- **Layout:** blurred/dimmed underlying screen; drawer slides over with **Workout /
  Nutrition topic tabs** that keep conversations separate.

### 13 · Nutrition History — accent: lime
- **Purpose:** daily history & trend.
- **Layout:** 7-day calorie **trend** (days over target shown in ember); tappable per-day log
  archive.

### 14 · Add Program (method) — accent: ember
- **Purpose:** choose how to start a program (opened from the dashboard "Add program" link).
- **Layout:** three method options — **Coach-generated**, **From a template**, **Build by
  hand**.

### 15 · Program Builder — accent: lime
- **Purpose:** manual program setup.
- **Layout:** name field; length in weeks; days/week; and a routine assigned to each day of
  the split.

### 16 · Admin — accent: violet
- **Purpose:** internal video-review pipeline.
- **Layout:** approve/reject auto-discovered YouTube tutorial videos; bulk actions; job
  triggers.

---

## Interactions & Behavior
- **Tab navigation** across Home / Train / Coach / Fuel / Library; active item uses the
  screen accent, inactive `#5F6470`.
- **Coach as drawer:** opens over any screen, dims+blurs the background; Workout/Nutrition
  topic tabs separate threads.
- **Chat tool calls** render as structured cards (logged meal, generated routine) rather than
  plain text; routine cards expose "Save routine" and "Spin" (regenerate) actions.
- **Spin** (workouts & routine cards): regenerates the routine in place.
- **Hit It focus mode:** hides the tab bar, shows a single full-width finish bar; Prev/Next
  step through exercises; per-set logging with steppers; completed sets flip to lime + check.
- **Barbell math:** weight entered per side + bar weight → computed total, with kg/lb toggle.
- **Spicy variations:** each exercise offers LVL 1–3 harder swaps with their own video clips.
- **Onboarding:** 6 steps; selecting a goal card highlights it; Continue advances; back arrow
  returns.
- **Finish & rate:** selecting a fatigue level (Easy→Brutal) tunes the next session.
- **Micro-animations:** live-dot pulse, CTA sheen sweep, floating coach button, ember
  pulse-ring on the active day/set. Keep these subtle; they signal "live", not decoration.

## State Management (suggested)
- **User/profile:** name, email, goal, experience, equipment (e.g. "Home gym"), injuries to
  avoid (e.g. "Left knee"), daily targets (kcal, protein, days/week).
- **Nutrition:** today's logged meals (name, kcal, P/C/F), running totals vs targets,
  remaining kcal, multi-day history for the 7-day trend.
- **Programs/workouts:** program (name, weeks, days/week, day→routine map), routines
  (ordered exercises with sets/reps/weight/rest), exercise library (muscles, difficulty,
  tutorial video, spicy variations).
- **Active workout session:** current routine, current exercise index, per-set entries
  (weight, reps, bar weight, unit), elapsed timer, "last time" reference per set, completed
  flags; on finish → duration, total volume, sets logged, PR detection, fatigue rating, note.
- **Coach chat:** message threads per topic (workout / nutrition); messages may carry
  structured tool-call payloads (logged-meal, generated-routine) that render as cards.
- **Admin:** queue of auto-discovered videos with approve/reject status; bulk selection;
  background job state.

## Assets
- **Fonts:** Space Grotesk, DM Sans, JetBrains Mono (Google Fonts). Use the codebase's font
  loading mechanism; swap to bundled fonts if offline support is required.
- **Icons:** all icons in the reference are inline SVG (stroke-based, ~2–2.4 stroke width).
  Replace with the codebase's existing icon set, matching weight and the semantic accent
  colors. The YouTube glyph uses brand red `#FF3B30`.
- **Images:** none shipped. Exercise/tutorial thumbnails are placeholders
  (`linear-gradient(135deg,#26282f,#15171c)` + play glyph) — wire to real YouTube thumbnails.
- **Avatars:** initial-on-gradient placeholders (violet gradient + letter).
- **Anthropic/Claude brand:** the in-app "Coach" is Claude. If your codebase has an
  established Claude/Anthropic brand system, use it for the coach's identity rather than the
  placeholder sparkle mark.

## Files
- `FitClaude.dc.html` — the full visual reference: all 16 screens in iPhone frames on one
  page, with a cover (palette + type specimen) and a caption under each screen. **Source of
  truth for exact values.**
- `support.js` — runtime required to render `FitClaude.dc.html`. Keep it next to the HTML;
  not part of the app you're building.
- `README.md` — this document.
- `screenshots/` — a rendered PNG of each screen (`01-dashboard.png` … `16-admin.png`),
  numbered to match the Screens sections above, so you can review each screen without opening
  the HTML.
