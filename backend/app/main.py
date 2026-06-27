from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from app.api.routes import router

app = FastAPI(
    title="PaperWar Strategy Lab API",
    version="0.1.0",
    description="Match ingestion, strategy analysis, recommendations, and automation gating for PaperWar.",
    redirect_slashes=False,
)

# ── Private Network Access middleware ────────────────────────────────────────
# Chrome's Private Network Access policy requires Access-Control-Allow-Private-
# Network: true on every preflight when a public-origin page (the game) fetches
# a loopback address (localhost:8000). FastAPI's CORSMiddleware doesn't add this
# header, so we handle it manually before the CORS middleware runs.
@app.middleware("http")
async def private_network_access(request: Request, call_next):
    if request.method == "OPTIONS":
        return Response(
            status_code=204,
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Private-Network": "true",
            },
        )
    response = await call_next(request)
    response.headers["Access-Control-Allow-Private-Network"] = "true"
    return response

# ── Standard CORS middleware ─────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],       # userscript runs from game page origin, not localhost
    allow_credentials=False,   # must be False when allow_origins=["*"]
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/health", tags=["system"])
def health():
    return {"status": "ok"}
