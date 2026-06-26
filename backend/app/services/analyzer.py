"""Strategy analysis service.

Extracts features from stored matches and events, computes win rates
per opening sequence, and identifies high-value transport timing windows.
"""
from typing import List, Dict


class StrategyAnalyzer:
    def __init__(self, matches: List[Dict], events: List[Dict]):
        self.matches = matches
        self.events = events

    def win_rate_by_opening(self, n_events: int = 5) -> Dict:
        """
        Returns win rate grouped by the first N build/production events in a match.
        """
        # TODO: implement feature extraction and grouping
        return {}

    def transport_timing_windows(self) -> List[Dict]:
        """
        Returns a list of {timing_seconds, win_rate, sample_count} dicts
        representing historically effective first-transport-drop windows.
        """
        # TODO: implement timing extraction from event timelines
        return []

    def matchup_breakdown(self) -> Dict:
        """
        Returns win/loss/draw counts grouped by enemy_style.
        """
        from collections import Counter
        win_counts: Counter = Counter()
        total_counts: Counter = Counter()
        for m in self.matches:
            style = m.get("enemy_style") or "unknown"
            total_counts[style] += 1
            if m.get("result") == "win":
                win_counts[style] += 1
        return {
            style: {
                "wins": win_counts[style],
                "total": total_counts[style],
                "win_rate": round(win_counts[style] / total_counts[style], 3)
            }
            for style in total_counts
        }
