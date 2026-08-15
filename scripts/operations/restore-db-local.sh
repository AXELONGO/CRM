#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
ARCHIVE="${1:?usage: restore-db-local.sh BACKUP.dump}"
pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$DATABASE_URL" "$ARCHIVE"
printf '%s\n' "local restore completed; run migrations, RLS checks and smoke tests"
