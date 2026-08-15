# ADR-032: Evidence Seal and Executed PDF

The evidence bundle is canonical JSON hashed with SHA-256 and sealed with HMAC-SHA-256 using a versioned application key and tenant context. Derived tenant material is not persisted. The final PDF contains a technical receipt page and remains private in object storage.

The seal detects application-side alteration; it is not a certificate, timestamp authority, client signature or NOM-151 seal.
