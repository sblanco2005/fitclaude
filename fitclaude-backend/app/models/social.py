"""Social models — follow graph and shared routines/programs.

These mirror the Prisma models (Follow, SharePost, ShareRecreation). All social
writes happen in the Next.js/Prisma layer; these exist so the Python side mirrors
the schema (per project convention) and can read social data if ever needed.
"""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Follow(Base):
    __tablename__ = "follows"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    follower_id: Mapped[str] = mapped_column("followerId", ForeignKey("users.id"))
    following_id: Mapped[str] = mapped_column("followingId", ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String, default="pending")  # "pending" | "accepted"
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, default=func.now())


class SharePost(Base):
    __tablename__ = "share_posts"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column("userId", ForeignKey("users.id"))
    item_type: Mapped[str] = mapped_column("itemType", String)  # "routine" | "program"
    title: Mapped[str] = mapped_column(String)
    caption: Mapped[str | None] = mapped_column(Text, nullable=True)
    snapshot: Mapped[str] = mapped_column(Text)  # immutable JSON used to recreate
    source_id: Mapped[str | None] = mapped_column("sourceId", String, nullable=True)
    recreate_count: Mapped[int] = mapped_column("recreateCount", Integer, default=0)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, default=func.now())


class ShareRecreation(Base):
    __tablename__ = "share_recreations"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    share_post_id: Mapped[str] = mapped_column("sharePostId", ForeignKey("share_posts.id"))
    user_id: Mapped[str] = mapped_column("userId", ForeignKey("users.id"))
    new_item_id: Mapped[str] = mapped_column("newItemId", String)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, default=func.now())
