from sqlalchemy import Column, String, Float, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base


class Event(Base):
    __tablename__ = "events"

    id = Column(String, primary_key=True)
    match_id = Column(String, ForeignKey("matches.id"), nullable=False)
    timestamp_seconds = Column(Float, nullable=False)
    event_type = Column(String, nullable=False)
    entity = Column(String, nullable=False)
    x = Column(Float, nullable=True)
    y = Column(Float, nullable=True)
    meta = Column(JSON, nullable=True)
