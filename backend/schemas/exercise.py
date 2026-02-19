from typing import List, Optional

from pydantic import BaseModel


class ExerciseVariationResponse(BaseModel):
    id: int
    name: str
    spicy_level: int
    modification_type: str
    description: str

    model_config = {"from_attributes": True}


class ExerciseResponse(BaseModel):
    id: int
    name: str
    muscle_group: str
    secondary_muscles: Optional[str] = None
    equipment_required: Optional[str] = None
    difficulty: str
    exercise_type: str
    instructions: Optional[str] = None
    variations: List[ExerciseVariationResponse] = []

    model_config = {"from_attributes": True}
