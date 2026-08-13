from __future__ import annotations

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings

settings = get_settings()

engine: AsyncEngine = create_async_engine(
    settings.database_url,
    pool_pre_ping=True,
    future=True,
    # Fails reasonably fast (e.g. in tests/conftest.postgres_available) when there's truly no
    # Postgres to talk to, while still tolerating a serverless provider (e.g. Neon free tier)
    # waking up from auto-suspend on the first connection after a period of inactivity.
    connect_args={"timeout": 10},
)

ControlSessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False, class_=AsyncSession)


async def get_control_session_dep() -> AsyncIterator[AsyncSession]:
    async with ControlSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


def tenant_session(schema_name: str) -> AsyncSession:
    """A session bound to exactly one tenant's isolated schema.

    Every tenant model (app/models/tenant.py) is declared once against a
    placeholder 'tenant' schema; execution_options(schema_translate_map=...)
    rewrites that to tenant_<org_id> for every statement this session
    issues. There is no parameter, filter, or WHERE clause involved - a
    session bound this way physically cannot address another tenant's
    schema, which is the actual isolation guarantee (see ADR-003).
    """
    bind = engine.execution_options(schema_translate_map={"tenant": schema_name})
    return AsyncSession(bind=bind, expire_on_commit=False)
