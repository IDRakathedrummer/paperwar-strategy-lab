"""Full integration tests for the PaperWar Strategy Lab API.

Uses an in-memory SQLite DB (via DB_PATH env override) so tests are
isolated and never touch the real paperwar.db.
"""
import os
import pytest
from fastapi.testclient import TestClient

# Point all modules at a fresh in-memory DB before importing the app
os.environ["DB_PATH"] = ":memory:"

from app.main import app  # noqa: E402 — must come after env override

client = TestClient(app)


# ── Fixtures ──────────────────────────────────────────────────────────────────

MATCH_ID = "test_match_001"
START_TS = 1_719_440_000_000  # ms
END_TS   = START_TS + 300_000  # +5 min


# ── Health ────────────────────────────────────────────────────────────────────

class TestHealth:
    def test_health_ok(self):
        r = client.get("/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"


# ── Match lifecycle ───────────────────────────────────────────────────────────

class TestMatchLifecycle:
    def test_match_start(self):
        r = client.post("/api/matches/start", json={
            "match_id": MATCH_ID,
            "timestamp": START_TS,
            "config": {"map": "delta", "mode": "ranked"}
        })
        assert r.status_code == 200
        assert r.json()["ok"] is True
        assert r.json()["match_id"] == MATCH_ID

    def test_match_start_duplicate_is_idempotent(self):
        """INSERT OR REPLACE should not raise on duplicate match_id."""
        r = client.post("/api/matches/start", json={
            "match_id": MATCH_ID,
            "timestamp": START_TS,
            "config": {}
        })
        assert r.status_code == 200

    def test_match_end(self):
        r = client.post("/api/matches/end", json={
            "match_id": MATCH_ID,
            "timestamp": END_TS,
            "result": {"head": "Victory", "label": "win", "sub": "+42 Ink"},
            "events": [
                {"t": 10000, "type": "unit_produced", "name": "Scout"},
                {"t": 60000, "type": "transport_launched", "name": "Sniper"}
            ]
        })
        assert r.status_code == 200
        assert r.json()["ok"] is True

    def test_get_match(self):
        r = client.get(f"/api/matches/{MATCH_ID}")
        assert r.status_code == 200
        data = r.json()
        assert data["id"] == MATCH_ID
        assert data["result_head"] == "Victory"
        assert data["duration_seconds"] == 300  # (END_TS - START_TS) // 1000

    def test_get_match_not_found(self):
        r = client.get("/api/matches/nonexistent_id")
        assert r.status_code == 404

    def test_list_matches(self):
        r = client.get("/api/matches/")
        assert r.status_code == 200
        matches = r.json()["matches"]
        assert any(m["id"] == MATCH_ID for m in matches)

    def test_manual_match_create(self):
        r = client.post("/api/matches/", json={
            "map_name": "ocean",
            "result": "loss",
            "duration_seconds": 180,
            "enemy_style": "naval_rush",
            "notes": "Got submarine-rushed early"
        })
        assert r.status_code == 200
        assert r.json()["status"] == "created"
        assert r.json()["match_id"].startswith("manual_")


# ── Events ────────────────────────────────────────────────────────────────────

class TestEvents:
    def test_ingest_event(self):
        r = client.post("/api/events/", json={
            "match_id": MATCH_ID,
            "t": 90000,
            "type": "unit_produced",
            "name": "AKM",
            "ink": 60
        })
        assert r.status_code == 200
        assert r.json()["ok"] is True

    def test_ingest_event_no_match_id(self):
        """match_id is optional — should still insert without error."""
        r = client.post("/api/events/", json={
            "t": 5000,
            "type": "tech_unlocked",
            "name": "Airport"
        })
        assert r.status_code == 200

    def test_get_events_for_match(self):
        r = client.get(f"/api/matches/{MATCH_ID}/events")
        assert r.status_code == 200
        events = r.json()["events"]
        # Should include the 2 batch-inserted from match_end + 1 live-ingested
        assert len(events) >= 3
        types = [e["type"] for e in events]
        assert "transport_launched" in types

    def test_events_ordered_by_time(self):
        r = client.get(f"/api/matches/{MATCH_ID}/events")
        events = r.json()["events"]
        times = [e["t"] for e in events]
        assert times == sorted(times)

    def test_get_events_via_events_router(self):
        r = client.get(f"/api/events/{MATCH_ID}")
        assert r.status_code == 200
        assert "events" in r.json()


# ── Analysis ──────────────────────────────────────────────────────────────────

class TestAnalysis:
    def test_win_rates(self):
        r = client.get("/api/analysis/win-rates")
        assert r.status_code == 200
        win_rates = r.json()["win_rates"]
        assert isinstance(win_rates, list)
        # Victory row should exist from our test match
        labels = [row["result_head"] for row in win_rates]
        assert "Victory" in labels

    def test_win_rates_counts(self):
        r = client.get("/api/analysis/win-rates")
        for row in r.json()["win_rates"]:
            assert row["wins"] <= row["total"]

    def test_transport_timing(self):
        r = client.get("/api/analysis/transport-timing")
        assert r.status_code == 200
        windows = r.json()["transport_windows"]
        assert isinstance(windows, list)
        # Our Victory match had a transport_launched event
        assert len(windows) >= 1

    def test_matchup_summary(self):
        r = client.get("/api/analysis/matchup-summary")
        assert r.status_code == 200
        summary = r.json()["matchup_summary"]
        assert isinstance(summary, list)
        # Manual match had enemy_style="naval_rush"
        styles = [row["enemy_style"] for row in summary]
        assert "naval_rush" in styles
