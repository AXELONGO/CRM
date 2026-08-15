# Pilot UAT Plan

Use fictional agencies, `.test` domains, `example.com` emails, synthetic files and provider IDs prefixed `TEST_`. Every case records precondition, actor, steps, expected result, evidence, severity and sign-off.

| ID     | Persona        | Scenario                                                | Expected                                               |
| ------ | -------------- | ------------------------------------------------------- | ------------------------------------------------------ |
| UAT-01 | Platform owner | Create agency and memberships                           | roles and tenant isolation established                 |
| UAT-02 | Agency admin   | Configure brand, pipeline and templates                 | settings scoped and auditable                          |
| UAT-03 | Sales          | Capture lead, opportunity, quote                        | next activity and approval state visible               |
| UAT-04 | Client portal  | Approve quote/contract and view project                 | only own resources visible                             |
| UAT-05 | Execution      | Activate four project gates, tasks and files            | gates enforced; private files protected                |
| UAT-06 | Finance        | Open receivable, manual payment and reversal            | bigint amounts and audit history correct               |
| UAT-07 | Finance        | Fake Mercado Pago, Stripe and PayPal flows              | return does not confirm; webhook/retrieve applies once |
| UAT-08 | Support        | Provider outage, queue lag and worker restart           | safe degraded state and recovery runbook               |
| UAT-09 | Security owner | Tenant A/B, role revocation and host resolution         | access denied without leakage                          |
| UAT-10 | Operations     | Backup/restore, release manifest and rollback rehearsal | evidence generated without PII                         |

UAT cannot approve real pilot until P0/P1 gaps, RLS matrix and restore drill are green.
