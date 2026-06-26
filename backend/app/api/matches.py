from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

router = APIRouter(prefix="/matches", tags=["matches"])


class MatchCreate(BaseModel):
    map_name: Optional[str] = None
    result: str  # "win" | "loss" | "draw"
    duration_seconds: int
    enemy_style: Optional[str] = None
    notes: Optional[str] = None


@router.post("/")
def create_match(match: MatchCreate):
    """Ingest a new match record."""
    return {"status": "created", "match": match.model_dump()}


@router.get("/")
def list_matches():
    """List all recorded matches."""
    return {"matches": []}
