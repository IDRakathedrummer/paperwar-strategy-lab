from fastapi import APIRouter
from app.api import matches, events, analysis, recommendations

router = APIRouter(prefix="/api")
router.include_router(matches.router)
router.include_router(events.router)
router.include_router(analysis.router)
router.include_router(recommendations.router)
