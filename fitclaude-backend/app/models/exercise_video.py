from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ExerciseVideo(Base):
    __tablename__ = "exercise_videos"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    exercise_id: Mapped[Optional[str]] = mapped_column(
        "exerciseId", ForeignKey("exercises.id"), nullable=True
    )
    exercise_name: Mapped[str] = mapped_column("exerciseName", String)
    youtube_video_id: Mapped[str] = mapped_column("youtubeVideoId", String)
    youtube_url: Mapped[str] = mapped_column("youtubeUrl", String)
    title: Mapped[str] = mapped_column(String)
    channel_name: Mapped[Optional[str]] = mapped_column(
        "channelName", String, nullable=True
    )
    thumbnail_url: Mapped[Optional[str]] = mapped_column(
        "thumbnailUrl", String, nullable=True
    )
    duration: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    view_count: Mapped[Optional[int]] = mapped_column(
        "viewCount", Integer, nullable=True
    )
    status: Mapped[str] = mapped_column(String, default="pending")
    video_type: Mapped[str] = mapped_column("videoType", String, default="tutorial")
    is_primary: Mapped[bool] = mapped_column("isPrimary", Boolean, default=False)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(
        "reviewedAt", DateTime, nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        "createdAt", DateTime, default=func.now()
    )

    exercise = relationship("Exercise", back_populates="videos")
