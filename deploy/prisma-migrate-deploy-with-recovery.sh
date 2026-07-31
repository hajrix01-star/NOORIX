#!/usr/bin/env bash
# Runs Prisma migrations in fail-closed mode.
#
# Never mark a migration as applied from an error message. PostgreSQL can leave a
# partially-created schema behind after a failed migration, so schema drift must
# be repaired by an explicit, idempotent migration committed to the repository.
set -euo pipefail

echo "==> [prisma] migrate deploy (strict)"
npx prisma migrate deploy
echo "==> [prisma] migrate deploy succeeded"
