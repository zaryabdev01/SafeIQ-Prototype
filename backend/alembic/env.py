import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool, text
from sqlalchemy.ext.asyncio import async_engine_from_config

import app.db.control_models  # noqa: F401  registers tables on ControlBase.metadata
from app.core.config import get_settings
from app.db.base import ControlBase

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

settings = get_settings()
config.set_main_option("sqlalchemy.url", settings.database_url)

target_metadata = ControlBase.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True, version_table_schema="control", include_schemas=True)
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:
    # The control schema must exist before Alembic's own version table can
    # live in it - created here, idempotently, right before Alembic needs it.
    connection.execute(text("CREATE SCHEMA IF NOT EXISTS control"))
    context.configure(connection=connection, target_metadata=target_metadata, version_table_schema="control", include_schemas=True)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    connectable = async_engine_from_config(config.get_section(config.config_ini_section, {}), prefix="sqlalchemy.", poolclass=pool.NullPool)
    async with connectable.connect() as connection:
        # The raw CREATE SCHEMA above and Alembic's own begin_transaction() both run
        # against this same connection, which SQLAlchemy 2.0 "autobegins" a transaction
        # for on first use - connect()'s context manager only closes on exit, it never
        # commits, so without this the whole migration was silently rolled back.
        await connection.run_sync(do_run_migrations)
        await connection.commit()
    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
