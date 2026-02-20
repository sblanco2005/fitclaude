"""Weekly job: discover new exercises from fitness YouTube channels."""

import json
import logging

from anthropic import AsyncAnthropic
from cuid2 import Cuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import Exercise
from app.models.pending_exercise import PendingExercise, PendingVariation
from app.services.youtube_search_service import search_youtube

logger = logging.getLogger(__name__)
cuid_generator = Cuid()

client = AsyncAnthropic(api_key=settings.anthropic_api_key)

DISCOVERY_PROMPT = """You are an exercise extraction expert. Given a list of YouTube fitness video titles and channels, extract individual exercises mentioned or implied.

For each exercise, return:
- name: The standard exercise name (e.g. "Bulgarian Split Squat", not "Jeff's killer leg move")
- muscle_group: One of: chest, back, shoulders, biceps, triceps, quadriceps, hamstrings, glutes, core, calves, full_body
- secondary_muscles: Comma-separated (optional)
- equipment_required: Comma-separated (optional)
- difficulty: beginner, intermediate, or advanced
- exercise_type: compound, isolation, cardio, stretch, or plyometric
- instructions: Brief 1-2 sentence form cue
- source_video_id: The videoId from the source video
- channel_name: The channel that featured it

Return ONLY a JSON array. No markdown, no explanation. If a video doesn't clearly feature specific exercises, skip it.
Example: [{"name": "Bulgarian Split Squat", "muscle_group": "quadriceps", "secondary_muscles": "glutes, hamstrings", "equipment_required": "dumbbells, bench", "difficulty": "intermediate", "exercise_type": "compound", "instructions": "Place rear foot on bench, lower until front thigh is parallel to ground.", "source_video_id": "abc123", "channel_name": "Jeff Nippard"}]"""


async def run_exercise_discovery_job(db: AsyncSession) -> dict:
    """Search trending fitness channels, extract new exercises with Haiku."""

    channels = [
        ch.strip()
        for ch in settings.youtube_discovery_channels.split(",")
        if ch.strip()
    ]

    if not channels:
        return {"discovered": 0, "message": "No channels configured"}

    # 1. Search recent videos from each channel
    all_videos = []
    for channel in channels:
        try:
            results = await search_youtube(
                f"{channel} exercise workout", max_results=5
            )
            all_videos.extend(results)
        except Exception as e:
            logger.error(f"[Discovery] Search failed for '{channel}': {e}")
            continue

    if not all_videos:
        return {"discovered": 0, "message": "No videos found"}

    logger.info(f"[Discovery] Found {len(all_videos)} videos from {len(channels)} channels")

    # 2. Batch video titles into one Haiku call
    titles_text = "\n".join(
        f"- [{v['title']}] by {v['channelTitle']} (videoId: {v['videoId']})"
        for v in all_videos
    )

    try:
        response = await client.messages.create(
            model=settings.haiku_model,
            max_tokens=4096,
            system=DISCOVERY_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": f"Extract exercises from these fitness video titles:\n\n{titles_text}",
                }
            ],
        )

        raw_text = response.content[0].text.strip()
        # Handle potential markdown wrapping
        if raw_text.startswith("```"):
            raw_text = raw_text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

        parsed = json.loads(raw_text)
    except Exception as e:
        logger.error(f"[Discovery] Haiku extraction failed: {e}")
        return {"discovered": 0, "error": str(e)}

    if not isinstance(parsed, list):
        return {"discovered": 0, "error": "Haiku did not return a list"}

    # 3. Deduplicate against existing + pending exercises
    result = await db.execute(select(Exercise.name))
    existing_names = {row[0].lower() for row in result.all()}

    result = await db.execute(
        select(PendingExercise.name).where(PendingExercise.status == "pending")
    )
    pending_names = {row[0].lower() for row in result.all()}

    new_exercises = [
        ex
        for ex in parsed
        if ex.get("name", "").lower() not in existing_names
        and ex.get("name", "").lower() not in pending_names
    ]

    logger.info(
        f"[Discovery] Extracted {len(parsed)} exercises, "
        f"{len(parsed) - len(new_exercises)} duplicates, "
        f"{len(new_exercises)} new"
    )

    # 4. Insert as pending
    added = 0
    for ex_data in new_exercises:
        # Find the source video thumbnail
        source_video_id = ex_data.get("source_video_id")
        thumbnail_url = None
        if source_video_id:
            for v in all_videos:
                if v["videoId"] == source_video_id:
                    thumbnail_url = v["thumbnailUrl"]
                    break

        pe = PendingExercise(
            id=cuid_generator.generate(),
            name=ex_data["name"],
            muscle_group=ex_data.get("muscle_group", "full_body"),
            secondary_muscles=ex_data.get("secondary_muscles"),
            equipment_required=ex_data.get("equipment_required"),
            difficulty=ex_data.get("difficulty", "intermediate"),
            exercise_type=ex_data.get("exercise_type", "compound"),
            instructions=ex_data.get("instructions"),
            youtube_video_id=source_video_id,
            youtube_url=(
                f"https://www.youtube.com/watch?v={source_video_id}"
                if source_video_id
                else None
            ),
            channel_name=ex_data.get("channel_name"),
            thumbnail_url=thumbnail_url,
            status="pending",
        )
        db.add(pe)
        added += 1

    await db.commit()

    return {
        "discovered": added,
        "total_videos_scanned": len(all_videos),
        "total_extracted": len(parsed),
        "duplicates_skipped": len(parsed) - len(new_exercises),
    }
