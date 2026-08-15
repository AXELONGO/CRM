# Backup Policy

Pilot target: RPO up to 24 hours and RTO up to 8 hours. Retain seven daily and four weekly encrypted sets, subject to approved storage limits. Database exports and private Storage objects are separate backup domains and must share an opaque manifest only.

The scripts in `scripts/operations/` are local scaffolding. A real pilot requires an approved independent encrypted target, key custody, retention lifecycle and a restore drill before accepting customer data. Never commit dumps, plaintext manifests containing DSNs, or encryption private keys.

Restore success requires checksum verification, isolated database restore, migrations/RLS smoke checks, private object restoration, application smoke tests and an operator report without customer data.
