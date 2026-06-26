from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/events", tags=["events"])


class EventCreate(BaseModel):
    match_id: str
    timestamp_seconds: float
    event_type: str  # e.g. 'unit_produced', 'transport_launched', 'transport_unloaded', 'structure_built'
    entity: str      # e.g. 'Sniper', 'Airport', 'Frigate'
    x: Optional[float] = None
    y: Optional[float] = None
    meta: Optional[dict] = None


@router.post("/")
def create_event(event: EventCreate):
    """Ingest a single timeline event."""
    return {"status": "created", "event": event.model_dump()}


@router.get("/{match_id}")
def get_events(match_id: str):
    """Get all events for a match."""
    return {"match_id": match_id, "events": []}
