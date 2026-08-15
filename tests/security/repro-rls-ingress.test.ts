import { describe, expect, it } from "vitest";
import { migrationSql } from "./db";

describe("repro D-01: crm_ingress and crm_worker least privilege", () => {
  it("has no FOR ALL policies for crm_ingress on business tables", async () => {
    const sql = migrationSql();
    try {
      const rows = await sql`
        select tablename, policyname, cmd, roles
        from pg_policies
        where schemaname = 'public'
          and tablename in (
            'quote_client_decisions',
            'quote_outbox_events',
            'agreement_evidence_bundles',
            'agreement_outbox_events'
          )
          and cmd = 'ALL'
          and (roles = '{crm_ingress}' or roles @> '{crm_ingress}')
      `;
      expect(rows).toHaveLength(0);
    } finally {
      await sql.end({ timeout: 2 });
    }
  });

  it("has no FOR ALL policies for crm_worker on sales tables", async () => {
    const sql = migrationSql();
    try {
      const rows = await sql`
        select tablename, policyname, cmd
        from pg_policies
        where schemaname = 'public'
          and tablename like 'sales_%'
          and cmd = 'ALL'
          and (roles = '{crm_worker}' or roles @> '{crm_worker}')
      `;
      expect(rows).toHaveLength(0);
    } finally {
      await sql.end({ timeout: 2 });
    }
  });

  it("does not grant table-wide UPDATE to crm_ingress on quotes or projects", async () => {
    const sql = migrationSql();
    try {
      const rows = await sql`
        select tablename, policyname, cmd
        from pg_policies
        where schemaname = 'public'
          and tablename in ('quotes', 'projects')
          and cmd = 'UPDATE'
          and (roles = '{crm_ingress}' or roles @> '{crm_ingress}')
      `;
      expect(rows).toHaveLength(0);
    } finally {
      await sql.end({ timeout: 2 });
    }
  });
});
