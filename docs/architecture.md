# Architecture

## Goals

- Record and normalize every match into structured timeline events.
- Learn build-order and transport patterns associated with wins.
- Surface live recommendations and optional user-approved automation.

## Service map

| Service | File | Responsibility |
|---|---|---|
| Ingestion | `api/matches.py`, `api/events.py` | Accept match records and timeline events |
| Parser | `services/analyzer.py` | Normalize raw inputs into feature vectors |
| Analyzer | `services/analyzer.py` | Win rates, openings, transport timing, matchup breakdowns |
| Recommender | `services/recommender.py` | Score current state vs historical winners |
| Screen capture | `workers/screen_capture.py` | Optional screenshot-based state detection |
| Frontend | `frontend/src/App.jsx` | Dashboard, match logging, live overlay, automation controls |

## Data model

```
matches(id, map_name, result, duration_seconds, enemy_style, notes, created_at)
events(id, match_id, timestamp_seconds, event_type, entity, x, y, meta_json)
```

## Data flow

1. Match starts → recorder writes events or user logs manually.
2. Parser normalizes actions into canonical event rows.
3. Analyzer builds features and computes win-rate summaries.
4. Recommender scores current state against historical winning states.
5. Frontend shows recommendations or fires approved production/transport macros.

## Automation safety model

- **Default**: analysis only. No automated actions.
- **Assistive**: user-triggered hotkey macros for predefined production/transport sequences.
- **Full automation**: disabled by default; requires explicit toggle and is isolated behind policy checks.
