# Backend-specific agent notes

This is a FastAPI/Python 3.12 project - the root `AGENTS.md`'s Next.js rules don't apply here.

- Use the `.venv` in this directory (Python **3.12**, not whatever `python`/`py` resolves to by
  default - 3.14 is too new for some dependencies here to have wheels for yet). Activate it or call
  `.venv/Scripts/python.exe` (Windows) / `.venv/bin/python` directly.
- Run `ruff check app tests scripts`, `mypy app scripts`, and `pytest` before considering a change
  done - all three are clean on `main` and should stay that way.
- Postgres-gated integration tests (`tests/test_auth_flow.py`, `tests/test_tenant_isolation.py`)
  need `docker compose up -d db` first; they skip cleanly (not error) without it.
- Tenant isolation is structural (`schema_translate_map`, see `app/db/session.py`), not a
  query-discipline convention - never add a `tenant_id` filter as an alternative to it, and never
  give a route a way to pass an arbitrary schema name.
- See `README.md`'s "Known simplifications" section before assuming something is more finished than
  it is (per-schema migrations, audit-ledger role separation, real email/KYC providers).
