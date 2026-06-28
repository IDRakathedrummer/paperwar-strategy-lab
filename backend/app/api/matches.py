from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime
import sqlite3, json, os, time

router = APIRouter(prefix="/matches", tags=["matches"])

DB_PATH = os.environ.get("DB_PATH", "paperwar.db")


def get_db():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con


def init_db():
    con = get_db()
    con.executescript("""
    CREATE TABLE IF NOT EXISTS matches (
        id          TEXT PRIMARY KEY,
        started_at  INTEGER,
        ended_at    INTEGER,
        result_head TEXT,
        result_label TEXT,
        result_sub  TEXT,
        duration_seconds INTEGER,
        map_name    TEXT,
        enemy_style TEXT,
        config      TEXT,
        notes       TEXT
    );
    CREATE TABLE IF NOT EXISTS events (
        id       INTEGER PRIMARY KEY AUTOINCREMENT,
        match_id TEXT,
        t        INTEGER,
        type     TEXT,
        data     TEXT
    );
    """)
    con.commit()
    con.close()


init_db()


# ── Pydantic models ──────────────────────────────────────────────────────────────────────────────

class MatchCreate(BaseModel):
    """Manual match entry from the dashboard form."""
    map_name: Optional[str] = None
    result: str  # "win" | "loss" | "draw"
    duration_seconds: int
    enemy_style: Optional[str] = None
    notes: Optional[str] = None


class MatchStart(BaseModel):
    """Fired by the Tampermonkey userscript when a match begins."""
    match_id: str
    timestamp: int
    map_name: Optional[str] = None
    config: Optional[Any] = None


class MatchEnd(BaseModel):
    """Fired by the Tampermonkey userscript when the result screen appears."""
    match_id: str
    timestamp: int
    result: Optional[Any] = None
    map_name: Optional[str] = None
    enemy_style: Optional[str] = None
    events: list = []


# ── Routes ────────────────────────────────────────────────────────────────────────────────────

@router.post("/start")
def match_start(body: MatchStart):
    """Userscript: called when a match begins (lobby → game transition)."""
    con = get_db()
    con.execute(
        "INSERT OR REPLACE INTO matches (id, started_at, map_name, config) VALUES (?,?,?,?)",
        (body.match_id, body.timestamp, body.map_name, json.dumps(body.config))
    )
    con.commit()
    con.close()
    return {"ok": True, "match_id": body.match_id}


@router.post("/end")
def match_end(body: MatchEnd):
    """Userscript: called when the result screen appears."""
    con = get_db()
    result = body.result or {}
    started = con.execute(
        "SELECT started_at FROM matches WHERE id=?", (body.match_id,)
    ).fetchone()
    duration = None
    if started and started["started_at"]:
        duration = (body.timestamp - started["started_at"]) // 1000

    # Build SET clause — only overwrite map_name/enemy_style if the userscript
    # sent non-null values so that a manually-set value is never clobbered.
    update_fields = [
        "ended_at=?",
        "result_head=?",
        "result_label=?",
        "result_sub=?",
        "duration_seconds=?",
    ]
    update_values = [
        body.timestamp,
        result.get("head"),
        result.get("label"),
        result.get("sub"),
        duration,
    ]

    if body.map_name is not None:
        update_fields.append("map_name=?")
        update_values.append(body.map_name)

    if body.enemy_style is not None:
        update_fields.append("enemy_style=?")
        update_values.append(body.enemy_style)

    update_values.append(body.match_id)

    con.execute(
        f"UPDATE matches SET {', '.join(update_fields)} WHERE id=?",
        update_values,
    )
    for ev in body.events:
        con.execute(
            "INSERT OR IGNORE INTO events (match_id, t, type, data) VALUES (?,?,?,?)",
            (body.match_id, ev.get("t"), ev.get("type"), json.dumps(ev))
        )
    con.commit()
    con.close()
    return {"ok": True}


@router.post("/")
def create_match(match: MatchCreate):
    """Manual match entry from the dashboard form."""
    match_id = f"manual_{int(time.time() * 1000)}"
    con = get_db()
    con.execute(
        """INSERT INTO matches
           (id, started_at, result_head, duration_seconds, map_name, enemy_style, notes)
           VALUES (?,?,?,?,?,?,?)""",
        (
            match_id,
            int(time.time() * 1000),
            match.result,
            match.duration_seconds,
            match.map_name,
            match.enemy_style,
            match.notes,
        )
    )
    con.commit()
    con.close()
    return {"status": "created", "match_id": match_id}


@router.get("/")
def list_matches():
    """List all recorded matches, most recent first."""
    con = get_db()
    rows = con.execute(
        "SELECT * FROM matches ORDER BY started_at DESC LIMIT 100"
    ).fetchall()
    con.close()
    return {"matches": [dict(r) for r in rows]}


@router.get("/{match_id}/events")
def match_events(match_id: str):
    """Get all events for a specific match, ordered by time."""
    con = get_db()
    rows = con.execute(
        "SELECT * FROM events WHERE match_id=? ORDER BY t ASC", (match_id,)
    ).fetchall()
    con.close()
    return {"match_id": match_id, "events": [dict(r) for r in rows]}


@router.get("/{match_id}")
def get_match(match_id: str):
    """Get a single match by ID."""
    con = get_db()
    row = con.execute("SELECT * FROM matches WHERE id=?", (match_id,)).fetchone()
    con.close()
    if not row:
        raise HTTPException(status_code=404, detail="Match not found")
    return dict(row)
