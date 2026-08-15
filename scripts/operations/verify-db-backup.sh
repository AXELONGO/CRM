#!/usr/bin/env bash
set -euo pipefail

MANIFEST="${1:?usage: verify-db-backup.sh MANIFEST.json}"
ARCHIVE="${MANIFEST%.manifest.json}.dump"
test -f "$MANIFEST" && test -f "$ARCHIVE"
EXPECTED="$(node -e 'const fs=require("fs"); process.stdout.write(JSON.parse(fs.readFileSync(process.argv[1], "utf8")).sha256)' "$MANIFEST")"
ACTUAL="$(shasum -a 256 "$ARCHIVE" | cut -d ' ' -f 1)"
test "$EXPECTED" = "$ACTUAL"
pg_restore --list "$ARCHIVE" >/dev/null
printf '%s\n' "backup verified"
