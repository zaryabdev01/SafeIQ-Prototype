"""Local/dev bootstrap: runs Alembic migrations for the control-plane
schema. Tenant schemas are provisioned on demand at organisation sign-up
(see app/services/tenant_provisioning.py) - there's nothing to pre-create
for them here.

Usage: python scripts/init_db.py
"""

from __future__ import annotations

import subprocess
import sys


def main() -> None:
    result = subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], check=False)
    sys.exit(result.returncode)


if __name__ == "__main__":
    main()
