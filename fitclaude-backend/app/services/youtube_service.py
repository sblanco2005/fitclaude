"""YouTube transcript parsing — extract exercises OR a full routine from videos."""

import json
import logging
import re

from anthropic import AsyncAnthropic
from cuid2 import Cuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api.proxies import WebshareProxyConfig

from app.config import settings
from app.models.exercise import Exercise, ExerciseVariation

logger = logging.getLogger(__name__)

client = AsyncAnthropic(api_key=settings.anthropic_api_key)
# Meta (Muse Spark) — ~1M context, ideal for a whole transcript. Bearer auth
# (auth_token), not x-api-key. Instantiated locally to avoid importing coach.py.
_meta_client = AsyncAnthropic(auth_token=settings.model_api_key, base_url=settings.meta_base_url)
cuid_generator = Cuid()

EXTRACT_EXERCISES_PROMPT = """You are a fitness exercise parser. Given a YouTube video transcript, extract all distinct exercises mentioned.

Return ONLY a valid JSON array. Each element must have:
- "name": string — proper exercise name (e.g., "Barbell Hip Thrust", not "hip thrusts")
- "muscle_group": one of: chest, back, shoulders, biceps, triceps, quadriceps, hamstrings, glutes, calves, core, full_body
- "secondary_muscles": comma-separated string or null
- "equipment_required": comma-separated string or null (null = bodyweight)
- "difficulty": "beginner", "intermediate", or "advanced"
- "exercise_type": "compound", "isolation", "cardio", "stretch", or "plyometric"
- "instructions": 1-2 sentence form cue extracted or inferred from the video context
- "variations": array of 0-2 variations mentioned in the video, each with:
  - "name": string
  - "spicy_level": 1, 2, or 3
  - "modification_type": one of: tempo, grip, stance, load_curve, intensity, unilateral, angle, pause
  - "description": string

Rules:
- Only include actual exercises, not warmups/cooldowns unless they are specific movements.
- Normalize names: capitalize properly, use full names (e.g., "Romanian Deadlift" not "RDL").
- If the transcript mentions sets/reps but not form cues, write brief standard instructions.
- Do NOT include duplicates.
- Return an empty array [] if no exercises are found.

Respond with ONLY the JSON array, no markdown fencing, no explanation."""


