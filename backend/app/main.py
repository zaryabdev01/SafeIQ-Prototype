import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.router import api_router
from app.core.config import get_settings

settings = get_settings()

# Python's root logger defaults to WARNING, so every `logger.info(...)` call in
# this app - notably ConsoleEmailSender logging the dev-mode OTP code - was being
# silently swallowed with nothing configured. This is what actually makes those
# calls visible on the console.
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("safeiq.api")

app = FastAPI(title="SafeIQ API", version="0.1.0", description="Milestone 2: Authentication & Multi-Tenant Foundation")


@app.middleware("http")
async def catch_unhandled_exceptions(request: Request, call_next):
    """Turns an unhandled exception (e.g. the DB being unreachable) into a
    clean JSON 500 instead of letting it propagate to Starlette's default
    ServerErrorMiddleware.

    This has to be a real middleware, not `@app.exception_handler(Exception)`
    - Starlette special-cases a handler registered for the bare `Exception`
    class to run on ServerErrorMiddleware, which sits *outside* every user
    middleware including CORSMiddleware below, so the response would never
    get CORS headers and the browser would block it outright (opaque
    network failure, no readable error). A middleware added before
    CORSMiddleware sits *inside* it instead, so CORS headers always get
    attached to whatever this returns.
    """
    try:
        return await call_next(request)
    except Exception:
        logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
        return JSONResponse(status_code=500, content={"detail": "Internal server error"})


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health", tags=["health"])
async def health() -> dict[str, str]:
    return {"status": "ok"}
