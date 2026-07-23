from typing import List, Optional

from pydantic import BaseModel


class ExerciseVariationResponse(BaseModel):
    id: str
    name: str
    spicy_level: int
    modification_type: str
    description: str

    model_config = {"from_attributes": True}


class ExerciseResponse(BaseModel):
    id: str
    name: str
    muscle_group: str
    secondary_muscles: Optional[str] = None
    equipment_required: Optional[str] = None
    difficulty: str
    exercise_type: str
    instructions: Optional[str] = None
    gif_url: Optional[str] = None
    variations: List[ExerciseVariationResponse] = []

    model_config = {"from_attributes": True}


# ─── Exercise identification (photo → exercise) ──────────────────────────────


class IdentifyExerciseRequest(BaseModel):
    image_base64: str
    image_media_type: str
    # The muscle group the user is currently training — biases the suggested
    # exercises toward that muscle for this equipment (e.g. bench + glutes).
    target_muscle: Optional[str] = None


class ExerciseMatch(BaseModel):
    id: str
    name: str
    muscleGroup: str
    confidence: str  # "high", "medium", "low"


class IdentifyExerciseResponse(BaseModel):
    matches: List[ExerciseMatch] = []
    raw_identification: str = "unknown"  # equipment name (e.g. "Leg Press Machine")
    primary_exercise: Optional[str] = None  # best exercise for this machine
    muscle_group: Optional[str] = None
    error: Optional[str] = None
