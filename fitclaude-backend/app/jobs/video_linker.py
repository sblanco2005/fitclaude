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
    db: AsyncSession, exercise: Exercise, commit: bool = False,
    skip_video_ids: set[str] | None = None,
) -> int:
    """Search YouTube for the single best tutorial video for an exercise.
    Skips any youtubeVideoId that already exists for this exercise (any status)
    and any IDs in skip_video_ids. Returns 1 if a video was added, 0 otherwise."""
    # Fetch more results when we need to skip known videos
    max_results = 5 if skip_video_ids else 1
    results = await search_youtube(
        f"how to {exercise.name} proper form technique",
        max_results=max_results,
    )
    if not results:
        logger.info(f"[VideoLinker] No results for '{exercise.name}'")
        return 0

    # Collect all YouTube video IDs already in DB for this exercise
    existing_result = await db.execute(
        select(ExerciseVideo.youtube_video_id).where(
            ExerciseVideo.exercise_id == exercise.id,
        )
    )
    existing_video_ids = {row[0] for row in existing_result.all()}
    all_skip = existing_video_ids | (skip_video_ids or set())

    # Find first result not already in DB
    video = None
    for candidate in results:
        if candidate["videoId"] not in all_skip:
            video = candidate
            break

    if not video:
        logger.info(f"[VideoLinker] All results already exist for '{exercise.name}'")
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


async def run_video_linking_job(db: AsyncSession, limit: int = 95) -> dict:
    """For each exercise without an approved/pending primary video,
    search YouTube and store the single best tutorial as a pending ExerciseVideo.

    Args:
        limit: Max exercises to search in this batch. Each search costs ~101
               YouTube API quota units (100 for search + 1 for details).
               Free daily quota is 10,000 units, so safe limit is ~95 per run.
               Set to 0 or negative to process all (careful with quota!).
    """

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

    # 4. Apply batch limit
    batch = uncovered[:limit] if limit > 0 else uncovered
    remaining = max(0, len(uncovered) - len(batch))

    logger.info(
        f"[VideoLinker] {len(exercises)} exercises total, "
        f"{len(covered_ids)} covered, {len(pending_ids)} pending, "
        f"{len(uncovered)} uncovered — processing batch of {len(batch)}"
    )

    # 5. Search YouTube for each exercise in this batch
    added = 0
    errors = 0
    quota_used = 0
    for exercise in batch:
        try:
            count = await _link_best_video(db, exercise)
            added += count
            quota_used += 101  # 100 for search + 1 for details
        except Exception as e:
            logger.error(f"[VideoLinker] Failed for '{exercise.name}': {e}")
            errors += 1
            continue

    await db.commit()

    return {
        "added": added,
        "errors": errors,
        "batch_size": len(batch),
        "total_exercises": len(exercises),
        "already_covered": len(covered_ids),
        "already_pending": len(pending_ids),
        "remaining_uncovered": remaining,
        "estimated_quota_used": quota_used,
        "estimated_days_to_complete": (remaining + len(batch) - 1) // max(len(batch), 1) if remaining > 0 else 0,
    }


async def run_single_exercise_video_search(
    db: AsyncSession, exercise_id: str, force: bool = False
) -> dict:
    """Search YouTube for the best tutorial video for a specific exercise by ID.

    If force=True, delete all pending videos for this exercise first so a fresh
    search can run even when pending videos already exist.
    """
    result = await db.execute(
        select(Exercise).where(Exercise.id == exercise_id)
    )
    exercise = result.scalar_one_or_none()
    if not exercise:
        return {"error": "Exercise not found", "added": 0}

    # Collect YouTube video IDs to skip (rejected + approved videos for this exercise)
    skip_video_ids: set[str] = set()

    if force:
        # Reject pending videos and collect all known video IDs to skip
        pending = await db.execute(
            select(ExerciseVideo).where(
                ExerciseVideo.exercise_id == exercise_id,
                ExerciseVideo.status == "pending",
            )
        )
        rejected = 0
        for vid in pending.scalars().all():
            vid.status = "rejected"
            skip_video_ids.add(vid.youtube_video_id)
            rejected += 1
        if rejected:
            await db.commit()
            logger.info(f"[VideoLinker] Force: rejected {rejected} pending videos for '{exercise.name}'")

        # Also skip any previously rejected/approved videos
        all_vids = await db.execute(
            select(ExerciseVideo.youtube_video_id).where(
                ExerciseVideo.exercise_id == exercise_id,
            )
        )
        skip_video_ids.update(row[0] for row in all_vids.all())
    else:
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
        added = await _link_best_video(db, exercise, commit=True, skip_video_ids=skip_video_ids)
        return {"added": added, "exercise": exercise.name}
    except Exception as e:
        logger.error(f"[VideoLinker] Single search failed for '{exercise.name}': {e}")
        return {"error": str(e), "added": 0}
