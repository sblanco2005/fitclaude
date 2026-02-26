from datetime import datetime
from typing import List, Optional

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Workout(Base):
    __tablename__ = "workouts"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column("userId", ForeignKey("users.id"))
    display_id: Mapped[Optional[int]] = mapped_column("displayId", nullable=True)
    date: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    workout_type: Mapped[str] = mapped_column("workoutType", String)
    category: Mapped[str] = mapped_column(String, default="lifting")
    source: Mapped[str] = mapped_column(String, default="coach")
    duration_minutes: Mapped[Optional[int]] = mapped_column(
        "durationMinutes", nullable=True
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    fatigue_rating: Mapped[Optional[int]] = mapped_column(
        "fatigueRating", nullable=True
    )
    completed: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(
        "createdAt", DateTime, default=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="workouts")  # noqa: F821
    exercises: Mapped[List["WorkoutExercise"]] = relationship(
        back_populates="workout", cascade="all, delete-orphan"
    )


class WorkoutExercise(Base):
    __tablename__ = "workout_exercises"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    workout_id: Mapped[str] = mapped_column("workoutId", ForeignKey("workouts.id"))
    exercise_id: Mapped[Optional[str]] = mapped_column(
        "exerciseId", ForeignKey("exercises.id"), nullable=True
    )
    variation_id: Mapped[Optional[str]] = mapped_column(
        "variationId", ForeignKey("exercise_variations.id"), nullable=True
    )
    order: Mapped[int] = mapped_column()
    sets: Mapped[int] = mapped_column()
    reps: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    weight_kg: Mapped[Optional[float]] = mapped_column("weightKg", nullable=True)
    rest_seconds: Mapped[Optional[int]] = mapped_column("restSeconds", nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    set_logs: Mapped[Optional[str]] = mapped_column("setLogs", Text, nullable=True)
    was_spicy: Mapped[bool] = mapped_column("wasSpicy", default=False)

    workout: Mapped["Workout"] = relationship(back_populates="exercises")
    exercise: Mapped[Optional["Exercise"]] = relationship()  # noqa: F821
    variation: Mapped[Optional["ExerciseVariation"]] = relationship()  # noqa: F821
