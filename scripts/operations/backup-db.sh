#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
BACKUP_DIR="${BACKUP_DIR:-${TMPDIR:-/tmp}/crm-backups}"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
BACKUP_ID="crm-db-$(date -u +%Y%m%dT%H%M%SZ)-${RANDOM}"
ARCHIVE="$BACKUP_DIR/$BACKUP_ID.dump"
MANIFEST="$BACKUP_DIR/$BACKUP_ID.manifest.json"

umask 077
pg_dump --format=custom --no-owner --no-privileges --file="$ARCHIVE" "$DATABASE_URL"
CHECKSUM="$(shasum -a 256 "$ARCHIVE" | cut -d ' ' -f 1)"
SIZE="$(wc -c < "$ARCHIVE" | tr -d ' ')"
printf '{"backup_id":"%s","created_at":"%s","bytes":%s,"sha256":"%s","encrypted":false,"verified":false}\n' "$BACKUP_ID" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$SIZE" "$CHECKSUM" > "$MANIFEST"
printf '%s\n' "$MANIFEST"
