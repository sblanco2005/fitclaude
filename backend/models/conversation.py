from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class ConversationHistory(Base):
    __tablename__ = "conversation_history"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column("userId", ForeignKey("users.id"))
    role: Mapped[str] = mapped_column(String)
    content: Mapped[str] = mapped_column(Text)
    tool_use: Mapped[Optional[str]] = mapped_column("toolUse", Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime)
