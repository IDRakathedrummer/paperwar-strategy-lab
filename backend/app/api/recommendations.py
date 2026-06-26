from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


class GameState(BaseModel):
    elapsed_seconds: float
    current_tech: list[str]
    current_units: dict
    ink: int
    map_name: str = ""


@router.post("/live")
def live_recommendation(state: GameState):
    """
    Given the current game state, return recommended next actions
    based on historically winning patterns.
    """
    return {
        "recommendations": [
            {"priority": 1, "action": "No historical data yet — play and record matches first.", "confidence": 0.0}
        ]
    }
