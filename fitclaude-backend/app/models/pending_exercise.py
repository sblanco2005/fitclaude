from datetime import datetime
from typing import List, Optional

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PendingExercise(Base):
    __tablename__ = "pending_exercises"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    muscle_group: Mapped[str] = mapped_column("muscleGroup", String)
    secondary_muscles: Mapped[Optional[str]] = mapped_column(
        "secondaryMuscles", String, nullable=True
    )
    equipment_required: Mapped[Optional[str]] = mapped_column(
        "equipmentRequired", String, nullable=True
    )
    difficulty: Mapped[str] = mapped_column(String, default="intermediate")
    exercise_type: Mapped[str] = mapped_column("exerciseType", String)
    instructions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    youtube_video_id: Mapped[Optional[str]] = mapped_column(
        "youtubeVideoId", String, nullable=True
    )
    youtube_url: Mapped[Optional[str]] = mapped_column(
        "youtubeUrl", String, nullable=True
    )
    channel_name: Mapped[Optional[str]] = mapped_column(
        "channelName", String, nullable=True
    )
    thumbnail_url: Mapped[Optional[str]] = mapped_column(
        "thumbnailUrl", String, nullable=True
    )
    status: Mapped[str] = mapped_column(String, default="pending")
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(
        "reviewedAt", DateTime, nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        "createdAt", DateTime, default=func.now()
    )

    pending_variations: Mapped[List["PendingVariation"]] = relationship(
        back_populates="pending_exercise", cascade="all, delete-orphan"
    )


class PendingVariation(Base):
    __tablename__ = "pending_variations"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    pending_exercise_id: Mapped[str] = mapped_column(
        "pendingExerciseId", ForeignKey("pending_exercises.id")
    )
    name: Mapped[str] = mapped_column(String)
    spicy_level: Mapped[int] = mapped_column("spicyLevel", default=1)
    modification_type: Mapped[str] = mapped_column("modificationType", String)
    description: Mapped[str] = mapped_column(Text)
    additional_equipment: Mapped[Optional[str]] = mapped_column(
        "additionalEquipment", String, nullable=True
    )

    pending_exercise: Mapped["PendingExercise"] = relationship(
        back_populates="pending_variations"
    )
