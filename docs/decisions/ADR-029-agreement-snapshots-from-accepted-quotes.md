# ADR-029: Agreement Snapshots From Accepted Quotes

## Decision

An agreement can only be created from an accepted quote version. The commercial scope is copied into the agreement version snapshot and its SHA-256 hash is stored. Later catalog, quote or opportunity edits cannot change an issued agreement.

## Boundary

The module does not provide legal advice, identity verification, advanced electronic signatures, certificates, NOM-151 or payments.
