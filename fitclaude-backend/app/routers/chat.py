from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.coach import handle_chat
from app.database import get_db
from app.schemas.chat import ChatRequest, ChatResponse

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest, db: AsyncSession = Depends(get_db)):
    result = await handle_chat(
        request.user_id,
        request.message,
        db,
        topic=request.topic,
        image_base64=request.image_base64,
        image_media_type=request.image_media_type,
    )
    return ChatResponse(**result)
