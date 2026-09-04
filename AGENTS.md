# ⛔ BRANCH + PR POLICY — never push to a protected branch

**Company policy. Direct commits or pushes to `main` (or `master`) in ANY repo — this
monorepo, `safeiq-be`, `safeiq-fe` — are forbidden and carry penalties.**

Every piece of work:
1. Create a branch off the up-to-date base — `git checkout -b <milestone-or-feature>/<short-desc>`.
2. Commit there. Push the **branch**: `git push -u origin <branch>`.
3. Open a PR: `gh pr create --fill` (or with a written body). Never merge it yourself.
4. A teammate reviews and merges. You may address review comments on the branch.

If you find yourself on `main`, stop and branch first. `git push origin main`,
`git push` while on `main`, and committing on `main` are all off-limits. The one
exception is a branch the user *explicitly* names as unprotected for a one-off.

---

# Repository layout

This repo now holds two independent projects — `frontend/` (Next.js prototype) and `backend/` (FastAPI service) — plus shared `docs/`. See the root `README.md` for the full picture. The Next.js-specific rules below apply only when working inside `frontend/`; when working inside `backend/`, see `backend/AGENTS.md` instead.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `frontend/node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
