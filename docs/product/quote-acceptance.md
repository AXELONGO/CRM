# Quote Acceptance

Prompt 9 now exposes a public quote flow through `/q`: a token is exchanged by POST for an expiring HttpOnly session, the recipient requests and verifies a one-time email challenge, and a decision is recorded with CSRF, consent, typed name, exact version hash and idempotency key.

The decision is a commercial approval, not a contract, invoice, CFDI, advanced electronic signature, identity verification or NOM-151 evidence. Agreements in Prompt 10 must consume `getAcceptedCommercialScope` and copy its immutable snapshot.
