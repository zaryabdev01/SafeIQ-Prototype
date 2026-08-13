from fastapi import APIRouter

from app.api.routes import audit, auth, invites, onboarding, users

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(invites.router)
api_router.include_router(users.router)
api_router.include_router(audit.router)
api_router.include_router(onboarding.router)
