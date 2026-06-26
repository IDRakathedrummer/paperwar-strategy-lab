from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, Any
import sqlite3, json, os

router = APIRouter(prefix="/events", tags=["events"])

DB_PATH = os.environ.get("DB_PATH", "paperwar.db")


def get_db():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con


class Event(BaseModel):
    match_id: Optional[str] = None
    t: int
    type: str
    ink: Optional[int] = None
    name: Optional[str] = None
    tech: Optional[Any] = None
    units: Optional[Any] = None
    hp: Optional[Any] = None
    ammo: Optional[Any] = None
    prev: Optional[int] = None


@router.post("/")
def ingest_event(body: Event):
    """Ingest a single live event from the Tampermonkey userscript."""
    con = get_db()
    con.execute(
        "INSERT INTO events (match_id, t, type, data) VALUES (?,?,?,?)",
        (body.match_id, body.t, body.type, json.dumps(body.dict(exclude_none=True)))
    )
    con.commit()
    con.close()
    return {"ok": True}


@router.get("/{match_id}")
def get_events(match_id: str):
    """Get all events for a match, ordered by time."""
    con = get_db()
    rows = con.execute(
        "SELECT * FROM events WHERE match_id=? ORDER BY t ASC", (match_id,)
    ).fetchall()
    con.close()
    return {"match_id": match_id, "events": [dict(r) for r in rows]}
