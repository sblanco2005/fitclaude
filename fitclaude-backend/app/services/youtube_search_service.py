"""YouTube Data API v3 wrapper for exercise video search."""

import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search"
YOUTUBE_VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos"


async def search_youtube(query: str, max_results: int = 3) -> list[dict]:
    """Search YouTube and return video metadata.

    Each result: videoId, title, channelTitle, thumbnailUrl, publishedAt.
    Uses 100 quota units per call (free tier = 10k units/day).
    """
    if not settings.youtube_api_key:
        raise ValueError("YOUTUBE_API_KEY not configured")

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            YOUTUBE_SEARCH_URL,
            params={
                "part": "snippet",
                "q": query,
                "type": "video",
                "maxResults": max_results,
                "videoCategoryId": "17",  # Sports
                "key": settings.youtube_api_key,
            },
        )
        resp.raise_for_status()
        items = resp.json().get("items", [])

        return [
            {
                "videoId": item["id"]["videoId"],
                "title": item["snippet"]["title"],
                "channelTitle": item["snippet"]["channelTitle"],
                "thumbnailUrl": item["snippet"]["thumbnails"]["medium"]["url"],
                "publishedAt": item["snippet"]["publishedAt"],
            }
            for item in items
        ]


async def get_video_details(video_ids: list[str]) -> dict[str, dict]:
    """Batch fetch video details (duration, view count).

    Uses 1 quota unit per call, up to 50 IDs per call.
    """
    if not video_ids or not settings.youtube_api_key:
        return {}

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            YOUTUBE_VIDEOS_URL,
            params={
                "part": "contentDetails,statistics",
                "id": ",".join(video_ids[:50]),
                "key": settings.youtube_api_key,
            },
        )
        resp.raise_for_status()

        result = {}
        for item in resp.json().get("items", []):
            result[item["id"]] = {
                "duration": item["contentDetails"]["duration"],
                "viewCount": int(item["statistics"].get("viewCount", 0)),
            }
        return result
