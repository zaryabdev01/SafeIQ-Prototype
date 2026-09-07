from fastapi import APIRouter

from app.api.routes import actions, alerts, audit, auth, internal, invites, kyc_webhook, onboarding, rags, users

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(invites.router)
api_router.include_router(users.router)
api_router.include_router(audit.router)
api_router.include_router(onboarding.router)
api_router.include_router(kyc_webhook.router)
api_router.include_router(internal.router)
api_router.include_router(rags.router)
api_router.include_router(actions.router)
api_router.include_router(alerts.router)
