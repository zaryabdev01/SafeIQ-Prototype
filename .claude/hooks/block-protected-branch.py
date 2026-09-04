#!/usr/bin/env python
"""PreToolUse(Bash) hook — enforce the branch + PR policy (see AGENTS.md).

Denies any Bash command that would:
  * push to `main` / `master` explicitly (`git push ... main`, `... HEAD:master`), or
  * `git commit` while the checked-out branch is `main` / `master`, or
  * a *bare* `git push` (current branch, no refspec) while on `main` / `master`.

An explicit push of some *other* branch while HEAD happens to be on main is fine.
Quoted substrings in the command (commit messages, PR bodies, echoed text) are
stripped first so they can't trigger a false block. Exits 0 either way; a block
is signalled via the PreToolUse JSON decision, not the exit code.
"""

from __future__ import annotations

import json
import re
import subprocess
import sys

REASON = (
    "Company policy: never commit or push to a protected branch (main/master). "
    "Create a feature branch, push it, and open a PR with `gh pr create` for a "
    "teammate to review and merge. See AGENTS.md."
)

_QUOTED = re.compile(r"\"[^\"]*\"|'[^']*'")
_PUSH_TO_PROTECTED = re.compile(
    r"\bgit\s+(?:-\S+\s+)*push\b(?:\s+\S+)*\s+(?:HEAD:)?(?:main|master)(?:\s|$)"
)
_COMMIT = re.compile(r"\bgit\s+(?:-\S+\s+)*commit(?:\s|$)")
_PUSH_REST = re.compile(r"\bgit\s+(?:-\S+\s+)*push\b(.*)$")
_LEADING_CD = re.compile(r"^\s*cd\s+(?:\"([^\"]+)\"|'([^']+)'|([^\s&|;]+))")


def _deny() -> None:
    json.dump(
        {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": REASON,
            }
        },
        sys.stdout,
    )
    sys.exit(0)


def _current_branch(command: str) -> str:
    m = _LEADING_CD.search(command)
    workdir = next((g for g in (m.groups() if m else ()) if g), ".")
    try:
        return subprocess.run(
            ["git", "-C", workdir, "symbolic-ref", "--quiet", "--short", "HEAD"],
            capture_output=True,
            text=True,
            timeout=5,
        ).stdout.strip()
    except Exception:
        return ""


def main() -> None:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        sys.exit(0)

    cmd = (payload.get("tool_input") or {}).get("command") or ""
    if "git" not in cmd:
        sys.exit(0)
    s = _QUOTED.sub("", cmd)

    if _PUSH_TO_PROTECTED.search(s):
        _deny()

    push_match = _PUSH_REST.search(s)
    if not (_COMMIT.search(s) or push_match):
        sys.exit(0)

    if _current_branch(s) not in ("main", "master"):
        sys.exit(0)

    if _COMMIT.search(s):
        _deny()

    if push_match:
        rest = re.split(r"[&|;]", push_match.group(1), maxsplit=1)[0]
        positional = [t for t in rest.split() if not t.startswith("-")]
        if len(positional) <= 1:  # bare push / just a remote -> pushes the protected branch
            _deny()

    sys.exit(0)


if __name__ == "__main__":
    main()
