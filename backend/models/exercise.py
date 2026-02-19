from datetime import datetime
from typing import List, Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base


class Exercise(Base):
    __tablename__ = "exercises"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, unique=True)
    muscle_group: Mapped[str] = mapped_column("muscleGroup", String)
    secondary_muscles: Mapped[Optional[str]] = mapped_column("secondaryMuscles", String, nullable=True)
    equipment_required: Mapped[Optional[str]] = mapped_column("equipmentRequired", String, nullable=True)
    difficulty: Mapped[str] = mapped_column(String, default="intermediate")
    exercise_type: Mapped[str] = mapped_column("exerciseType", String)
    instructions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[Optional[datetime]] = mapped_column("createdAt", DateTime, nullable=True)

    variations: Mapped[List["ExerciseVariation"]] = relationship(back_populates="base_exercise")


class ExerciseVariation(Base):
    __tablename__ = "exercise_variations"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    base_exercise_id: Mapped[str] = mapped_column("baseExerciseId", ForeignKey("exercises.id"))
    name: Mapped[str] = mapped_column(String)
    spicy_level: Mapped[int] = mapped_column("spicyLevel", Integer, default=1)
    modification_type: Mapped[str] = mapped_column("modificationType", String)
    description: Mapped[str] = mapped_column(Text)
    additional_equipment: Mapped[Optional[str]] = mapped_column("additionalEquipment", String, nullable=True)

    base_exercise: Mapped["Exercise"] = relationship(back_populates="variations")
