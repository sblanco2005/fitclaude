"""Nightly job: find the single best YouTube tutorial video for each exercise."""

import logging

from cuid2 import Cuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Exercise
from app.models.exercise_video import ExerciseVideo
from app.services.youtube_search_service import get_video_details, search_youtube

logger = logging.getLogger(__name__)
cuid_generator = Cuid()


async def _link_best_video(
    db: AsyncSession, exercise: Exercise, commit: bool = False
) -> int:
    """Search YouTube for the single best tutorial video for an exercise.
    Skips any youtubeVideoId that already exists for this exercise (any status).
    Returns 1 if a video was added, 0 otherwise."""
    results = await search_youtube(
        f"how to {exercise.name} proper form technique",
        max_results=1,
    )
    if not results:
        logger.info(f"[VideoLinker] No results for '{exercise.name}'")
        return 0

    video = results[0]

    # Check if this specific YouTube video already exists for this exercise
    existing_result = await db.execute(
        select(ExerciseVideo.youtube_video_id).where(
            ExerciseVideo.exercise_id == exercise.id,
        )
    )
    existing_video_ids = {row[0] for row in existing_result.all()}

    if video["videoId"] in existing_video_ids:
        logger.info(f"[VideoLinker] Video already exists for '{exercise.name}'")
        return 0

    # Get video details (duration, view count)
    details = await get_video_details([video["videoId"]])
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
        video_type="tutorial",
        is_primary=True,
    )
    db.add(ev)

    if commit:
        await db.commit()

    logger.info(f"[VideoLinker] Added best tutorial for '{exercise.name}'")
    return 1


async def run_video_linking_job(db: AsyncSession) -> dict:
    """For each exercise without an approved/pending primary video,
    search YouTube and store the single best tutorial as a pending ExerciseVideo."""

    # 1. Get all exercises
    result = await db.execute(select(Exercise))
    exercises = result.scalars().all()

    # 2. Get exercise IDs already covered (approved primary video)
    result = await db.execute(
        select(ExerciseVideo.exercise_id).where(
            ExerciseVideo.status == "approved",
            ExerciseVideo.is_primary == True,  # noqa: E712
        )
    )
    covered_ids = {row[0] for row in result.all() if row[0]}

    # 3. Also skip exercises with pending videos
    result = await db.execute(
        select(ExerciseVideo.exercise_id).where(
            ExerciseVideo.status == "pending",
        )
    )
    pending_ids = {row[0] for row in result.all() if row[0]}

    uncovered = [
        ex for ex in exercises
        if ex.id not in covered_ids
        and ex.id not in pending_ids
    ]

    logger.info(
        f"[VideoLinker] {len(exercises)} exercises total, "
        f"{len(covered_ids)} covered, {len(pending_ids)} pending, "
        f"{len(uncovered)} to search"
    )

    # 4. Search YouTube for each uncovered exercise (1 best result)
    added = 0
    errors = 0
    for exercise in uncovered:
        try:
            count = await _link_best_video(db, exercise)
            added += count
        except Exception as e:
            logger.error(f"[VideoLinker] Failed for '{exercise.name}': {e}")
            errors += 1
            continue

    await db.commit()

    return {
        "added": added,
        "errors": errors,
        "total_exercises": len(exercises),
        "already_covered": len(covered_ids),
        "already_pending": len(pending_ids),
    }


async def run_single_exercise_video_search(db: AsyncSession, exercise_id: str) -> dict:
    """Search YouTube for the best tutorial video for a specific exercise by ID."""
    result = await db.execute(
        select(Exercise).where(Exercise.id == exercise_id)
    )
    exercise = result.scalar_one_or_none()
    if not exercise:
        return {"error": "Exercise not found", "added": 0}

    # Check if already has pending or approved videos
    existing = await db.execute(
        select(ExerciseVideo.id).where(
            ExerciseVideo.exercise_id == exercise_id,
            ExerciseVideo.status.in_(["approved", "pending"]),
        )
    )
    if existing.first():
        return {"message": "Already has videos", "added": 0}

    try:
        added = await _link_best_video(db, exercise, commit=True)
        return {"added": added, "exercise": exercise.name}
    except Exception as e:
        logger.error(f"[VideoLinker] Single search failed for '{exercise.name}': {e}")
        return {"error": str(e), "added": 0}
