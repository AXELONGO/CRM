# Agreement Module

`agreements` owns drafts, versions, envelopes, recipients, acceptance actions, evidence and external execution records. It consumes accepted quote snapshots and writes an outbox event in the same transaction. PostgreSQL is the source of truth, tenant IDs are part of keys and RLS is enabled for all tenant-owned agreement tables.

PDF bytes are stored through the private object-storage port. Content and final PDF hashes are distinct and both are recorded.
