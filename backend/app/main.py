from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from starlette.middleware.base import BaseHTTPMiddleware
from app.api.routes import router


class PrivateNetworkMiddleware(BaseHTTPMiddleware):
    """
    Chrome's Private Network Access policy blocks public-origin pages from
    fetching loopback addresses unless the server returns
    Access-Control-Allow-Private-Network: true on OPTIONS preflights.
    FastAPI's CORSMiddleware doesn't add this header, so we inject it here.
    Registered first via add_middleware() so it wraps the entire stack.
    """
    async def dispatch(self, request: Request, call_next):
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


app = FastAPI(
    title="PaperWar Strategy Lab API",
    version="0.1.0",
    description="Match ingestion, strategy analysis, recommendations, and automation gating for PaperWar.",
    redirect_slashes=False,
)

# Order matters: add_middleware() wraps outside-in, so the LAST registered
# middleware is the OUTERMOST wrapper. Register PNA first so CORS is inner.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(PrivateNetworkMiddleware)

app.include_router(router)


@app.get("/health", tags=["system"])
def health():
    return {"status": "ok"}
