from datetime import datetime
from typing import List, Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base


class Workout(Base):
    __tablename__ = "workouts"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column("userId", ForeignKey("users.id"))
    date: Mapped[datetime] = mapped_column(DateTime)
    name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    workout_type: Mapped[str] = mapped_column("workoutType", String)
    duration_minutes: Mapped[Optional[int]] = mapped_column("durationMinutes", Integer, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    fatigue_rating: Mapped[Optional[int]] = mapped_column("fatigueRating", Integer, nullable=True)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime)

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
    order: Mapped[int] = mapped_column(Integer)
    sets: Mapped[int] = mapped_column(Integer)
    reps: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    weight_kg: Mapped[Optional[float]] = mapped_column("weightKg", Float, nullable=True)
    rest_seconds: Mapped[Optional[int]] = mapped_column("restSeconds", Integer, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    was_spicy: Mapped[bool] = mapped_column("wasSpicy", Boolean, default=False)

    workout: Mapped["Workout"] = relationship(back_populates="exercises")
    exercise: Mapped[Optional["Exercise"]] = relationship()  # noqa: F821
    variation: Mapped[Optional["ExerciseVariation"]] = relationship()  # noqa: F821
