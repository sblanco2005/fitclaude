from datetime import datetime
from typing import List, Optional

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TrainingProgram(Base):
    __tablename__ = "training_programs"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column("userId", ForeignKey("users.id"), unique=True)
    total_weeks: Mapped[int] = mapped_column("totalWeeks", default=2)
    current_week: Mapped[int] = mapped_column("currentWeek", default=1)
    is_active: Mapped[bool] = mapped_column("isActive", default=True)
    created_at: Mapped[datetime] = mapped_column(
        "createdAt", DateTime, default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        "updatedAt", DateTime, default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="training_program")  # noqa: F821
    days: Mapped[List["ProgramDay"]] = relationship(
        back_populates="program", cascade="all, delete-orphan"
    )


class ProgramDay(Base):
    __tablename__ = "program_days"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    program_id: Mapped[str] = mapped_column(
        "programId", ForeignKey("training_programs.id")
    )
    weekday: Mapped[int] = mapped_column()  # 0=Mon ... 6=Sun
    week_number: Mapped[int] = mapped_column("weekNumber", default=1)
    day_type: Mapped[str] = mapped_column("dayType", String)  # coached, pt_session, class, rest
    day_label: Mapped[str] = mapped_column("dayLabel", String)
    workout_type: Mapped[Optional[str]] = mapped_column("workoutType", String, nullable=True)
    exercise_template: Mapped[Optional[str]] = mapped_column("exerciseTemplate", Text, nullable=True)

    program: Mapped["TrainingProgram"] = relationship(back_populates="days")
    workouts: Mapped[List["Workout"]] = relationship(back_populates="program_day")  # noqa: F821
