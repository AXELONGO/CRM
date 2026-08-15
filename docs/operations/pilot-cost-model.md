# Pilot Cost Model

This is a planning model, not a quote. Prices, taxes, FX and provider limits must be verified immediately before purchase.

| Component            | Pilot assumption                               | Gate                                                 |
| -------------------- | ---------------------------------------------- | ---------------------------------------------------- |
| Railway web + worker | one small web and one small worker service     | Forecast above MXN 400 warns; above MXN 500 is no-go |
| Supabase/PostgreSQL  | small active pilot, monitor quotas and pausing | Free plan is not the only backup                     |
| Storage              | private bucket, low-volume files               | Egress and retention reviewed                        |
| Email                | local Mailpit until provider selected          | No production sender without approval                |
| Backups              | encrypted independent destination candidate    | Account and token approval required                  |
| WAHA                 | optional separate service/volume               | Disabled until risk and cost approval                |
| Domains/DNS          | platform fallback first                        | Custom-domain plan decision required                 |

Add 20% contingency. No promotional credits count as normal cost. The target is approximately MXN 500/month, not a guarantee.
