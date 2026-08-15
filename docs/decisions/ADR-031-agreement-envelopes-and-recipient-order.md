# ADR-031: Agreement Envelopes

An issued version owns one active envelope with exactly one provider recipient and one customer recipient in the MVP. Provider-first, customer-first and parallel order are stored on the envelope and enforced server-side.

Terminal envelopes are never reopened. A change requires a new draft, version and envelope.
