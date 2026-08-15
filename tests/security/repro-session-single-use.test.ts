import { beforeEach, describe, expect, it } from "vitest";
import { hashPublicToken } from "../../src/modules/quotes/domain/public-token";
import { exchangePublicQuoteLink } from "../../src/modules/quotes/infrastructure/repositories";
import {
  ingressDb,
  migrationSql,
  resetTestDatabase,
  syntheticQuote,
  syntheticQuotePublicLink,
  syntheticTenant,
  syntheticUser,
  withTenantTx,
} from "./db";

const tenantId = "tenant-a";
const userId = "user-a";
const quoteId = "quote-a";
const linkId = "link-a";
const linkToken = "link-token-a";

beforeEach(async () => {
  process.env.NODE_ENV = "test";
  await resetTestDatabase();
  const sql = migrationSql();
  try {
    await syntheticUser(sql, userId, "user-a@example.test");
    await syntheticTenant(sql, tenantId, userId);
  } finally {
    await sql.end({ timeout: 2 });
  }
  await syntheticQuote(tenantId, quoteId, userId);
  await syntheticQuotePublicLink(tenantId, quoteId, linkId, hashPublicToken(linkToken), userId);
});

describe("repro C-01: public link is a single-use capability", () => {
  it("creates exactly one session when the same link is exchanged twice", async () => {
    const { db, close } = ingressDb();
    try {
      await db.transaction((tx) => exchangePublicQuoteLink(tx, linkToken));

      await expect(
        db.transaction((tx) => exchangePublicQuoteLink(tx, linkToken)),
      ).rejects.toThrow("PUBLIC_QUOTE_NOT_FOUND");

      const count = await withTenantTx(tenantId, async (t) => {
        const [row] = await t`
          select count(*)::int as count from quote_public_sessions
          where quote_id = ${quoteId}
        `;
        return row.count as number;
      });
      expect(count).toBe(1);
    } finally {
      await close();
    }
  });

  it("consumes the link atomically so concurrent exchanges do not mint two sessions", async () => {
    const { db, close } = ingressDb();
    try {
      const results = await Promise.allSettled([
        db.transaction((tx) => exchangePublicQuoteLink(tx, linkToken)),
        db.transaction((tx) => exchangePublicQuoteLink(tx, linkToken)),
      ]);
      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      const count = await withTenantTx(tenantId, async (t) => {
        const [row] = await t`
          select count(*)::int as count from quote_public_sessions
          where quote_id = ${quoteId}
        `;
        return row.count as number;
      });
      expect(count).toBe(1);
    } finally {
      await close();
    }
  });
});
