from typing import Optional

from pydantic import BaseModel


class EquipmentCreate(BaseModel):
    name: str
    category: str
    details: Optional[str] = None


class EquipmentResponse(BaseModel):
    id: int
    user_id: int
    name: str
    category: str
    details: Optional[str] = None

    model_config = {"from_attributes": True}