def _extract_video_id(url: str) -> str:
    """Extract YouTube video ID from various URL formats."""
    patterns = [
        r'(?:v=|/v/|youtu\.be/)([a-zA-Z0-9_-]{11})',
        r'(?:embed/)([a-zA-Z0-9_-]{11})',
        r'^([a-zA-Z0-9_-]{11})$',
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    raise ValueError(f"Could not extract video ID from: {url}")


def _fetch_transcript(video_id: str) -> str:
    """Fetch transcript text from a YouTube video (SYNC — offload with
    asyncio.to_thread when called from async code).

    YouTube blocks anonymous scraping from datacenter IPs (the VPS), so route
    through the Webshare RESIDENTIAL proxy when credentials are configured.
    """
    proxy_config = None
    if settings.webshare_proxy_username and settings.webshare_proxy_password:
        proxy_config = WebshareProxyConfig(
            proxy_username=settings.webshare_proxy_username,
            proxy_password=settings.webshare_proxy_password,
        )
    ytt = YouTubeTranscriptApi(proxy_config=proxy_config)
    transcript = ytt.fetch(video_id)
    return " ".join(snippet.text for snippet in transcript.snippets)


async def _parse_exercises_from_transcript(transcript: str) -> list[dict]:
    """Send transcript to Claude to extract structured exercise data."""
    # Truncate very long transcripts to stay within token limits
    max_chars = 15000
    if len(transcript) > max_chars:
        transcript = transcript[:max_chars] + "... [transcript truncated]"

    response = await client.messages.create(
        model=settings.agent_model,
        max_tokens=2048,
        messages=[{
            "role": "user",
            "content": f"Extract exercises from this YouTube video transcript:\n\n{transcript}",
        }],
        system=EXTRACT_EXERCISES_PROMPT,
    )

    raw_text = response.content[0].text.strip()
    # Strip markdown fencing if present
    if raw_text.startswith("```"):
        raw_text = re.sub(r'^```(?:json)?\s*', '', raw_text)
        raw_text = re.sub(r'\s*```$', '', raw_text)

    return json.loads(raw_text)


# ─── Transcript → a full ROUTINE (not just library exercises) ────────────────

WORKOUT_FROM_TRANSCRIPT_PROMPT = """You are a fitness coach. From a YouTube workout video's transcript, build ONE structured workout routine that matches what the video actually does.

Return ONLY a valid JSON object (no markdown, no prose) with:
- "name": a short routine name based on the video (e.g. "Chest & Triceps Hypertrophy", "20-Min Rower HIIT")
- "workout_type": one of push, pull, legs, upper, lower, full_body, cardio, custom
- "category": one of lifting, hiit, cardio, mobility, calisthenics, sport
- "tips": 1-2 sentence overall guidance, or ""
- "exercises": an array of the exercises/segments IN ORDER, each with:
  - "name": proper exercise name ("Barbell Bench Press", "Rowing Machine")
  - "muscle_group": one of chest, back, shoulders, biceps, triceps, quadriceps, hamstrings, glutes, calves, core, full_body
  - "sets": integer number of sets (for a cardio segment this is rounds; default 1)
  - "reps": string rep target ("8-12", "10", "AMRAP"); for a timed/distance cardio segment use ""
  - "rest_seconds": integer rest between sets, or null
  - "notes": a short form cue from the video, or ""
  For CARDIO / conditioning segments, ALSO include (instead of weights):
  - "duration_seconds": integer for a timed segment
  - "distance": number with "distance_unit": one of m, km, mi
  - "calories": integer calorie target (e.g. air bike)

Rules:
- Use the sets/reps the video prescribes; if it doesn't specify, pick sensible defaults (3-4 sets, 8-12 reps).
- If the video is a cardio/HIIT/conditioning workout, set category "cardio" and give each segment its duration_seconds and/or distance and/or calories.
- Only include real exercises — skip intros, sponsor reads, and talking. Cap at ~10 exercises unless the video clearly programs more.
- If the transcript is NOT a workout (e.g. a vlog or cooking video) or has no exercises, return {"exercises": []}.

Respond with ONLY the JSON object."""


async def parse_workout_from_transcript(transcript: str) -> dict | None:
    """Transcript → params for _tool_generate_workout (or None if not a workout)."""
    max_chars = 40000  # bound cost; Muse Spark has ~1M context but transcripts rarely exceed this
    if len(transcript) > max_chars:
        transcript = transcript[:max_chars] + "... [truncated]"

    try:
        resp = await _meta_client.messages.create(
            model=settings.meta_model,
            max_tokens=max(settings.meta_max_tokens, 8000),  # room for reasoning + JSON
            system=WORKOUT_FROM_TRANSCRIPT_PROMPT,
            messages=[{"role": "user", "content": f"Build a routine from this workout video transcript:\n\n{transcript}"}],
        )
    except Exception as e:
        logger.error(f"[youtube] workout extraction failed: {e}")
        return None

    # Muse Spark emits redacted_thinking blocks before the text — join text only.
    text = "".join(
        b.text for b in resp.content if getattr(b, "type", None) == "text" and getattr(b, "text", None)
    ).strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if not m:
        return None
    try:
        data = json.loads(m.group(0))
    except Exception:
        return None
    exercises = data.get("exercises")
    if not isinstance(exercises, list) or len(exercises) < 2:
        return None  # not a workout / nothing usable
    return data


async def import_exercises_from_youtube(
    db: AsyncSession, youtube_url: str
) -> dict:
    """
    Full pipeline: URL -> transcript -> Claude parsing -> DB insert.
    Returns summary of what was added/skipped.
    """
    # 1. Extract video ID and fetch transcript
    video_id = _extract_video_id(youtube_url)
    transcript = _fetch_transcript(video_id)

    if not transcript:
        return {"error": "No transcript available for this video."}

    # 2. Parse exercises from transcript
    parsed_exercises = await _parse_exercises_from_transcript(transcript)

    if not parsed_exercises:
        return {
            "added": [],
            "skipped": [],
            "message": "No exercises found in the video transcript.",
        }

    # 3. Deduplicate and insert
    added = []
    skipped = []

    for ex_data in parsed_exercises:
        # Check if exercise already exists
        result = await db.execute(
            select(Exercise).where(Exercise.name.ilike(f"%{ex_data['name']}%"))
        )
        existing = result.scalar_one_or_none()

        if existing:
            skipped.append(ex_data["name"])
            continue

        # Insert new exercise
        exercise = Exercise(
            id=cuid_generator.generate(),
            name=ex_data["name"],
            muscle_group=ex_data.get("muscle_group", "full_body"),
            secondary_muscles=ex_data.get("secondary_muscles"),
            equipment_required=ex_data.get("equipment_required"),
            difficulty=ex_data.get("difficulty", "intermediate"),
            exercise_type=ex_data.get("exercise_type", "compound"),
            instructions=ex_data.get("instructions"),
        )
        db.add(exercise)
        await db.flush()

        # Insert variations if any
        for var_data in ex_data.get("variations", []):
            variation = ExerciseVariation(
                id=cuid_generator.generate(),
                base_exercise_id=exercise.id,
                name=var_data["name"],
                spicy_level=var_data.get("spicy_level", 1),
                modification_type=var_data.get("modification_type", "intensity"),
                description=var_data.get("description", ""),
            )
            db.add(variation)

        added.append(ex_data["name"])

    await db.flush()

    return {
        "added": added,
        "skipped": skipped,
        "total_added": len(added),
        "total_skipped": len(skipped),
        "message": f"Added {len(added)} new exercises, skipped {len(skipped)} duplicates.",
    }
