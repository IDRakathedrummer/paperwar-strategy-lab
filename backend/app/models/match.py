from sqlalchemy import Column, String, Integer, Float, DateTime, Text
from sqlalchemy.sql import func
from app.core.database import Base


class Match(Base):
    __tablename__ = "matches"

    id = Column(String, primary_key=True)
    map_name = Column(String, nullable=True)
    result = Column(String, nullable=False)  # win | loss | draw
    duration_seconds = Column(Integer, nullable=False)
    enemy_style = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
