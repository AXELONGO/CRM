# Prompt 9 to Prompt 10 Boundary

Prompt 9 owns quote pricing, accepted quote versions, public quote sessions, OTP challenges, decisions, PDF content hashes and private object references. Prompt 10 must not edit quote tables or recalculate commercial scope. It consumes the accepted quote version through `getAcceptedCommercialScope`, validates the canonical hash, and stores a new agreement snapshot.

Both modules use tenant-scoped PostgreSQL transactions, composite foreign keys, RLS and private object storage. No project, payment, invoice or contract activation is triggered by quote acceptance.
