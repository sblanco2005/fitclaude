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
    _key: None = Depends(_verify_api_key),
    db: AsyncSession = Depends(get_db),
):
    """Trigger the nightly video linking job."""
    result = await run_video_linking_job(db)
    return result


@router.post("/video-discovery")
async def trigger_video_discovery(
    _key: None = Depends(_verify_api_key),
    db: AsyncSession = Depends(get_db),
):
    """Trigger the video discovery job — fetches reference videos with classification."""
    result = await run_video_discovery_job(db)
    return result
