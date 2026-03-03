"""Job trigger endpoints — called by cron or admin "Run Now" buttons."""

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.jobs.video_discovery import run_video_discovery_job
from app.jobs.video_linker import run_video_linking_job

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


def _verify_api_key(x_job_api_key: str = Header(..., alias="X-Job-API-Key")):
    if not settings.job_api_key or x_job_api_key != settings.job_api_key:
        raise HTTPException(status_code=401, detail="Invalid API key")


@router.post("/video-linking")
async def trigger_video_linking(
    limit: int = 95,
    _key: None = Depends(_verify_api_key),
    db: AsyncSession = Depends(get_db),
):
    """Trigger the nightly video linking job.

    Args:
        limit: Max exercises to search per run. Each search costs ~101
               YouTube API quota units. Free daily quota is 10,000 units,
               so the default of 95 stays safely within limits.
               Set to 0 to process all (careful with quota!).
    """
    result = await run_video_linking_job(db, limit=limit)
    return result


@router.post("/video-discovery")
async def trigger_video_discovery(
    limit: int = 95,
    _key: None = Depends(_verify_api_key),
    db: AsyncSession = Depends(get_db),
):
    """Trigger the video discovery job — fetches reference videos with classification.

    Args:
        limit: Max exercises to search per run. Each search costs ~101
               YouTube API quota units. Free daily quota is 10,000 units,
               so the default of 95 stays safely within limits.
               Set to 0 to process all (careful with quota!).
    """
    result = await run_video_discovery_job(db, limit=limit)
    return result
