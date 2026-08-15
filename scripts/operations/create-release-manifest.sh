#!/usr/bin/env bash
set -euo pipefail

OUT="${1:-release-manifest.json}"
LOCK_HASH="$(shasum -a 256 pnpm-lock.yaml | cut -d ' ' -f 1)"
DIRTY="false"
if git diff --quiet && git diff --cached --quiet; then DIRTY="false"; else DIRTY="true"; fi
VERSION="$(node -p 'require("./package.json").version')"
SHA="$(git rev-parse HEAD 2>/dev/null || printf 'uncommitted')"
node -e 'const fs=require("fs"); const out={app_version:process.argv[1],commit_sha:process.argv[2],dirty:process.argv[3]==="true",node:process.version,pnpm:process.argv[4],lockfile_sha256:process.argv[5],migration_head:"0030_paypal_platform.sql",generated_at:new Date().toISOString(),approval:null,known_gaps:["external provider credentials disabled","backup restore drill requires local operator"]}; fs.writeFileSync(process.argv[6], JSON.stringify(out,null,2)+"\n", {mode:0o600})' "$VERSION" "$SHA" "$DIRTY" "$(pnpm --version)" "$LOCK_HASH" "$OUT"
printf '%s\n' "$OUT"
