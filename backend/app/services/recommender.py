"""Recommendation engine.

Scores the current game state against historically winning states
and returns ranked action suggestions.
"""
from typing import List, Dict


class Recommender:
    def __init__(self, history: List[Dict]):
        self.history = history

    def recommend(self, state: Dict) -> List[Dict]:
        """
        Given the current game state dict, return a ranked list of
        {action, confidence, rationale} recommendations.
        """
        if not self.history:
            return [{"action": "Record more matches to generate recommendations.", "confidence": 0.0, "rationale": "No history"}]
        # TODO: implement pattern matching / ML scoring
        return []
