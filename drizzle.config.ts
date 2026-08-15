import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/infrastructure/database/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_MIGRATION_URL ??
      "postgresql://crm_migration:crm_migration_password@localhost:5432/crm_dev",
  },
  strict: true,
  verbose: true,
});
