# Where backend / frontend code actually lives

This monorepo (`backend/` + `frontend/` + `docs/`) is **not** the source of truth for
deployable code any more. The client's CI/CD, Terraform, and deployments run from
two repos in their GitHub org, and **DevOps commits to those repos directly**:

| Repo | Contains | GitHub |
|---|---|---|
| `safeiq-be` | the backend (`app/`, `tests/`, `alembic/`, plus `.github/`, Terraform, dev-infra) | https://github.com/GTG-Enterprises/safeiq-be.git |
| `safeiq-fe` | the frontend | https://github.com/GTG-Enterprises/safeiq-fe.git |

`docs/` stays monorepo-only and is not copied to either.

## Why `git subtree push` does NOT work

The split repos were created with a history rewrite, so "the same" commit has a
different SHA on each side (`safeiq-be`'s `03881f3` == this monorepo's `d0ea3de`).
`safeiq-be` has since accumulated its own independent history — Terraform IaC,
GitHub Actions, OIDC, `.env.example` fixes. There is no shared ancestor for
`git subtree push` to fast-forward from, and a forced push would delete DevOps's
infra work. **Do not run `git subtree push`.**

## How to ship a backend change

**Branch + PR only — never push `main`** (company policy; see `AGENTS.md`). Work in a
real `safeiq-be` checkout:

```bash
git clone https://github.com/GTG-Enterprises/safeiq-be.git
cd safeiq-be
git checkout -b feat/<short-desc>
# make the change, then:
ruff check app tests scripts && mypy app scripts && pytest   # all must pass
git add -A && git commit -m "..."
git push -u origin feat/<short-desc>
gh pr create --fill          # a teammate reviews + merges; the merge deploys
```

If a change was prototyped in this monorepo's `backend/` first, move it over as a patch:

```bash
# from the monorepo, <base>..<tip> being the prototype commit range
git diff --relative=backend <base> <tip> -- backend/ > /tmp/change.patch
# in the safeiq-be checkout
git apply /tmp/change.patch          # or: git apply --exclude=<path> for files that diverged
```

## Testing note — `safeiq-be` has no CI

`safeiq-be` commit `f9d7613` removed the GitHub Actions workflow ("not gating
deploys, not needed right now"). Nothing runs `ruff` / `mypy` / `pytest` on push.
Until CI is restored, **run the full suite locally before every push** — the
Postgres-gated integration tests need a real Postgres (`docker compose up -d db`,
or any local PostgreSQL 15+ on `:5432`); they skip, not fail, without one.

## `origin` (this monorepo)

`origin` = `zaryabdev01/SafeIQ-Prototype`. Still the home for `docs/` and for the
frontend prototype history. Treat `backend/` here as a prototyping scratch area /
archival copy, not the deployed code.
