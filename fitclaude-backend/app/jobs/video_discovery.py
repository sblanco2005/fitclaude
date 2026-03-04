"""Job: discover reference and tutorial YouTube videos for exercises (3 results each, auto-classified)."""

import logging
import re

from cuid2 import Cuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Exercise
from app.models.exercise_video import ExerciseVideo
from app.services.youtube_search_service import get_video_details, search_youtube

logger = logging.getLogger(__name__)
cuid_generator = Cuid()

MUSCLE_GROUP_WORDS = {
    "chest", "back", "shoulder", "shoulders", "bicep", "biceps",
    "tricep", "triceps", "quad", "quads", "quadricep", "quadriceps",
    "hamstring", "hamstrings", "glute", "glutes", "calf", "calves",
    "core", "ab", "abs", "leg", "legs", "arm", "arms",
    "upper body", "lower body", "full body", "push", "pull",
}


def classify_video_type(title: str, exercise_name: str) -> str:
    """Classify a YouTube video as 'tutorial' (single exercise) or 'reference' (general/compilation).

    Heuristics for 'reference':
      1. Number > 1 + fitness keyword (e.g. "10 Best Back Exercises")
      2. Plural "exercises" in title
      3. "Best/Top/Ultimate" + muscle group word without the specific exercise name
      4. "Workout/Training/Routine" + muscle group word without exercise name
    """
    t = title.lower()
    ex = exercise_name.lower()

    # Signal 1: number > 1 + fitness keyword
    if re.search(r"\b([2-9]|[1-9]\d+)\b", t):
        if re.search(r"\b(best|top|worst|must|essential|exercise|exercises|move|moves|workout)\b", t):
            return "reference"

    # Signal 2: plural "exercises"
    if re.search(r"\bexercises\b", t):
        return "reference"

    # Signal 3: superlative + muscle group word (without exercise name)
    if re.search(r"\b(best|top|ultimate|greatest|most effective)\b", t):
        for mg in MUSCLE_GROUP_WORDS:
            if mg in t and ex not in t:
                return "reference"

    # Signal 4: generic workout/training + muscle group word (without exercise name)
    if re.search(r"\b(workout|training|day|routine|program|session)\b", t):
        for mg in MUSCLE_GROUP_WORDS:
            if mg in t and ex not in t:
                return "reference"

    return "tutorial"


async def _discover_videos_for_exercise(
    db: AsyncSession, exercise: Exercise
) -> int:
    """Search YouTube for 3 videos for an exercise, classify them, and store as pending.
    Skips any youtubeVideoId that already exists for this exercise (any status).
    Returns the number of videos added."""
    results = await search_youtube(
        f"{exercise.name} exercise",
        max_results=1,
    )
    if not results:
        logger.info(f"[VideoDiscovery] No results for '{exercise.name}'")
        return 0

    # Get all youtubeVideoIds already stored for this exercise (any status)
    existing_result = await db.execute(
        select(ExerciseVideo.youtube_video_id).where(
            ExerciseVideo.exercise_id == exercise.id,
        )
    )
    existing_video_ids = {row[0] for row in existing_result.all()}

    video_ids = [v["videoId"] for v in results]
    details = await get_video_details(video_ids)
    added = 0

    for i, video in enumerate(results):
        # Skip if this specific YouTube video was already fetched
        if video["videoId"] in existing_video_ids:
            continue

        video_detail = details.get(video["videoId"], {})

        ev = ExerciseVideo(
            id=cuid_generator.generate(),
            exercise_id=exercise.id,
            exercise_name=exercise.name,
            youtube_video_id=video["videoId"],
            youtube_url=f"https://www.youtube.com/watch?v={video['videoId']}",
            title=video["title"],
            channel_name=video["channelTitle"],
            thumbnail_url=video["thumbnailUrl"],
            duration=video_detail.get("duration"),
            view_count=video_detail.get("viewCount"),
            status="pending",
            video_type=classify_video_type(video["title"], exercise.name),
            is_primary=False,
        )
        db.add(ev)
        added += 1

    logger.info(
        f"[VideoDiscovery] Found {len(results)} results, added {added} new for '{exercise.name}'"
    )
    return added


async def run_video_discovery_job(db: AsyncSession, limit: int = 95) -> dict:
    """For each exercise, search YouTube for videos, classify them as
    tutorial or reference, and store them as pending for admin review.

    Args:
        limit: Max exercises to search in this batch. Each search costs ~101
               YouTube API quota units (100 for search + 1 for details).
               Free daily quota is 10,000 units, so safe limit is ~95 per run.
               Set to 0 or negative to process all (careful with quota!).
    """

    # 1. Get all exercises
    result = await db.execute(select(Exercise))
    exercises = result.scalars().all()

    # 2. Skip exercises that already have ANY video (approved, pending, or from Video Linker)
    result = await db.execute(
        select(ExerciseVideo.exercise_id).where(
            ExerciseVideo.status.in_(["approved", "pending"]),
        )
    )
    has_video_ids = {row[0] for row in result.all() if row[0]}

    uncovered = [
        ex for ex in exercises
        if ex.id not in has_video_ids
    ]

    # 3. Apply batch limit
    batch = uncovered[:limit] if limit > 0 else uncovered
    remaining = max(0, len(uncovered) - len(batch))

    logger.info(
        f"[VideoDiscovery] {len(exercises)} exercises total, "
        f"{len(has_video_ids)} already have videos, "
        f"{len(uncovered)} uncovered — processing batch of {len(batch)}"
    )

    # 4. Search YouTube for each exercise in this batch
    added = 0
    errors = 0
    quota_used = 0
    for exercise in batch:
        try:
            count = await _discover_videos_for_exercise(db, exercise)
            added += count
            quota_used += 101  # 100 for search + 1 for details
        except Exception as e:
            logger.error(f"[VideoDiscovery] Failed for '{exercise.name}': {e}")
            errors += 1
            continue

    await db.commit()

    return {
        "added": added,
        "errors": errors,
        "batch_size": len(batch),
        "total_exercises": len(exercises),
        "already_have_videos": len(has_video_ids),
        "remaining_uncovered": remaining,
        "estimated_quota_used": quota_used,
        "estimated_days_to_complete": (remaining + len(batch) - 1) // max(len(batch), 1) if remaining > 0 else 0,
    }
