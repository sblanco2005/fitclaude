from typing import Optional

from pydantic import BaseModel


class ChatRequest(BaseModel):
    user_id: str
    message: str
    image_base64: Optional[str] = None
    image_media_type: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    workout_id: Optional[str] = None
    nutrition_log_id: Optional[str] = None
