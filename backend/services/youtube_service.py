"""YouTube transcript parsing — extract exercises from fitness videos."""

import json
import re

from anthropic import AsyncAnthropic
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from youtube_transcript_api import YouTubeTranscriptApi

from backend.config import settings
from backend.models.exercise import Exercise, ExerciseVariation

client = AsyncAnthropic(api_key=settings.anthropic_api_key)

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
    """Fetch transcript text from a YouTube video."""
    ytt = YouTubeTranscriptApi()
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
