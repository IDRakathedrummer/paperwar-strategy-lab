from fastapi import APIRouter

router = APIRouter(prefix="/analysis", tags=["analysis"])


@router.get("/win-rates")
def win_rates():
    """Win rates grouped by opening build sequence."""
    return {"win_rates": []}


@router.get("/transport-timing")
def transport_timing():
    """Winning transport drop timing windows extracted from match history."""
    return {"transport_windows": []}


@router.get("/matchup-summary")
def matchup_summary():
    """Win/loss breakdown by enemy style."""
    return {"matchup_summary": []}
