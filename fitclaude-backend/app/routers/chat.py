import logging

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.coach import handle_chat
from app.database import get_db
from app.schemas.chat import ChatRequest, ChatResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest, db: AsyncSession = Depends(get_db)):
    try:
        result = await handle_chat(
            request.user_id,
            request.message,
            db,
            topic=request.topic,
            image_base64=request.image_base64,
            image_media_type=request.image_media_type,
            timezone=request.timezone,
        )
        return ChatResponse(**result)
    except Exception as e:
        logger.error(f"[Chat] Unexpected error: {type(e).__name__}: {e}", exc_info=True)
        return ChatResponse(response="Something went wrong. Please try again.", workout_id=None, nutrition_log_id=None)
