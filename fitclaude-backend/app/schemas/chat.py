from typing import Optional

from pydantic import BaseModel


class ChatRequest(BaseModel):
    user_id: str
    message: str
    topic: str = "workout"
    image_base64: Optional[str] = None
    image_media_type: Optional[str] = None
    timezone: Optional[str] = None  # e.g. "America/New_York"
    use_vision: bool = False  # Pro/Unlimited only — triggers vision nutrition agent for food photos


class ChatResponse(BaseModel):
    model_config = {"protected_namespaces": ()}

    response: str
    workout_id: Optional[str] = None
    nutrition_log_id: Optional[str] = None
    model_used: Optional[str] = None
