from datetime import datetime
from typing import List, Optional

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String, unique=True, nullable=True)
    email_verified: Mapped[Optional[datetime]] = mapped_column(
        "emailVerified", DateTime, nullable=True
    )
    image: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        "createdAt", DateTime, default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        "updatedAt", DateTime, default=func.now(), onupdate=func.now()
    )

    # Fitness profile
    age: Mapped[Optional[int]] = mapped_column(nullable=True)
    weight_kg: Mapped[Optional[float]] = mapped_column("weightKg", nullable=True)
    height_cm: Mapped[Optional[float]] = mapped_column("heightCm", nullable=True)
    fitness_goal: Mapped[Optional[str]] = mapped_column(
        "fitnessGoal", String, nullable=True
    )
    experience_level: Mapped[Optional[str]] = mapped_column(
        "experienceLevel", String, nullable=True
    )
    gym_type: Mapped[Optional[str]] = mapped_column("gymType", String, nullable=True)
    injuries_notes: Mapped[Optional[str]] = mapped_column(
        "injuriesNotes", Text, nullable=True
    )
    equipment_text: Mapped[Optional[str]] = mapped_column(
        "equipmentText", Text, nullable=True
    )
    daily_calorie_target: Mapped[Optional[int]] = mapped_column(
        "dailyCalorieTarget", nullable=True
    )
    daily_protein_target: Mapped[Optional[float]] = mapped_column(
        "dailyProteinTarget", nullable=True
    )
    sex: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    training_frequency: Mapped[Optional[int]] = mapped_column(
        "trainingFrequency", nullable=True
    )
    is_onboarded: Mapped[bool] = mapped_column("isOnboarded", default=False)

    # Relations
    workouts: Mapped[List["Workout"]] = relationship(back_populates="user")  # noqa: F821
    nutrition_logs: Mapped[List["NutritionLog"]] = relationship(back_populates="user")  # noqa: F821
    conversations: Mapped[List["ConversationHistory"]] = relationship(back_populates="user")  # noqa: F821
