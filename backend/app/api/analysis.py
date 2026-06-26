from fastapi import APIRouter
import sqlite3, os

router = APIRouter(prefix="/analysis", tags=["analysis"])

DB_PATH = os.environ.get("DB_PATH", "paperwar.db")


def get_db():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con


@router.get("/win-rates")
def win_rates():
    """Win rates grouped by result_head label."""
    con = get_db()
    rows = con.execute("""
        SELECT result_head,
               COUNT(*) as total,
               SUM(CASE WHEN result_head LIKE '%win%' OR result_head LIKE '%Victory%' THEN 1 ELSE 0 END) as wins
        FROM matches
        WHERE result_head IS NOT NULL
        GROUP BY result_head
    """).fetchall()
    con.close()
    return {"win_rates": [dict(r) for r in rows]}


@router.get("/transport-timing")
def transport_timing():
    """Winning transport drop timing windows extracted from match history."""
    con = get_db()
    rows = con.execute("""
        SELECT e.match_id, e.t, e.data
        FROM events e
        JOIN matches m ON e.match_id = m.id
        WHERE e.type = 'transport_launched'
          AND (m.result_head LIKE '%win%' OR m.result_head LIKE '%Victory%')
        ORDER BY e.t ASC
    """).fetchall()
    con.close()
    return {"transport_windows": [dict(r) for r in rows]}


@router.get("/matchup-summary")
def matchup_summary():
    """Win/loss breakdown by enemy style."""
    con = get_db()
    rows = con.execute("""
        SELECT enemy_style,
               COUNT(*) as total,
               SUM(CASE WHEN result_head LIKE '%win%' OR result_head LIKE '%Victory%' THEN 1 ELSE 0 END) as wins
        FROM matches
        WHERE enemy_style IS NOT NULL
        GROUP BY enemy_style
    """).fetchall()
    con.close()
    return {"matchup_summary": [dict(r) for r in rows]}
