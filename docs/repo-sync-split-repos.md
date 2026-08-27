# Syncing this monorepo to the split client repos

This working copy is a **monorepo** (`backend/` + `frontend/` + `docs/`). The client's
CI/CD and deployments run from two **split repos** hosted in their GitHub org:

| Split repo | Fed from | GitHub |
|---|---|---|
| `safeiq-be` | `backend/` | https://github.com/GTG-Enterprises/safeiq-be.git |
| `safeiq-fe` | `frontend/` | https://github.com/GTG-Enterprises/safeiq-fe.git |

`docs/` is monorepo-only and is **not** copied to either split repo.

## Remotes (already configured)

```
git remote add safeiq-be https://github.com/GTG-Enterprises/safeiq-be.git
git remote add safeiq-fe https://github.com/GTG-Enterprises/safeiq-fe.git
```

`origin` stays pointed at the internal monorepo (`zaryabdev01/SafeIQ-Prototype`).

## Push a change out to the split repos

Commit to the monorepo first, then push the relevant subtree(s):

```bash
# after committing on main
git subtree push --prefix=backend  safeiq-be main
git subtree push --prefix=frontend safeiq-fe main
```

Only push the subtree you actually changed. `git subtree push` replays the
prefix's history onto the target repo's `main`; it does not need a local clone
of either split repo.

## Notes

- The split repos' CI (ruff + mypy + pytest for BE; tsc + lint + build for FE) runs
  on their `main` after the push — see `docs/devops-cicd-production-guide.md` §5.
- If `git subtree push` rejects (target `main` moved under us), pull it back in with
  `git subtree pull --prefix=backend safeiq-be main` (or `--prefix=frontend ... safeiq-fe main`),
  resolve, then push again.
- Never `git push safeiq-be main` directly — that would try to push the whole
  monorepo tree, not the `backend/` subtree.
